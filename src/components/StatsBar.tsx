import { DexPair, formatNumber, formatCompact } from "@/lib/dexscreener";

interface StatsBarProps {
  pairs: DexPair[];
}

export default function StatsBar({ pairs }: StatsBarProps) {
  const totalVolume = pairs.reduce((sum, p) => sum + (p.volume?.h24 || 0), 0);
  const totalTxns = pairs.reduce((sum, p) => sum + (p.txns?.h24?.buys || 0) + (p.txns?.h24?.sells || 0), 0);
  const totalLiquidity = pairs.reduce((sum, p) => sum + (p.liquidity?.usd || 0), 0);
  const gainers = pairs.filter((p) => (p.priceChange?.h24 ?? 0) > 0).length;
  const losers = pairs.filter((p) => (p.priceChange?.h24 ?? 0) < 0).length;

  return (
    <div className="flex items-center gap-3 sm:gap-6 px-3 sm:px-4 py-1.5 sm:py-2 border-b border-border bg-card/50 text-xs overflow-x-auto no-scrollbar shrink-0">
      <StatItem label="24H Vol" value={formatNumber(totalVolume)} />
      <StatItem label="Txns" value={formatCompact(totalTxns)} />
      <StatItem label="Liquidity" value={formatNumber(totalLiquidity)} />
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-muted-foreground hidden sm:inline">Trend</span>
        <span className="text-gain font-mono font-semibold">↑{gainers}</span>
        <span className="text-loss font-mono font-semibold">↓{losers}</span>
      </div>
      <div className="ml-auto shrink-0 text-muted-foreground hidden md:block">
        {pairs.length} pairs
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-mono font-semibold text-foreground">{value}</span>
    </div>
  );
}
