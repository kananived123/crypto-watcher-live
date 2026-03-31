import { CHAINS } from "@/lib/dexscreener";

interface ChainSidebarProps {
  selectedChain: string | null;
  onSelectChain: (chain: string | null) => void;
  open: boolean;
  onClose: () => void;
}

export default function ChainSidebar({ selectedChain, onSelectChain, open, onClose }: ChainSidebarProps) {
  const content = (
    <div className="p-2 sm:p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-2 pb-2">
        Chains
      </p>
      <button
        onClick={() => onSelectChain(null)}
        className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors mb-0.5 ${
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
          className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 mb-0.5 ${
            selectedChain === chain.id
              ? "bg-primary/15 text-primary font-medium"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          }`}
        >
          <span className="text-base w-5 text-center shrink-0">{chain.icon}</span>
          <span className="truncate">{chain.name}</span>
        </button>
      ))}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-48 border-r border-border bg-sidebar shrink-0 overflow-y-auto">
        {content}
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 z-50 h-full w-64 bg-sidebar border-r border-border overflow-y-auto transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <span className="text-sm font-semibold text-foreground">Select Chain</span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>
        {content}
      </aside>
    </>
  );
}
