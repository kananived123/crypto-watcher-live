import { Search } from "lucide-react";
import { useState } from "react";

interface ScannerHeaderProps {
  lastUpdated: Date | null;
  pairCount: number;
  onSearch: (query: string) => void;
}

export default function ScannerHeader({ lastUpdated, pairCount, onSearch }: ScannerHeaderProps) {
  const [searchValue, setSearchValue] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchValue);
  };

  return (
    <header className="border-b border-border bg-card">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            <span className="text-primary">DEX</span>SCANNER
          </h1>
          <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
            <span className="animate-pulse-live inline-block w-2 h-2 rounded-full bg-primary mr-1" />
            LIVE
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search token or paste address..."
              className="bg-secondary border border-border rounded-md pl-9 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-64 md:w-80"
            />
          </div>
        </form>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 font-medium"
            title="Refresh now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <span className="hidden md:inline">{pairCount} pairs</span>
          {lastUpdated && (
            <span className="hidden md:inline">{lastUpdated.toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-1.5 overflow-x-auto">
        <TabButton active>🆕 New Pairs</TabButton>
        <TabButton>🔥 Trending</TabButton>
        <TabButton>📈 Gainers</TabButton>
        <TabButton>🏆 Top</TabButton>
        <div className="flex-1" />
        <div className="flex items-center gap-1 text-xs">
          <TimeFilter active>Newest</TimeFilter>
          <TimeFilter>1H</TimeFilter>
          <TimeFilter>6H</TimeFilter>
          <TimeFilter>24H</TimeFilter>
          <TimeFilter>3D</TimeFilter>
          <TimeFilter>7D</TimeFilter>
        </div>
      </div>
    </header>
  );
}

function TabButton({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function TimeFilter({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
        active
          ? "bg-primary/20 text-primary border border-primary/30"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
