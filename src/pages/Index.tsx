import { useState, useMemo } from "react";
import { useNewPairs, TabType, TimeFilterType } from "@/hooks/useNewPairs";
import { searchPairs, DexPair } from "@/lib/dexscreener";
import ScannerHeader from "@/components/ScannerHeader";
import ChainSidebar from "@/components/ChainSidebar";
import TokenTable from "@/components/TokenTable";
import StatsBar from "@/components/StatsBar";

const Index = () => {
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("new");
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>("newest");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<DexPair[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const { pairs, loading, lastUpdated, refreshing, refetch } = useNewPairs(
    5000,
    selectedChain,
    activeTab,
    timeFilter
  );

  const filteredPairs = useMemo(() => {
    return searchResults ?? pairs;
  }, [pairs, searchResults]);

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setSearchLoading(true);
    try {
      const results = await searchPairs(query);
      const filtered = selectedChain
        ? results.filter((p) => p.chainId === selectedChain)
        : results;
      setSearchResults(filtered);
    } catch {
      setSearchResults(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleChainSelect = (chain: string | null) => {
    setSelectedChain(chain);
    setSearchResults(null);
    setSidebarOpen(false);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchResults(null);
  };

  const handleTimeFilterChange = (filter: TimeFilterType) => {
    setTimeFilter(filter);
    setSearchResults(null);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <ScannerHeader
        lastUpdated={lastUpdated}
        pairCount={filteredPairs.length}
        onSearch={handleSearch}
        onRefresh={refetch}
        refreshing={refreshing}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        timeFilter={timeFilter}
        onTimeFilterChange={handleTimeFilterChange}
        sidebarOpen={sidebarOpen}
        onSidebarToggle={() => setSidebarOpen((o) => !o)}
        selectedChain={selectedChain}
      />
      <StatsBar pairs={filteredPairs} />
      <div className="flex flex-1 overflow-hidden relative">
        <ChainSidebar
          selectedChain={selectedChain}
          onSelectChain={handleChainSelect}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 overflow-y-auto">
          <TokenTable pairs={filteredPairs} loading={loading || searchLoading} />
        </main>
      </div>
    </div>
  );
};

export default Index;
