const defaultRpcUrls = {
  11155111: "https://sepolia.drpc.org",
  84532: "https://sepolia.base.org",
  43113: "https://api.avax-test.network/ext/bc/C/rpc",
  5042002: "https://rpc.testnet.arc.network",
} as const;

export const env = {
  walletConnectProjectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  arcApiBase:
    process.env.NEXT_PUBLIC_ARC_API_BASE ?? "https://api.arc.market",
  arcApiKey: process.env.NEXT_PUBLIC_ARC_API_KEY,
  rpcUrls: {
    11155111:
      process.env.NEXT_PUBLIC_RPC_ETHEREUM_SEPOLIA ?? defaultRpcUrls[11155111],
    84532:
      process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA ?? defaultRpcUrls[84532],
    43113:
      process.env.NEXT_PUBLIC_RPC_AVALANCHE_FUJI ?? defaultRpcUrls[43113],
    5042002:
      process.env.NEXT_PUBLIC_RPC_ARC_TESTNET ?? defaultRpcUrls[5042002],
  },
} as const;

export type SupportedRpcChainId = keyof typeof defaultRpcUrls;

