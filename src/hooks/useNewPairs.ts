import { useState, useEffect, useCallback, useRef } from "react";
import { DexPair, fetchLatestProfiles, fetchPairsByToken, fetchNewPairsForChain } from "@/lib/dexscreener";

export type TabType = "new" | "trending" | "gainers" | "top";
export type TimeFilterType = "newest" | "5m" | "1h" | "6h" | "24h" | "3d" | "7d";

function sortPairs(pairs: DexPair[], tab: TabType, timeFilter: TimeFilterType): DexPair[] {
  const list = [...pairs];
  switch (tab) {
    case "new":
      return list.sort((a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));
    case "trending": {
      const vol = (p: DexPair) => {
        if (timeFilter === "5m") return p.volume?.m5 || 0;
        if (timeFilter === "1h") return p.volume?.h1 || 0;
        if (timeFilter === "6h") return p.volume?.h6 || 0;
        return p.volume?.h24 || 0;
      };
      return list.sort((a, b) => vol(b) - vol(a));
    }
    case "gainers": {
      const chg = (p: DexPair) => {
        if (timeFilter === "5m") return p.priceChange?.m5 || 0;
        if (timeFilter === "1h") return p.priceChange?.h1 || 0;
        if (timeFilter === "6h") return p.priceChange?.h6 || 0;
        return p.priceChange?.h24 || 0;
      };
      return list.sort((a, b) => chg(b) - chg(a));
    }
    case "top":
      return list.sort((a, b) => ((b.marketCap || b.fdv || 0) - (a.marketCap || a.fdv || 0)));
    default:
      return list;
  }
}

export function useNewPairs(
  refreshInterval = 5000,
  chainId: string | null = null,
  tab: TabType = "new",
  timeFilter: TimeFilterType = "newest"
) {
  const [pairs, setPairs] = useState<DexPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isFetching = useRef(false);

  const fetchData = useCallback(async (manual = false) => {
    if (isFetching.current) return;
    isFetching.current = true;
    if (manual) setRefreshing(true);

    try {
      let allPairs: DexPair[] = [];

      if (chainId) {
        // Chain-specific: first try chain search, then supplement with profiles
        const [chainPairs, profiles] = await Promise.allSettled([
          fetchNewPairsForChain(chainId),
          fetchLatestProfiles(),
        ]);

        if (chainPairs.status === "fulfilled") {
          allPairs.push(...chainPairs.value);
        }

        if (profiles.status === "fulfilled") {
          const chainProfiles = profiles.value
            .filter((p) => p.chainId === chainId)
            .slice(0, 15);
          const batchResults = await Promise.allSettled(
            chainProfiles.map((p) => fetchPairsByToken(p.chainId, p.tokenAddress))
          );
          for (const r of batchResults) {
            if (r.status === "fulfilled" && r.value) allPairs.push(...r.value);
          }
        }
      } else {
        // All chains: use latest profiles
        const profiles = await fetchLatestProfiles();
        const uniqueTokens = new Map<string, { chainId: string; tokenAddress: string }>();
        for (const p of profiles.slice(0, 30)) {
          const key = `${p.chainId}:${p.tokenAddress}`;
          if (!uniqueTokens.has(key)) {
            uniqueTokens.set(key, { chainId: p.chainId, tokenAddress: p.tokenAddress });
          }
        }
        const tokens = Array.from(uniqueTokens.values());
        const batchSize = 5;
        for (let i = 0; i < Math.min(tokens.length, 25); i += batchSize) {
          const batch = tokens.slice(i, i + batchSize);
          const results = await Promise.allSettled(
            batch.map((t) => fetchPairsByToken(t.chainId, t.tokenAddress))
          );
          for (const r of results) {
            if (r.status === "fulfilled" && r.value) allPairs.push(...r.value);
          }
        }
      }

      // Deduplicate
      const deduped = new Map<string, DexPair>();
      for (const pair of allPairs) {
        if (pair.pairAddress && !deduped.has(pair.pairAddress)) {
          deduped.set(pair.pairAddress, pair);
        }
      }

      const sorted = sortPairs(Array.from(deduped.values()), tab, timeFilter);
      setPairs(sorted);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetching.current = false;
    }
  }, [chainId, tab, timeFilter]);

  const manualRefresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Re-fetch immediately when chain/tab/filter changes (fetchData is memoized on those values)
  useEffect(() => {
    setLoading(true);
    setPairs([]);
    fetchData();
  }, [fetchData]);

  // Auto-refresh interval
  useEffect(() => {
    const interval = setInterval(() => fetchData(), refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  return { pairs, loading, error, lastUpdated, refreshing, refetch: manualRefresh };
}
