import { Search, RefreshCw, Menu, X, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { TabType, TimeFilterType } from "@/hooks/useNewPairs";
import { CHAINS } from "@/lib/dexscreener";

interface ScannerHeaderProps {
  lastUpdated: Date | null;
  pairCount: number;
  onSearch: (query: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  timeFilter: TimeFilterType;
  onTimeFilterChange: (filter: TimeFilterType) => void;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
  selectedChain: string | null;
}

const TABS: { id: TabType; label: string }[] = [
  { id: "new", label: "🆕 New Pairs" },
  { id: "trending", label: "🔥 Trending" },
  { id: "gainers", label: "📈 Gainers" },
  { id: "top", label: "🏆 Top" },
];

const TIME_FILTERS: { id: TimeFilterType; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "5m", label: "5M" },
  { id: "1h", label: "1H" },
  { id: "6h", label: "6H" },
  { id: "24h", label: "24H" },
  { id: "3d", label: "3D" },
  { id: "7d", label: "7D" },
];

export default function ScannerHeader({
  lastUpdated,
  pairCount,
  onSearch,
  onRefresh,
  refreshing,
  activeTab,
  onTabChange,
  timeFilter,
  onTimeFilterChange,
  sidebarOpen,
  onSidebarToggle,
  selectedChain,
}: ScannerHeaderProps) {
  const [searchValue, setSearchValue] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchValue);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    if (!e.target.value.trim()) onSearch("");
  };

  const selectedChainLabel = selectedChain
    ? CHAINS.find((c) => c.id === selectedChain)?.name ?? selectedChain
    : null;

  return (
    <header className="border-b border-border bg-card shrink-0">
      {/* ── Top bar ────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-border">
        {/* Hamburger (mobile only) */}
        <button
          onClick={onSidebarToggle}
          className="lg:hidden flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
          aria-label="Toggle chain sidebar"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
            <span className="text-primary">DEX</span>SCANNER
          </h1>
          <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <span className="animate-pulse-live inline-block w-2 h-2 rounded-full bg-primary" />
            LIVE
          </span>
        </div>

        {/* Active chain badge */}
        {selectedChainLabel && (
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-semibold border border-primary/25 shrink-0">
            {selectedChainLabel}
            <ChevronDown className="w-3 h-3 opacity-60" />
          </span>
        )}

        {/* Search — desktop */}
        <form
          onSubmit={handleSearch}
          className="hidden md:flex flex-1 items-center max-w-sm xl:max-w-md mx-auto"
        >
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchValue}
              onChange={handleSearchChange}
              placeholder="Search token or paste address…"
              className="w-full bg-secondary border border-border rounded-md pl-9 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => { setSearchValue(""); onSearch(""); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          {/* Mobile search toggle */}
          <button
            onClick={() => setSearchOpen((o) => !o)}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 font-medium text-xs"
            title="Refresh now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Stats */}
          <div className="hidden lg:flex items-center gap-3 text-xs text-muted-foreground">
            <span>{pairCount} pairs</span>
            {lastUpdated && <span>{lastUpdated.toLocaleTimeString()}</span>}
          </div>
        </div>
      </div>

      {/* ── Mobile search bar (expandable) ─────────── */}
      {searchOpen && (
        <div className="md:hidden px-3 py-2 border-b border-border bg-card">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={searchValue}
                onChange={handleSearchChange}
                placeholder="Search token or paste address…"
                className="w-full bg-secondary border border-border rounded-md pl-9 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {searchValue && (
              <button
                type="button"
                onClick={() => { setSearchValue(""); onSearch(""); }}
                className="text-muted-foreground hover:text-foreground p-1.5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>
        </div>
      )}

      {/* ── Tabs + time filters ─────────────────────── */}
      <div className="flex items-center gap-1 px-3 sm:px-4 py-1.5 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === t.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1 min-w-2" />
        <div className="flex items-center gap-0.5 shrink-0">
          {TIME_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => onTimeFilterChange(f.id)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                timeFilter === f.id
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
