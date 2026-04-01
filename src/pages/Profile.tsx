import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bot, Wallet, Settings2, Activity, ShieldCheck, RefreshCw } from "lucide-react";
import { fetchProfilePositionPair, formatNumber, formatPrice } from "@/lib/dexscreener";
import {
  BotSettings,
  Position,
  ProfileData,
  createDefaultProfileData,
  loadProfileData,
  saveProfileData,
} from "@/lib/profileTrader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export default function Profile() {
  const apiBase = (import.meta.env.VITE_TRADER_API_URL as string | undefined)?.replace(/\/$/, "");
  const useBackendApi = Boolean(apiBase);

  const [data, setData] = useState<ProfileData>(createDefaultProfileData());
  const [walletInput, setWalletInput] = useState("100");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [livePriceMap, setLivePriceMap] = useState<Record<string, number>>({});
  const [liveSyncing, setLiveSyncing] = useState(false);
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<Date | null>(null);
  const isLiveSyncRunning = useRef(false);

  const fetchRemoteState = async (): Promise<ProfileData> => {
    const res = await fetch(`${apiBase}/api/profile-state`);
    if (!res.ok) throw new Error("Failed to load backend profile state");
    return res.json();
  };

  const saveRemoteState = async (next: ProfileData): Promise<ProfileData> => {
    const res = await fetch(`${apiBase}/api/profile-settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletUsd: next.walletUsd, settings: next.settings }),
    });
    if (!res.ok) throw new Error("Failed to save backend profile state");
    return res.json();
  };

  const resetRemoteState = async (): Promise<ProfileData> => {
    const res = await fetch(`${apiBase}/api/profile-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Failed to reset backend profile state");
    return res.json();
  };

  useEffect(() => {
    let canceled = false;

    async function initialLoad() {
      const profile = useBackendApi ? await fetchRemoteState() : await loadProfileData();
      if (!canceled) {
        setData(profile);
        setWalletInput(String(profile.walletUsd));
        setLoaded(true);
      }
    }

    initialLoad();

    const interval = setInterval(async () => {
      const latest = useBackendApi ? await fetchRemoteState() : await loadProfileData();
      if (!canceled) {
        setData(latest);
      }
    }, 2000);

    return () => {
      canceled = true;
      clearInterval(interval);
    };
  }, [useBackendApi]);

  useEffect(() => {
    if (useBackendApi || !data.openPositions.length) {
      setLivePriceMap({});
      setLiveUpdatedAt(null);
      return;
    }

    let canceled = false;

    const uniquePositions: Position[] = [];
    const uniqueKeys = new Set<string>();

    for (const position of data.openPositions) {
      const key = `${position.chainId}:${position.pairAddress}`;
      if (uniqueKeys.has(key)) continue;
      uniqueKeys.add(key);
      uniquePositions.push(position);
    }

    async function syncLivePrices() {
      if (isLiveSyncRunning.current) return;
      isLiveSyncRunning.current = true;
      setLiveSyncing(true);
      try {
        const nextPrices: Record<string, number> = {};
        const batchSize = 10;

        for (let i = 0; i < uniquePositions.length; i += batchSize) {
          const batch = uniquePositions.slice(i, i + batchSize);
          const batchResults = await Promise.allSettled(
            batch.map(async (position) => {
              const pair = await fetchProfilePositionPair(
                position.chainId,
                position.pairAddress,
                position.tokenAddress,
              );
              const price = parseFloat(pair?.priceUsd ?? "");
              if (Number.isFinite(price) && price > 0) {
                return { key: position.pairAddress, price };
              }
              return null;
            }),
          );

          for (const result of batchResults) {
            if (result.status === "fulfilled" && result.value) {
              nextPrices[result.value.key] = result.value.price;
            }
          }
        }

        if (!canceled && Object.keys(nextPrices).length > 0) {
          setLivePriceMap((prev) => ({ ...prev, ...nextPrices }));
          setLiveUpdatedAt(new Date());
        }
      } finally {
        isLiveSyncRunning.current = false;
        if (!canceled) setLiveSyncing(false);
      }
    }

    syncLivePrices();
    const interval = setInterval(syncLivePrices, 1000);

    return () => {
      canceled = true;
      isLiveSyncRunning.current = false;
      clearInterval(interval);
    };
  }, [data.openPositions, useBackendApi]);

  const persist = async (next: ProfileData) => {
    setData(next);
    setSaving(true);
    try {
      if (useBackendApi) {
        const saved = await saveRemoteState(next);
        setData(saved);
      } else {
        await saveProfileData(next);
      }
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = async <K extends keyof BotSettings>(key: K, value: BotSettings[K]) => {
    const next: ProfileData = {
      ...data,
      settings: {
        ...data.settings,
        [key]: value,
      },
      updatedAt: Date.now(),
    };
    await persist(next);
  };

  const updateWallet = async () => {
    const value = Number(walletInput);
    if (!Number.isFinite(value) || value < 0) return;

    const next: ProfileData = {
      ...data,
      walletUsd: round2(value),
      updatedAt: Date.now(),
    };
    await persist(next);
  };

  const resetData = async () => {
    if (useBackendApi) {
      const fresh = await resetRemoteState();
      setWalletInput(String(fresh.walletUsd));
      setData(fresh);
      return;
    }

    const fresh = createDefaultProfileData();
    setWalletInput(String(fresh.walletUsd));
    await persist(fresh);
  };

  const liveOpenPositions = useMemo(() => {
    return data.openPositions.map((position) => {
      const livePrice = livePriceMap[position.pairAddress];
      if (!Number.isFinite(livePrice) || livePrice <= 0) return position;

      const returnPct = ((livePrice - position.entryPrice) / position.entryPrice) * 100;
      return {
        ...position,
        currentPrice: livePrice,
        returnPct,
      };
    });
  }, [data.openPositions, livePriceMap]);

  const openPnl = useMemo(() => {
    return round2(
      liveOpenPositions.reduce(
        (sum, p) => sum + (p.currentPrice * p.quantity - p.investedUsd),
        0,
      ),
    );
  }, [liveOpenPositions]);

  const closedPnl = useMemo(() => {
    return round2(data.closedPositions.reduce((sum, p) => sum + (p.pnlUsd ?? 0), 0));
  }, [data]);

  const winRate = useMemo(() => {
    const total = data.closedPositions.length;
    if (!total) return 0;
    const wins = data.closedPositions.filter((p) => (p.pnlUsd ?? 0) > 0).length;
    return (wins / total) * 100;
  }, [data]);

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <section className="rounded-2xl border border-border bg-gradient-to-r from-card via-card to-secondary/40 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Profile Control Center</h1>
              <p className="text-sm text-muted-foreground">
                Background auto-trading engine is always active while app is open. This page is for live monitoring and settings only.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/">
                  <ArrowLeft className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <span className="rounded-md border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground">
                {saving ? "Saving..." : "Saved"}
              </span>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={<Wallet className="h-4 w-4 text-primary" />} label="Wallet" value={formatNumber(data.walletUsd)} />
          <StatCard icon={<Activity className="h-4 w-4 text-primary" />} label="Open PnL" value={formatNumber(openPnl)} tone={openPnl >= 0 ? "gain" : "loss"} />
          <StatCard icon={<Bot className="h-4 w-4 text-primary" />} label="Total Auto Buys" value={String(data.totalAutoBuys)} />
          <StatCard icon={<Settings2 className="h-4 w-4 text-primary" />} label="Closed PnL" value={formatNumber(closedPnl)} tone={closedPnl >= 0 ? "gain" : "loss"} />
          <StatCard icon={<ShieldCheck className="h-4 w-4 text-primary" />} label="Win Rate" value={`${winRate.toFixed(1)}%`} tone={winRate >= 50 ? "gain" : "loss"} />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Wallet</CardTitle>
              <CardDescription>Update wallet amount used by background trading.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={walletInput}
                  onChange={(e) => setWalletInput(e.target.value)}
                />
                <Button onClick={updateWallet}>Update</Button>
              </div>
              <p className="text-xs text-muted-foreground">Last engine update: {loaded ? new Date(data.updatedAt).toLocaleString() : "Loading..."}</p>
              <p className="text-xs text-muted-foreground">
                Mode: {useBackendApi ? "Always-on backend worker" : "Browser session"}
                {!useBackendApi && ` · ${liveSyncing ? "syncing every 1s" : "running"}`}
                {!useBackendApi && liveUpdatedAt ? ` · ${liveUpdatedAt.toLocaleTimeString()}` : ""}
              </p>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Strategy Settings</CardTitle>
              <CardDescription>
                Auto-buy every newly detected pair. Auto-close at take profit, stop loss, and optional trailing stop.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
              <div className="rounded-md border border-border px-3 py-2">
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-sm">Trailing Stop</Label>
                  <Switch
                    checked={data.settings.trailingEnabled}
                    onCheckedChange={(checked) => updateSettings("trailingEnabled", checked)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Enable dynamic profit lock while trend continues upward.</p>
              </div>
              <SettingInput
                label="Trailing Activation Profit (%)"
                value={data.settings.trailingActivationPct}
                onChange={(v) => updateSettings("trailingActivationPct", Math.max(1, v))}
              />
              <SettingInput
                label="Initial Locked Profit (%)"
                value={data.settings.trailingLockPct}
                onChange={(v) => updateSettings("trailingLockPct", Math.max(0, v))}
              />
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Open Positions</CardTitle>
              <CardDescription>Live positions managed by background engine.</CardDescription>
            </div>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
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
                {liveOpenPositions.slice(0, 200).map((position) => (
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
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(position.openedAt).toLocaleTimeString()}
                    </TableCell>
                  </TableRow>
                ))}
                {liveOpenPositions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No open positions yet.
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
            <CardDescription>Recent exits by take-profit, stop-loss, or trailing-stop.</CardDescription>
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
                    <TableCell className="text-right text-xs text-muted-foreground">
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

        <div className="flex justify-end">
          <Button variant="destructive" onClick={resetData}>Reset Profile Data</Button>
        </div>
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
      <Input type="number" step="0.1" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "gain" | "loss";
}) {
  const toneClass = tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-foreground";

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          {icon}
        </div>
        <p className={`font-mono text-lg ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
