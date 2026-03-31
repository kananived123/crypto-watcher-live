import { useState, useEffect, useCallback, useRef } from "react";
import { DexPair, fetchLatestProfiles, fetchPairsByToken } from "@/lib/dexscreener";

export function useNewPairs(refreshInterval = 3000) {
  const [pairs, setPairs] = useState<DexPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const seenPairs = useRef<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      // Get latest token profiles
      const profiles = await fetchLatestProfiles();

      // Group by chain and fetch pair data for each
      const uniqueTokens = new Map<string, { chainId: string; tokenAddress: string }>();
      for (const p of profiles.slice(0, 30)) {
        const key = `${p.chainId}:${p.tokenAddress}`;
        if (!uniqueTokens.has(key)) {
          uniqueTokens.set(key, { chainId: p.chainId, tokenAddress: p.tokenAddress });
        }
      }

      // Fetch pairs for each token (batch 5 at a time to avoid rate limits)
      const tokens = Array.from(uniqueTokens.values());
      const allPairs: DexPair[] = [];
      
      const batchSize = 5;
      for (let i = 0; i < Math.min(tokens.length, 20); i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(t => fetchPairsByToken(t.chainId, t.tokenAddress))
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) {
            allPairs.push(...r.value);
          }
        }
      }

      // Deduplicate and sort by creation time (newest first)
      const deduped = new Map<string, DexPair>();
      for (const pair of allPairs) {
        const key = pair.pairAddress;
        if (!deduped.has(key)) {
          deduped.set(key, pair);
        }
      }

      const sorted = Array.from(deduped.values())
        .sort((a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));

      setPairs(sorted);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  return { pairs, loading, error, lastUpdated, refetch: fetchData };
}
