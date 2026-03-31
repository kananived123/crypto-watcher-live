import { DexPair, formatNumber, formatPrice, formatAge, formatCompact } from "@/lib/dexscreener";

interface TokenTableProps {
  pairs: DexPair[];
  loading: boolean;
}

function PriceChangeCell({ value }: { value?: number }) {
  if (value == null || isNaN(value)) return <td className="px-3 py-2 text-right font-mono text-muted-foreground text-sm">-</td>;
  const isPositive = value >= 0;
  return (
    <td className={`px-3 py-2 text-right font-mono text-sm ${isPositive ? "text-gain" : "text-loss"}`}>
      {isPositive ? "+" : ""}{value.toFixed(2)}%
    </td>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: 13 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 rounded bg-muted animate-pulse" style={{ width: `${40 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function TokenTable({ pairs, loading }: TokenTableProps) {
  if (loading && pairs.length === 0) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <TableHeader />
          <tbody>
            {Array.from({ length: 20 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <TableHeader />
        <tbody>
          {pairs.map((pair, index) => (
            <TokenRow key={pair.pairAddress} pair={pair} rank={index + 1} />
          ))}
          {pairs.length === 0 && !loading && (
            <tr>
              <td colSpan={13} className="text-center py-12 text-muted-foreground">
                No pairs found. Data will refresh automatically.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TableHeader() {
  return (
    <thead className="sticky top-0 z-10 bg-card border-b border-border">
      <tr className="text-muted-foreground text-xs uppercase tracking-wider">
        <th className="px-3 py-3 text-left font-semibold">#</th>
        <th className="px-3 py-3 text-left font-semibold">Token</th>
        <th className="px-3 py-3 text-right font-semibold">MCAP</th>
        <th className="px-3 py-3 text-right font-semibold">Price</th>
        <th className="px-3 py-3 text-right font-semibold">Age</th>
        <th className="px-3 py-3 text-right font-semibold">Buys</th>
        <th className="px-3 py-3 text-right font-semibold">Sells</th>
        <th className="px-3 py-3 text-right font-semibold">Volume</th>
        <th className="px-3 py-3 text-right font-semibold">Makers</th>
        <th className="px-3 py-3 text-right font-semibold">5M</th>
        <th className="px-3 py-3 text-right font-semibold">1H</th>
        <th className="px-3 py-3 text-right font-semibold">6H</th>
        <th className="px-3 py-3 text-right font-semibold">24H</th>
        <th className="px-3 py-3 text-right font-semibold">Liquidity</th>
      </tr>
    </thead>
  );
}

function TokenRow({ pair, rank }: { pair: DexPair; rank: number }) {
  const totalBuys = pair.txns.h24.buys;
  const totalSells = pair.txns.h24.sells;
  const makers = totalBuys + totalSells;

  return (
    <tr
      className="border-b border-border hover:bg-accent/50 transition-colors cursor-pointer group"
      onClick={() => window.open(pair.url, "_blank")}
    >
      <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
        #{rank}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2 min-w-[180px]">
          {pair.info?.imageUrl ? (
            <img
              src={pair.info.imageUrl}
              alt=""
              className="w-7 h-7 rounded-full bg-muted"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
              {pair.baseToken.symbol.charAt(0)}
            </div>
          )}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {pair.baseToken.symbol}
              </span>
              <span className="text-xs text-muted-foreground">
                /{pair.quoteToken.symbol}
              </span>
              {pair.boosts && pair.boosts.active > 0 && (
                <span className="text-xs text-warning font-bold">⚡{pair.boosts.active}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] px-1 py-0.5 rounded bg-secondary text-secondary-foreground uppercase font-medium">
                {pair.dexId}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {pair.chainId}
              </span>
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2 text-right font-mono text-sm text-foreground">
        {pair.marketCap ? formatNumber(pair.marketCap) : pair.fdv ? formatNumber(pair.fdv) : "-"}
      </td>
      <td className="px-3 py-2 text-right font-mono text-sm text-foreground">
        {formatPrice(pair.priceUsd)}
      </td>
      <td className="px-3 py-2 text-right font-mono text-sm text-primary">
        {formatAge(pair.pairCreatedAt)}
      </td>
      <td className="px-3 py-2 text-right font-mono text-sm text-gain">
        {formatCompact(totalBuys)}
      </td>
      <td className="px-3 py-2 text-right font-mono text-sm text-loss">
        {formatCompact(totalSells)}
      </td>
      <td className="px-3 py-2 text-right font-mono text-sm text-foreground">
        {formatNumber(pair.volume.h24)}
      </td>
      <td className="px-3 py-2 text-right font-mono text-sm text-foreground">
        {formatCompact(makers)}
      </td>
      <PriceChangeCell value={pair.priceChange.m5} />
      <PriceChangeCell value={pair.priceChange.h1} />
      <PriceChangeCell value={pair.priceChange.h6} />
      <PriceChangeCell value={pair.priceChange.h24} />
      <td className="px-3 py-2 text-right font-mono text-sm text-foreground">
        {formatNumber(pair.liquidity?.usd)}
      </td>
    </tr>
  );
}
