import { DexPair } from "@/lib/dexscreener";
import { decryptJson, encryptJson, EncryptedPayload } from "@/lib/secureStore";

export const PROFILE_STORE_KEY = "cw_profile_v1";

const APP_SECRET_PREFIX = "cw_profile_background_secret_v1";

export type CloseReason = "take-profit" | "stop-loss" | "trailing-stop";

export interface BotSettings {
  investmentUsd: number;
  takeProfitPct: number;
  stopLossPct: number;
  trailingEnabled: boolean;
  trailingActivationPct: number;
  trailingLockPct: number;
}

export interface Position {
  id: string;
  pairAddress: string;
  pairUrl?: string;
  tokenAddress?: string;
  symbol: string;
  chainId: string;
  openedAt: number;
  entryPrice: number;
  currentPrice: number;
  peakPrice: number;
  quantity: number;
  investedUsd: number;
  returnPct: number;
  closedAt?: number;
  exitPrice?: number;
  pnlUsd?: number;
  closeReason?: CloseReason;
}

export interface ProfileData {
  walletUsd: number;
  settings: BotSettings;
  isBootstrapped: boolean;
  seenPairs: string[];
  openPositions: Position[];
  closedPositions: Position[];
  totalAutoBuys: number;
  updatedAt: number;
}

export function createDefaultProfileData(): ProfileData {
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
    updatedAt: Date.now(),
  };
}

function getStorageSecret(): string {
  const host = typeof window !== "undefined" ? window.location.host : "local";
  return `${APP_SECRET_PREFIX}:${host}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function pctFromPrice(current: number, entry: number): number {
  if (!entry || !isFinite(entry)) return 0;
  return ((current - entry) / entry) * 100;
}

function getTrailingStopPct(peakReturnPct: number, settings: BotSettings): number {
  const trailDistance = Math.max(0, settings.trailingActivationPct - settings.trailingLockPct);
  return Math.max(settings.trailingLockPct, peakReturnPct - trailDistance);
}

function normalizeProfileData(value: unknown): ProfileData {
  const base = createDefaultProfileData();

  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<ProfileData>;

  return {
    walletUsd: Number.isFinite(raw.walletUsd) ? Number(raw.walletUsd) : base.walletUsd,
    settings: {
      investmentUsd: Number.isFinite(raw.settings?.investmentUsd) ? Number(raw.settings?.investmentUsd) : base.settings.investmentUsd,
      takeProfitPct: Number.isFinite(raw.settings?.takeProfitPct) ? Number(raw.settings?.takeProfitPct) : base.settings.takeProfitPct,
      stopLossPct: Number.isFinite(raw.settings?.stopLossPct) ? Number(raw.settings?.stopLossPct) : base.settings.stopLossPct,
      trailingEnabled: typeof raw.settings?.trailingEnabled === "boolean" ? raw.settings.trailingEnabled : base.settings.trailingEnabled,
      trailingActivationPct: Number.isFinite(raw.settings?.trailingActivationPct)
        ? Number(raw.settings?.trailingActivationPct)
        : base.settings.trailingActivationPct,
      trailingLockPct: Number.isFinite(raw.settings?.trailingLockPct) ? Number(raw.settings?.trailingLockPct) : base.settings.trailingLockPct,
    },
    isBootstrapped: Boolean(raw.isBootstrapped),
    seenPairs: Array.isArray(raw.seenPairs) ? raw.seenPairs.filter((x): x is string => typeof x === "string") : base.seenPairs,
    openPositions: Array.isArray(raw.openPositions) ? raw.openPositions : base.openPositions,
    closedPositions: Array.isArray(raw.closedPositions) ? raw.closedPositions : base.closedPositions,
    totalAutoBuys: Number.isFinite(raw.totalAutoBuys) ? Number(raw.totalAutoBuys) : base.totalAutoBuys,
    updatedAt: Number.isFinite(raw.updatedAt) ? Number(raw.updatedAt) : base.updatedAt,
  };
}

export async function loadProfileData(): Promise<ProfileData> {
  try {
    const raw = localStorage.getItem(PROFILE_STORE_KEY);
    if (!raw) return createDefaultProfileData();
    const payload = JSON.parse(raw) as EncryptedPayload;
    const parsed = await decryptJson<unknown>(getStorageSecret(), payload);
    return normalizeProfileData(parsed);
  } catch {
    return createDefaultProfileData();
  }
}

export async function saveProfileData(data: ProfileData): Promise<void> {
  const payload = await encryptJson(getStorageSecret(), data);
  localStorage.setItem(PROFILE_STORE_KEY, JSON.stringify(payload));
}

export function applyTradingCycle(current: ProfileData, pairs: DexPair[]): { next: ProfileData; changed: boolean } {
  if (!pairs.length) return { next: current, changed: false };

  const next: ProfileData = {
    ...current,
    seenPairs: [...current.seenPairs],
    openPositions: [...current.openPositions],
    closedPositions: [...current.closedPositions],
  };

  let changed = false;
  const seen = new Set(next.seenPairs);

  if (!next.isBootstrapped) {
    for (const pair of pairs) seen.add(pair.pairAddress);
    next.isBootstrapped = true;
    next.seenPairs = Array.from(seen);
    next.updatedAt = Date.now();
    return { next, changed: true };
  }

  const pairPriceMap = new Map<string, number>();
  for (const pair of pairs) {
    const price = parseFloat(pair.priceUsd ?? "");
    if (Number.isFinite(price) && price > 0) {
      pairPriceMap.set(pair.pairAddress, price);
    }
  }

  const stillOpen: Position[] = [];
  const newlyClosed: Position[] = [];
  let wallet = next.walletUsd;

  for (const position of next.openPositions) {
    const latestPrice = pairPriceMap.get(position.pairAddress) ?? position.currentPrice;
    const peakPrice = Math.max(position.peakPrice, latestPrice);
    const returnPct = pctFromPrice(latestPrice, position.entryPrice);
    const peakReturnPct = pctFromPrice(peakPrice, position.entryPrice);

    let closeReason: CloseReason | null = null;

    if (returnPct >= next.settings.takeProfitPct) {
      closeReason = "take-profit";
    } else if (returnPct <= -Math.abs(next.settings.stopLossPct)) {
      closeReason = "stop-loss";
    } else if (next.settings.trailingEnabled && peakReturnPct >= next.settings.trailingActivationPct) {
      const trailingStopPct = getTrailingStopPct(peakReturnPct, next.settings);
      if (returnPct <= trailingStopPct) {
        closeReason = "trailing-stop";
      }
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
        closedAt: Date.now(),
        exitPrice: latestPrice,
        pnlUsd,
        closeReason,
      });

      changed = true;
      continue;
    }

    const mutated =
      latestPrice !== position.currentPrice ||
      peakPrice !== position.peakPrice ||
      round2(returnPct) !== round2(position.returnPct);

    stillOpen.push({
      ...position,
      currentPrice: latestPrice,
      peakPrice,
      returnPct,
    });

    if (mutated) changed = true;
  }

  next.openPositions = stillOpen;
  if (newlyClosed.length > 0) {
    next.closedPositions = [...newlyClosed, ...next.closedPositions].slice(0, 300);
  }

  for (const pair of pairs) {
    if (seen.has(pair.pairAddress)) continue;
    seen.add(pair.pairAddress);

    const entryPrice = parseFloat(pair.priceUsd ?? "");
    if (!Number.isFinite(entryPrice) || entryPrice <= 0) continue;

    const spend = Math.max(0, next.settings.investmentUsd);
    if (spend === 0 || wallet < spend) continue;

    wallet -= spend;
    const quantity = spend / entryPrice;

    next.openPositions.unshift({
      id: `${pair.pairAddress}-${Date.now()}`,
      pairAddress: pair.pairAddress,
      pairUrl: pair.url,
      tokenAddress: pair.baseToken.address,
      symbol: pair.baseToken.symbol,
      chainId: pair.chainId,
      openedAt: Date.now(),
      entryPrice,
      currentPrice: entryPrice,
      peakPrice: entryPrice,
      quantity,
      investedUsd: spend,
      returnPct: 0,
    });

    next.totalAutoBuys += 1;
    changed = true;
  }

  const seenChanged = seen.size !== next.seenPairs.length;
  if (seenChanged) {
    next.seenPairs = Array.from(seen);
    changed = true;
  }

  if (round2(wallet) !== round2(next.walletUsd)) {
    next.walletUsd = round2(wallet);
    changed = true;
  }

  if (changed) {
    next.updatedAt = Date.now();
  }

  return { next, changed };
}
