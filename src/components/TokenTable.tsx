import { DexPair, formatNumber, formatPrice, formatAge, formatCompact } from "@/lib/dexscreener";

interface TokenTableProps {
  pairs: DexPair[];
  loading: boolean;
}

function PriceChangeBadge({ value }: { value?: number }) {
  if (value == null || isNaN(value)) return <span className="text-muted-foreground">-</span>;
  const isPositive = value >= 0;
  return (
    <span className={`font-mono text-xs ${isPositive ? "text-gain" : "text-loss"}`}>
      {isPositive ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function PriceChangeCell({ value }: { value?: number }) {
  if (value == null || isNaN(value))
    return <td className="px-3 py-2 text-right font-mono text-muted-foreground text-sm">-</td>;
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
      {Array.from({ length: 14 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          {/* Width cycles between 40-85% to give a natural varied appearance */}
          <div className="h-4 rounded bg-muted animate-pulse" style={{ width: `${40 + (i * 13) % 45}%` }} />
        </td>
      ))}
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div className="p-3 border-b border-border">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-muted animate-pulse shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-4 rounded bg-muted animate-pulse w-2/3" />
          <div className="h-3 rounded bg-muted animate-pulse w-1/2" />
        </div>
        <div className="h-4 rounded bg-muted animate-pulse w-16" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-3 rounded bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}

/* ── Mobile card row ──────────────────────────── */
function TokenCard({ pair, rank }: { pair: DexPair; rank: number }) {
  const totalBuys = pair.txns?.h24?.buys ?? 0;
  const totalSells = pair.txns?.h24?.sells ?? 0;

  return (
    <div
      className="p-3 border-b border-border active:bg-accent/70 hover:bg-accent/40 transition-colors cursor-pointer"
      onClick={() => window.open(pair.url, "_blank")}
    >
      {/* Row 1: token info + price */}
      <div className="flex items-center gap-2.5 mb-2">
        <span className="text-[10px] text-muted-foreground font-mono w-5 shrink-0">#{rank}</span>
        {pair.info?.imageUrl ? (
          <img
            src={pair.info.imageUrl}
            alt=""
            className="w-8 h-8 rounded-full bg-muted shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
            {pair.baseToken.symbol.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-foreground text-sm truncate">
              {pair.baseToken.symbol}
            </span>
            <span className="text-xs text-muted-foreground">/{pair.quoteToken.symbol}</span>
            {pair.boosts && pair.boosts.active > 0 && (
              <span className="text-xs text-warning font-bold">⚡{pair.boosts.active}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] px-1 py-0.5 rounded bg-secondary text-secondary-foreground uppercase font-medium">
              {pair.dexId}
            </span>
            <span className="text-[10px] text-muted-foreground">{pair.chainId}</span>
            <span className="text-[10px] text-primary font-mono">{formatAge(pair.pairCreatedAt)}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-sm text-foreground">{formatPrice(pair.priceUsd)}</div>
          <div className="mt-0.5">
            <PriceChangeBadge value={pair.priceChange?.h24} />
          </div>
        </div>
      </div>

      {/* Row 2: stats grid */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs ml-[52px]">
        <div>
          <span className="text-muted-foreground">MCAP </span>
          <span className="font-mono text-foreground">
            {pair.marketCap ? formatNumber(pair.marketCap) : pair.fdv ? formatNumber(pair.fdv) : "-"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Vol </span>
          <span className="font-mono text-foreground">{formatNumber(pair.volume?.h24)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Liq </span>
          <span className="font-mono text-foreground">{formatNumber(pair.liquidity?.usd)}</span>
        </div>
        <div>
          <span className="text-gain font-mono">{formatCompact(totalBuys)}</span>
          <span className="text-muted-foreground mx-1">/</span>
          <span className="text-loss font-mono">{formatCompact(totalSells)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">1H </span>
          <PriceChangeBadge value={pair.priceChange?.h1} />
        </div>
        <div>
          <span className="text-muted-foreground">5M </span>
          <PriceChangeBadge value={pair.priceChange?.m5} />
        </div>
      </div>
    </div>
  );
}

/* ── Desktop table row ────────────────────────── */
function TokenRow({ pair, rank }: { pair: DexPair; rank: number }) {
  const totalBuys = pair.txns?.h24?.buys ?? 0;
  const totalSells = pair.txns?.h24?.sells ?? 0;
  const makers = totalBuys + totalSells;

  return (
    <tr
      className="border-b border-border hover:bg-accent/50 transition-colors cursor-pointer group"
      onClick={() => window.open(pair.url, "_blank")}
    >
      <td className="px-3 py-2 text-muted-foreground font-mono text-xs">#{rank}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2 min-w-[160px]">
          {pair.info?.imageUrl ? (
            <img
              src={pair.info.imageUrl}
              alt=""
              className="w-7 h-7 rounded-full bg-muted shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
              {pair.baseToken.symbol.charAt(0)}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {pair.baseToken.symbol}
              </span>
              <span className="text-xs text-muted-foreground">/{pair.quoteToken.symbol}</span>
              {pair.boosts && pair.boosts.active > 0 && (
                <span className="text-xs text-warning font-bold">⚡{pair.boosts.active}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] px-1 py-0.5 rounded bg-secondary text-secondary-foreground uppercase font-medium">
                {pair.dexId}
              </span>
              <span className="text-[10px] text-muted-foreground">{pair.chainId}</span>
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
        {formatNumber(pair.volume?.h24)}
      </td>
      <td className="px-3 py-2 text-right font-mono text-sm text-foreground">
        {formatCompact(makers)}
      </td>
      <PriceChangeCell value={pair.priceChange?.m5} />
      <PriceChangeCell value={pair.priceChange?.h1} />
      <PriceChangeCell value={pair.priceChange?.h6} />
      <PriceChangeCell value={pair.priceChange?.h24} />
      <td className="px-3 py-2 text-right font-mono text-sm text-foreground">
        {formatNumber(pair.liquidity?.usd)}
      </td>
    </tr>
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

export default function TokenTable({ pairs, loading }: TokenTableProps) {
  if (loading && pairs.length === 0) {
    return (
      <>
        {/* Mobile skeleton */}
        <div className="sm:hidden">
          {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        {/* Desktop skeleton */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <TableHeader />
            <tbody>
              {/* Skeleton rows — widths cycle through a range to look natural */}
      {Array.from({ length: 20 }).map((_, i) => <SkeletonRow key={i} />)}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (pairs.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <span className="text-4xl">🔍</span>
        <p className="text-sm">No pairs found. Data will refresh automatically.</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile card list */}
      <div className="sm:hidden">
        {pairs.map((pair, index) => (
          <TokenCard key={pair.pairAddress} pair={pair} rank={index + 1} />
        ))}
      </div>

      {/* Desktop / tablet table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <TableHeader />
          <tbody>
            {pairs.map((pair, index) => (
              <TokenRow key={pair.pairAddress} pair={pair} rank={index + 1} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
