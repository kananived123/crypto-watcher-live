import { CHAINS } from "@/lib/dexscreener";

interface ChainSidebarProps {
  selectedChain: string | null;
  onSelectChain: (chain: string | null) => void;
}

export default function ChainSidebar({ selectedChain, onSelectChain }: ChainSidebarProps) {
  return (
    <aside className="w-48 border-r border-border bg-sidebar shrink-0 overflow-y-auto hidden lg:block">
      <div className="p-3">
        <button
          onClick={() => onSelectChain(null)}
          className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors mb-1 ${
            selectedChain === null
              ? "bg-primary/15 text-primary"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          }`}
        >
          🌐 All Chains
        </button>
        {CHAINS.map((chain) => (
          <button
            key={chain.id}
            onClick={() => onSelectChain(chain.id)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
              selectedChain === chain.id
                ? "bg-primary/15 text-primary font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <span className="text-base">{chain.icon}</span>
            {chain.name}
          </button>
        ))}
      </div>
    </aside>
  );
}
