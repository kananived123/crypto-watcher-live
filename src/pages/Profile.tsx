import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Lock, Unlock, Wallet, Activity } from "lucide-react";
import { useNewPairs } from "@/hooks/useNewPairs";
import { formatNumber, formatPrice } from "@/lib/dexscreener";
import { decryptJson, encryptJson, EncryptedPayload } from "@/lib/secureStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PROFILE_STORE_KEY = "cw_profile_v1";

const DEMO_EMAIL = "demo@gmail.com";
const DEMO_PASSWORD = "Kanani@1711.";

type CloseReason = "take-profit" | "stop-loss" | "trailing-stop";

interface BotSettings {
  investmentUsd: number;
  takeProfitPct: number;
  stopLossPct: number;
  trailingEnabled: boolean;
  trailingActivationPct: number;
  trailingLockPct: number;
}

interface Position {
  id: string;
  pairAddress: string;
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

interface ProfileData {
  walletUsd: number;
  settings: BotSettings;
  isBootstrapped: boolean;
  seenPairs: string[];
  openPositions: Position[];
  closedPositions: Position[];
  updatedAt: number;
}

function createDefaultData(): ProfileData {
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
    updatedAt: Date.now(),
  };
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

export default function Profile() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [data, setData] = useState<ProfileData | null>(null);
  const [saving, setSaving] = useState(false);
  const [walletInput, setWalletInput] = useState("100");

  const { pairs, loading, lastUpdated } = useNewPairs(2000);

  useEffect(() => {
    if (!secret) return;

    let canceled = false;

    async function loadProfile() {
      try {
        const raw = localStorage.getItem(PROFILE_STORE_KEY);
        if (!raw) {
          const fallback = createDefaultData();
          if (!canceled) {
            setData(fallback);
            setWalletInput(String(fallback.walletUsd));
          }
          return;
        }

        const payload = JSON.parse(raw) as EncryptedPayload;
        const parsed = await decryptJson<ProfileData>(secret, payload);
        if (!canceled) {
          setData(parsed);
          setWalletInput(String(parsed.walletUsd));
        }
      } catch {
        const fallback = createDefaultData();
        if (!canceled) {
          setData(fallback);
          setWalletInput(String(fallback.walletUsd));
        }
      }
    }

    loadProfile();

    return () => {
      canceled = true;
    };
  }, [secret]);

  useEffect(() => {
    if (!secret || !data) return;

    let canceled = false;

    async function persist() {
      setSaving(true);
      try {
        const payload = await encryptJson(secret, data);
        if (!canceled) {
          localStorage.setItem(PROFILE_STORE_KEY, JSON.stringify(payload));
        }
      } finally {
        if (!canceled) setSaving(false);
      }
    }

    persist();

    return () => {
      canceled = true;
    };
  }, [data, secret]);

  useEffect(() => {
    if (!data || pairs.length === 0) return;

    setData((prev) => {
      if (!prev) return prev;

      const next = {
        ...prev,
        seenPairs: [...prev.seenPairs],
        openPositions: [...prev.openPositions],
        closedPositions: [...prev.closedPositions],
      };

      const seen = new Set(next.seenPairs);

      if (!next.isBootstrapped) {
        for (const pair of pairs) {
          seen.add(pair.pairAddress);
        }
        next.isBootstrapped = true;
        next.seenPairs = Array.from(seen);
        next.updatedAt = Date.now();
        return next;
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
        } else if (
          next.settings.trailingEnabled &&
          peakReturnPct >= next.settings.trailingActivationPct
        ) {
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
          continue;
        }

        stillOpen.push({
          ...position,
          currentPrice: latestPrice,
          peakPrice,
          returnPct,
        });
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
        if (wallet < spend || spend === 0) continue;

        wallet -= spend;
        const quantity = spend / entryPrice;

        next.openPositions.unshift({
          id: `${pair.pairAddress}-${Date.now()}`,
          pairAddress: pair.pairAddress,
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
      }

      next.walletUsd = round2(wallet);
      next.seenPairs = Array.from(seen);
      next.updatedAt = Date.now();
      return next;
    });
  }, [pairs]);

  const openPnl = useMemo(() => {
    if (!data) return 0;
    return round2(
      data.openPositions.reduce(
        (sum, p) => sum + (p.currentPrice * p.quantity - p.investedUsd),
        0,
      ),
    );
  }, [data]);

  const closedPnl = useMemo(() => {
    if (!data) return 0;
    return round2(data.closedPositions.reduce((sum, p) => sum + (p.pnlUsd ?? 0), 0));
  }, [data]);

  const winRate = useMemo(() => {
    if (!data) return 0;
    const total = data.closedPositions.length;
    if (!total) return 0;
    const wins = data.closedPositions.filter((p) => (p.pnlUsd ?? 0) > 0).length;
    return (wins / total) * 100;
  }, [data]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);

    if (email.trim() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      setUnlockError("Invalid demo credentials.");
      return;
    }

    // Keep credentials only in memory so encrypted storage remains locked once session ends.
    setSecret(`${email}::${password}`);
  };

  const updateSettings = <K extends keyof BotSettings>(key: K, value: BotSettings[K]) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        settings: {
          ...prev.settings,
          [key]: value,
        },
        updatedAt: Date.now(),
      };
    });
  };

  const updateWallet = () => {
    const value = Number(walletInput);
    if (!Number.isFinite(value) || value < 0) return;
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        walletUsd: round2(value),
        updatedAt: Date.now(),
      };
    });
  };

  const resetDemoData = () => {
    const fallback = createDefaultData();
    setData(fallback);
    setWalletInput(String(fallback.walletUsd));
  };

  const lockSession = () => {
    setSecret(null);
    setData(null);
    setEmail("");
    setPassword("");
  };

  if (!secret || !data) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-4">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                Back to scanner
              </Link>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Lock className="h-5 w-5 text-primary" />
                Demo Profile Lock
              </CardTitle>
              <CardDescription>
                This profile is demo-only for testing. Data is encrypted in local storage.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUnlock} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="demo@gmail.com"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Kanani@1711."
                    autoComplete="off"
                  />
                </div>
                {unlockError && <p className="text-sm text-destructive">{unlockError}</p>}
                <Button type="submit" className="w-full">
                  Unlock Profile
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Demo Profile Auto Trader</h1>
            <p className="text-xs text-muted-foreground">
              Real-time demo mode. Auto-buy only newly detected pairs, then close by TP/SL/trailing rules.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{loading ? "Syncing..." : "Live synced"}</span>
            <span>{lastUpdated ? lastUpdated.toLocaleTimeString() : "-"}</span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                Scanner
              </Link>
            </Button>
            <Button variant="secondary" size="sm" onClick={lockSession}>
              <Unlock className="h-4 w-4" />
              Lock
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Wallet
              </CardTitle>
              <CardDescription>Set your demo wallet amount anytime.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={walletInput}
                  onChange={(e) => setWalletInput(e.target.value)}
                />
                <Button onClick={updateWallet}>Update</Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Current wallet: <span className="font-mono text-foreground">{formatNumber(data.walletUsd)}</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Strategy Settings
              </CardTitle>
              <CardDescription>
                Buy amount per new pair + close rules (TP 50%, SL 10%, optional trailing).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <SettingInput
                label="Investment per Buy (USD)"
                value={data.settings.investmentUsd}
                onChange={(v) => updateSettings("investmentUsd", Math.max(0, v))}
              />
              <SettingInput
                label="Take Profit (%)"
                value={data.settings.takeProfitPct}
                onChange={(v) => updateSettings("takeProfitPct", Math.max(1, v))}
              />
              <SettingInput
                label="Stop Loss (%)"
                value={data.settings.stopLossPct}
                onChange={(v) => updateSettings("stopLossPct", Math.max(1, v))}
              />

              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Trailing Stop</p>
                  <p className="text-xs text-muted-foreground">Turn on/off trailing rule.</p>
                </div>
                <Switch
                  checked={data.settings.trailingEnabled}
                  onCheckedChange={(checked) => updateSettings("trailingEnabled", checked)}
                />
              </div>

              <SettingInput
                label="Trailing Activate at Profit (%)"
                value={data.settings.trailingActivationPct}
                onChange={(v) => updateSettings("trailingActivationPct", Math.max(1, v))}
              />
              <SettingInput
                label="Initial Locked Profit (%)"
                value={data.settings.trailingLockPct}
                onChange={(v) => updateSettings("trailingLockPct", Math.max(0, v))}
              />

              <p className="text-xs text-muted-foreground">
                Example with defaults: at +50% peak, stop locks near +20%; as peak rises, lock trails upward.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance</CardTitle>
              <CardDescription>Live summary of open and closed demo positions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Metric label="Open positions" value={String(data.openPositions.length)} />
              <Metric label="Closed positions" value={String(data.closedPositions.length)} />
              <Metric label="Open PnL" value={formatNumber(openPnl)} positive={openPnl >= 0} />
              <Metric label="Closed PnL" value={formatNumber(closedPnl)} positive={closedPnl >= 0} />
              <Metric label="Win Rate" value={`${winRate.toFixed(1)}%`} positive={winRate >= 50} />
              <p className="pt-2 text-xs text-muted-foreground">
                Data encrypted locally: {saving ? "Saving..." : "Saved"}
              </p>
              <Button variant="destructive" size="sm" onClick={resetDemoData}>
                Reset Demo Data
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Chain</TableHead>
                  <TableHead className="text-right">Entry</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">Return</TableHead>
                  <TableHead className="text-right">Invested</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Opened</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.openPositions.slice(0, 200).map((position) => (
                  <TableRow key={position.id}>
                    <TableCell className="font-medium">{position.symbol}</TableCell>
                    <TableCell className="uppercase">{position.chainId}</TableCell>
                    <TableCell className="text-right font-mono">{formatPrice(String(position.entryPrice))}</TableCell>
                    <TableCell className="text-right font-mono">{formatPrice(String(position.currentPrice))}</TableCell>
                    <TableCell className={`text-right font-mono ${position.returnPct >= 0 ? "text-gain" : "text-loss"}`}>
                      {position.returnPct >= 0 ? "+" : ""}
                      {position.returnPct.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(position.investedUsd)}</TableCell>
                    <TableCell className="text-right font-mono">{position.quantity.toFixed(6)}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs">
                      {new Date(position.openedAt).toLocaleTimeString()}
                    </TableCell>
                  </TableRow>
                ))}
                {data.openPositions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No open positions yet. Bot waits for newly detected pairs.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Closed Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Entry</TableHead>
                  <TableHead className="text-right">Exit</TableHead>
                  <TableHead className="text-right">Return</TableHead>
                  <TableHead className="text-right">PnL</TableHead>
                  <TableHead className="text-right">Closed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.closedPositions.slice(0, 300).map((position) => (
                  <TableRow key={`${position.id}-${position.closedAt}`}>
                    <TableCell className="font-medium">{position.symbol}</TableCell>
                    <TableCell className="capitalize">{position.closeReason?.replace("-", " ")}</TableCell>
                    <TableCell className="text-right font-mono">{formatPrice(String(position.entryPrice))}</TableCell>
                    <TableCell className="text-right font-mono">{formatPrice(String(position.exitPrice ?? 0))}</TableCell>
                    <TableCell className={`text-right font-mono ${position.returnPct >= 0 ? "text-gain" : "text-loss"}`}>
                      {position.returnPct >= 0 ? "+" : ""}
                      {position.returnPct.toFixed(2)}%
                    </TableCell>
                    <TableCell className={`text-right font-mono ${(position.pnlUsd ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
                      {formatNumber(position.pnlUsd ?? 0)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs">
                      {position.closedAt ? new Date(position.closedAt).toLocaleTimeString() : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {data.closedPositions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No closed positions yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SettingInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function Metric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const tone = positive == null ? "text-foreground" : positive ? "text-gain" : "text-loss";

  return (
    <div className="flex items-center justify-between rounded border border-border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${tone}`}>{value}</span>
    </div>
  );
}
