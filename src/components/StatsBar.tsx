import { DexPair, formatNumber, formatCompact } from "@/lib/dexscreener";

interface StatsBarProps {
  pairs: DexPair[];
}

export default function StatsBar({ pairs }: StatsBarProps) {
  const totalVolume = pairs.reduce((sum, p) => sum + (p.volume.h24 || 0), 0);
  const totalTxns = pairs.reduce((sum, p) => sum + p.txns.h24.buys + p.txns.h24.sells, 0);
  const totalLiquidity = pairs.reduce((sum, p) => sum + (p.liquidity?.usd || 0), 0);

  return (
    <div className="flex items-center gap-6 px-4 py-2 border-b border-border bg-card/50 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">24H Volume:</span>
        <span className="font-mono font-semibold text-foreground">{formatNumber(totalVolume)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">24H Txns:</span>
        <span className="font-mono font-semibold text-foreground">{formatCompact(totalTxns)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Total Liquidity:</span>
        <span className="font-mono font-semibold text-foreground">{formatNumber(totalLiquidity)}</span>
      </div>
    </div>
  );
}
