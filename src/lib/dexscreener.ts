const BASE_URL = "https://api.dexscreener.com";

export interface TokenProfile {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  description?: string;
  links?: { label?: string; type?: string; url: string }[];
}

export interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd?: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  priceChange: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
    websites?: { label: string; url: string }[];
    socials?: { type: string; url: string }[];
  };
  boosts?: { active: number };
}

export async function fetchLatestProfiles(): Promise<TokenProfile[]> {
  const res = await fetch(`${BASE_URL}/token-profiles/latest/v1`);
  if (!res.ok) throw new Error("Failed to fetch profiles");
  return res.json();
}

export async function fetchLatestBoosted(): Promise<TokenProfile[]> {
  const res = await fetch(`${BASE_URL}/token-boosts/latest/v1`);
  if (!res.ok) throw new Error("Failed to fetch boosted");
  return res.json();
}

export async function fetchPairsByToken(chainId: string, tokenAddress: string): Promise<DexPair[]> {
  const res = await fetch(`${BASE_URL}/token-pairs/v1/${chainId}/${tokenAddress}`);
  if (!res.ok) throw new Error("Failed to fetch pairs");
  const data = await res.json();
  return data || [];
}

export async function searchPairs(query: string): Promise<DexPair[]> {
  const res = await fetch(`${BASE_URL}/latest/dex/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Failed to search");
  const data = await res.json();
  return data.pairs || [];
}

export async function fetchNewPairsForChain(chainId: string): Promise<DexPair[]> {
  const res = await fetch(`${BASE_URL}/latest/dex/search?q=${encodeURIComponent(chainId)}`);
  if (!res.ok) throw new Error("Failed to fetch pairs");
  const data = await res.json();
  return (data.pairs || []).filter((p: DexPair) => p.chainId === chainId);
}

export async function fetchLatestProfilesForChain(chainId: string): Promise<TokenProfile[]> {
  const all = await fetchLatestProfiles();
  return all.filter((p) => p.chainId === chainId);
}

export function formatNumber(num: number | undefined | null): string {
  if (num == null || isNaN(num)) return "-";
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
  if (num < 0.01 && num > 0) return `$${num.toFixed(6)}`;
  return `$${num.toFixed(2)}`;
}

export function formatPrice(price: string | undefined): string {
  if (!price) return "-";
  const num = parseFloat(price);
  if (isNaN(num)) return "-";
  if (num < 0.000001) return `$${num.toExponential(2)}`;
  if (num < 0.01) return `$${num.toFixed(8)}`;
  if (num < 1) return `$${num.toFixed(4)}`;
  return `$${num.toFixed(2)}`;
}

export function formatAge(timestamp: number | undefined): string {
  if (!timestamp) return "-";
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function formatCompact(num: number | undefined | null): string {
  if (num == null || isNaN(num)) return "-";
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

export const CHAINS = [
  { id: "solana", name: "Solana", icon: "◎" },
  { id: "bsc", name: "BSC", icon: "⛓" },
  { id: "base", name: "Base", icon: "🔵" },
  { id: "polygon", name: "Polygon", icon: "⬡" },
  { id: "ethereum", name: "Ethereum", icon: "⟠" },
  { id: "pulsechain", name: "PulseChain", icon: "💗" },
  { id: "hyperliquid", name: "Hyperliquid", icon: "⚡" },
  { id: "ton", name: "TON", icon: "💎" },
  { id: "sui", name: "Sui", icon: "🌊" },
  { id: "xrpl", name: "XRPL", icon: "✕" },
  { id: "avalanche", name: "Avalanche", icon: "🔺" },
  { id: "cronos", name: "Cronos", icon: "🔶" },
  { id: "arbitrum", name: "Arbitrum", icon: "🔷" },
  { id: "hedera", name: "Hedera", icon: "ℏ" },
  { id: "abstract", name: "Abstract", icon: "🎨" },
  { id: "osmosis", name: "Osmosis", icon: "🧪" },
  { id: "hyperevm", name: "HyperEVM", icon: "🌐" },
  { id: "worldchain", name: "World Chain", icon: "🌍" },
  { id: "monad", name: "Monad", icon: "🟣" },
  { id: "sonic", name: "Sonic", icon: "🦔" },
  { id: "tron", name: "Tron", icon: "🔴" },
  { id: "near", name: "NEAR", icon: "🌐" },
  { id: "linea", name: "Linea", icon: "📐" },
  { id: "optimism", name: "Optimism", icon: "🔴" },
  { id: "fogo", name: "Fogo", icon: "🔥" },
  { id: "megaeth", name: "MegaETH", icon: "⚡" },
  { id: "plasma", name: "Plasma", icon: "🌀" },
  { id: "berachain", name: "Berachain", icon: "🐻" },
  { id: "ink", name: "Ink", icon: "🖊" },
  { id: "multiversx", name: "MultiversX", icon: "✳" },
  { id: "mantle", name: "Mantle", icon: "🏔" },
  { id: "cardano", name: "Cardano", icon: "🅰" },
  { id: "fantom", name: "Fantom", icon: "👻" },
  { id: "sei", name: "Sei V2", icon: "🔵" },
  { id: "aptos", name: "Aptos", icon: "🅰" },
  { id: "zksync", name: "zkSync", icon: "⚡" },
  { id: "apechain", name: "ApeChain", icon: "🦍" },
  { id: "flare", name: "Flare", icon: "✨" },
  { id: "katana", name: "Katana", icon: "⚔" },
  { id: "soneium", name: "Soneium", icon: "🎵" },
  { id: "starknet", name: "Starknet", icon: "⭐" },
  { id: "algorand", name: "Algorand", icon: "🔺" },
  { id: "story", name: "Story", icon: "📖" },
  { id: "dogechain", name: "Dogechain", icon: "🐕" },
  { id: "polkadot", name: "Polkadot", icon: "⚫" },
  { id: "celo", name: "Celo", icon: "🌿" },
  { id: "blast", name: "Blast", icon: "💥" },
  { id: "unichain", name: "Unichain", icon: "🦄" },
  { id: "metis", name: "Metis", icon: "🌊" },
  { id: "flow", name: "Flow EVM", icon: "🌊" },
  { id: "scroll", name: "Scroll", icon: "📜" },
  { id: "injective", name: "Injective", icon: "💉" },
  { id: "dfk", name: "Avalanche DFK", icon: "🏰" },
  { id: "harmony", name: "Harmony", icon: "🔵" },
  { id: "conflux", name: "Conflux", icon: "🌀" },
  { id: "energi", name: "Energi", icon: "⚡" },
  { id: "iotex", name: "IoTeX", icon: "🔗" },
  { id: "opbnb", name: "opBNB", icon: "🟡" },
  { id: "ethpow", name: "EthereumPoW", icon: "⛏" },
  { id: "merlin", name: "Merlin Chain", icon: "🧙" },
  { id: "beam", name: "Beam", icon: "🔦" },
  { id: "stacks", name: "Stacks", icon: "📦" },
  { id: "etc", name: "Ethereum Classic", icon: "🏛" },
  { id: "kava", name: "Kava", icon: "🌊" },
  { id: "manta", name: "Manta", icon: "🦈" },
  { id: "astar", name: "Astar", icon: "⭐" },
  { id: "aurora", name: "Aurora", icon: "🌅" },
  { id: "vana", name: "Vana", icon: "💧" },
  { id: "arbitrumnova", name: "Arbitrum Nova", icon: "🔷" },
  { id: "mode", name: "Mode", icon: "🎵" },
  { id: "taiko", name: "Taiko", icon: "🥁" },
  { id: "moonbeam", name: "Moonbeam", icon: "🌙" },
  { id: "zora", name: "Zora", icon: "🎨" },
  { id: "sapphire", name: "Oasis Sapphire", icon: "💎" },
  { id: "zircuit", name: "Zircuit", icon: "⚡" },
  { id: "elastos", name: "Elastos", icon: "🔗" },
  { id: "telos", name: "Telos", icon: "🌐" },
  { id: "movement", name: "Movement", icon: "🏃" },
  { id: "kcc", name: "KCC", icon: "🔗" },
  { id: "moonriver", name: "Moonriver", icon: "🌙" },
  { id: "neon", name: "Neon EVM", icon: "💡" },
  { id: "boba", name: "Boba", icon: "🧋" },
  { id: "step", name: "Step Network", icon: "👟" },
  { id: "venom", name: "Venom", icon: "☠" },
  { id: "zkfair", name: "ZKFair", icon: "⚡" },
  { id: "icp", name: "ICP", icon: "∞" },
  { id: "fuse", name: "Fuse", icon: "🔌" },
  { id: "meter", name: "Meter", icon: "📊" },
  { id: "emerald", name: "Oasis Emerald", icon: "💚" },
];
