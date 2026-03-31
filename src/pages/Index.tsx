import { useState, useMemo } from "react";
import { useNewPairs } from "@/hooks/useNewPairs";
import { searchPairs, DexPair } from "@/lib/dexscreener";
import ScannerHeader from "@/components/ScannerHeader";
import ChainSidebar from "@/components/ChainSidebar";
import TokenTable from "@/components/TokenTable";
import StatsBar from "@/components/StatsBar";

const Index = () => {
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<DexPair[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const { pairs, loading, lastUpdated, refreshing, refetch } = useNewPairs(1000);

  const filteredPairs = useMemo(() => {
    const source = searchResults ?? pairs;
    if (!selectedChain) return source;
    return source.filter((p) => p.chainId === selectedChain);
  }, [pairs, searchResults, selectedChain]);

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setSearchLoading(true);
    try {
      const results = await searchPairs(query);
      setSearchResults(results);
    } catch {
      setSearchResults(null);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <ScannerHeader
        lastUpdated={lastUpdated}
        pairCount={filteredPairs.length}
        onSearch={handleSearch}
        onRefresh={refetch}
        refreshing={refreshing}
      />
      <StatsBar pairs={filteredPairs} />
      <div className="flex flex-1 overflow-hidden">
        <ChainSidebar selectedChain={selectedChain} onSelectChain={setSelectedChain} />
        <main className="flex-1 overflow-y-auto">
          <TokenTable pairs={filteredPairs} loading={loading || searchLoading} />
        </main>
      </div>
    </div>
  );
};

export default Index;
