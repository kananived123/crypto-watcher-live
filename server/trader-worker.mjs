import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = "https://api.dexscreener.com";
const PORT = Number(process.env.TRADER_PORT || 8787);
const POLL_MS = Number(process.env.TRADER_POLL_MS || 1000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const STATE_PATH = path.join(DATA_DIR, "profile-state.json");

function now() {
  return Date.now();
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function pctFromPrice(current, entry) {
  if (!entry || !Number.isFinite(entry)) return 0;
  return ((current - entry) / entry) * 100;
}

function getTrailingStopPct(peakReturnPct, settings) {
  const trailDistance = Math.max(0, settings.trailingActivationPct - settings.trailingLockPct);
  return Math.max(settings.trailingLockPct, peakReturnPct - trailDistance);
}

function createDefaultState() {
  return {
    walletUsd: 100,
    settings: {
      investmentUsd: 1,
      takeProfitPct: 50,
      stopLossPct: 10,
      trailingEnabled: true,
      trailingActivationPct: 50,
      trailingLockPct: 20,
    },
    isBootstrapped: false,
    seenPairs: [],
    openPositions: [],
    closedPositions: [],
    totalAutoBuys: 0,
    updatedAt: now(),
  };
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STATE_PATH);
  } catch {
    await fs.writeFile(STATE_PATH, JSON.stringify(createDefaultState(), null, 2), "utf8");
  }
}

async function readState() {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return { ...createDefaultState(), ...parsed };
  } catch {
    return createDefaultState();
  }
}

async function writeState(state) {
  await ensureDataFile();
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}

async function fetchLatestProfiles() {
  return fetchJson(`${BASE_URL}/token-profiles/latest/v1`);
}

async function fetchPairsByToken(chainId, tokenAddress) {
  return fetchJson(`${BASE_URL}/token-pairs/v1/${chainId}/${tokenAddress}`);
}

async function fetchPairByAddress(chainId, pairAddress) {
  try {
    const data = await fetchJson(`${BASE_URL}/latest/dex/pairs/${chainId}/${pairAddress}`);
    if (data?.pair?.pairAddress) return data.pair;
    if (Array.isArray(data?.pairs)) {
      const found = data.pairs.find((p) => p.pairAddress?.toLowerCase() === pairAddress.toLowerCase());
      if (found) return found;
    }
  } catch {
    // ignore
  }

  try {
    const data = await fetchJson(`${BASE_URL}/latest/dex/search?q=${encodeURIComponent(pairAddress)}`);
    const found = (data?.pairs || []).find(
      (p) => p.chainId?.toLowerCase() === chainId.toLowerCase() && p.pairAddress?.toLowerCase() === pairAddress.toLowerCase(),
    );
    return found || null;
  } catch {
    return null;
  }
}

async function fetchLivePrice(position) {
  if (position.tokenAddress) {
    try {
      const tokenPairs = await fetchPairsByToken(position.chainId, position.tokenAddress);
      const matched = (tokenPairs || []).find(
        (p) => p.pairAddress?.toLowerCase() === position.pairAddress.toLowerCase(),
      );
      const tokenPrice = parseFloat(matched?.priceUsd || "");
      if (Number.isFinite(tokenPrice) && tokenPrice > 0) return tokenPrice;
    } catch {
      // fallback below
    }
  }

  const pair = await fetchPairByAddress(position.chainId, position.pairAddress);
  const price = parseFloat(pair?.priceUsd || "");
  return Number.isFinite(price) && price > 0 ? price : null;
}

async function runTradingCycle() {
  const state = await readState();

  const profiles = await fetchLatestProfiles();
  const uniqueTokens = new Map();
  for (const p of (profiles || []).slice(0, 40)) {
    const key = `${p.chainId}:${p.tokenAddress}`;
    if (!uniqueTokens.has(key)) uniqueTokens.set(key, { chainId: p.chainId, tokenAddress: p.tokenAddress });
  }

  const tokens = Array.from(uniqueTokens.values());
  const allPairs = [];
  for (let i = 0; i < Math.min(tokens.length, 30); i += 5) {
    const batch = tokens.slice(i, i + 5);
    const results = await Promise.allSettled(batch.map((t) => fetchPairsByToken(t.chainId, t.tokenAddress)));
    for (const r of results) {
      if (r.status === "fulfilled" && Array.isArray(r.value)) {
        allPairs.push(...r.value);
      }
    }
  }

  const seen = new Set(state.seenPairs || []);
  if (!state.isBootstrapped) {
    for (const pair of allPairs) seen.add(pair.pairAddress);
    state.isBootstrapped = true;
    state.seenPairs = Array.from(seen);
    state.updatedAt = now();
    await writeState(state);
    return;
  }

  const pairMap = new Map();
  for (const pair of allPairs) {
    const price = parseFloat(pair?.priceUsd || "");
    if (Number.isFinite(price) && price > 0) pairMap.set(pair.pairAddress, price);
  }

  let wallet = Number(state.walletUsd || 0);
  const stillOpen = [];
  const newlyClosed = [];

  for (const position of state.openPositions || []) {
    let latestPrice = pairMap.get(position.pairAddress);
    if (!latestPrice) {
      latestPrice = await fetchLivePrice(position);
    }
    if (!latestPrice) latestPrice = position.currentPrice;

    const peakPrice = Math.max(position.peakPrice || latestPrice, latestPrice);
    const returnPct = pctFromPrice(latestPrice, position.entryPrice);
    const peakReturnPct = pctFromPrice(peakPrice, position.entryPrice);

    let closeReason = null;
    if (returnPct >= state.settings.takeProfitPct) closeReason = "take-profit";
    else if (returnPct <= -Math.abs(state.settings.stopLossPct)) closeReason = "stop-loss";
    else if (state.settings.trailingEnabled && peakReturnPct >= state.settings.trailingActivationPct) {
      const trailingStopPct = getTrailingStopPct(peakReturnPct, state.settings);
      if (returnPct <= trailingStopPct) closeReason = "trailing-stop";
    }

    if (closeReason) {
      const exitValue = position.quantity * latestPrice;
      const pnlUsd = exitValue - position.investedUsd;
      wallet += exitValue;
      newlyClosed.push({
        ...position,
        currentPrice: latestPrice,
        peakPrice,
        returnPct,
        closedAt: now(),
        exitPrice: latestPrice,
        pnlUsd,
        closeReason,
      });
      continue;
    }

    stillOpen.push({
      ...position,
      currentPrice: latestPrice,
      peakPrice,
      returnPct,
    });
  }

  state.openPositions = stillOpen;
  if (newlyClosed.length > 0) {
    state.closedPositions = [...newlyClosed, ...(state.closedPositions || [])].slice(0, 500);
  }

  for (const pair of allPairs) {
    if (seen.has(pair.pairAddress)) continue;
    seen.add(pair.pairAddress);

    const entryPrice = parseFloat(pair?.priceUsd || "");
    if (!Number.isFinite(entryPrice) || entryPrice <= 0) continue;

    const spend = Math.max(0, Number(state.settings.investmentUsd || 0));
    if (!spend || wallet < spend) continue;

    wallet -= spend;
    const quantity = spend / entryPrice;

    state.openPositions.unshift({
      id: `${pair.pairAddress}-${now()}`,
      pairAddress: pair.pairAddress,
      pairUrl: pair.url,
      tokenAddress: pair.baseToken?.address,
      symbol: pair.baseToken?.symbol || "UNK",
      chainId: pair.chainId,
      openedAt: now(),
      entryPrice,
      currentPrice: entryPrice,
      peakPrice: entryPrice,
      quantity,
      investedUsd: spend,
      returnPct: 0,
    });
    state.totalAutoBuys = Number(state.totalAutoBuys || 0) + 1;
  }

  state.walletUsd = round2(wallet);
  state.seenPairs = Array.from(seen);
  state.updatedAt = now();

  await writeState(state);
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function send(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 200, { ok: true });

  if (req.url === "/api/profile-state" && req.method === "GET") {
    const state = await readState();
    return send(res, 200, state);
  }

  if (req.url === "/api/profile-settings" && req.method === "POST") {
    const body = await parseBody(req);
    const state = await readState();
    const next = {
      ...state,
      walletUsd: Number.isFinite(body.walletUsd) ? Number(body.walletUsd) : state.walletUsd,
      settings: {
        ...state.settings,
        ...(body.settings || {}),
      },
      updatedAt: now(),
    };
    await writeState(next);
    return send(res, 200, next);
  }

  if (req.url === "/api/profile-reset" && req.method === "POST") {
    const next = createDefaultState();
    await writeState(next);
    return send(res, 200, next);
  }

  return send(res, 404, { error: "Not found" });
});

async function start() {
  await ensureDataFile();

  server.listen(PORT, () => {
    console.log(`Trader worker API listening on :${PORT}`);
    console.log(`State file: ${STATE_PATH}`);
  });

  const tick = async () => {
    try {
      await runTradingCycle();
    } catch (error) {
      console.error("Trading cycle error:", error?.message || error);
    }
  };

  await tick();
  setInterval(tick, POLL_MS);
}

start();
