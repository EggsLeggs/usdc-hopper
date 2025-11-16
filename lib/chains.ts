import type { ChainDefinition } from "@circle-fin/bridge-kit";
import { createPublicClient, defineChain, http, type Chain } from "viem";
import { baseSepolia, sepolia } from "viem/chains";

import { env } from "./env";
import { requireCircleChain } from "./bridgeKit";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  network: "arc-testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [env.rpcUrls[5042002]],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app",
    },
  },
});

export type HopperNetworkId =
  | "ethereum-sepolia"
  | "base-sepolia"
  | "arc-testnet";

export interface HopperNetwork {
  id: HopperNetworkId;
  label: string;
  sublabel: string;
  shortName: string;
  description: string;
  color: string;
  chainId: number;
  circleChain: ChainDefinition;
  wagmiChain: Chain;
  rpcUrl: string;
  blockExplorerUrl: string;
  explorerTxPattern: string;
  usdcAddress: `0x${string}`;
  circleDomain: number;
  cctpContracts: {
    tokenMessenger: `0x${string}`;
    messageTransmitter: `0x${string}`;
  };
}

type NetworkFactoryParams = {
  id: HopperNetworkId;
  label: string;
  sublabel: string;
  shortName: string;
  description: string;
  color: string;
  wagmiChain: Chain;
  circleKey: string;
  rpcEnvKey: keyof typeof env.rpcUrls;
};

function createNetwork({
  id,
  label,
  sublabel,
  shortName,
  description,
  color,
  wagmiChain,
  circleKey,
  rpcEnvKey,
}: NetworkFactoryParams): HopperNetwork {
  const circleChain = requireCircleChain(circleKey);
  const contracts = circleChain.cctp?.contracts?.v2;

  if (!contracts) {
    throw new Error(
      `No CCTP v2 contracts found for ${label}. Ensure this network supports Bridge Kit.`
    );
  }

  const rpcUrl = env.rpcUrls[rpcEnvKey];
  if (!rpcUrl) {
    throw new Error(
      `Missing RPC URL for ${label} (chain ${rpcEnvKey}). Set NEXT_PUBLIC_RPC_${rpcEnvKey} or update env.ts.`
    );
  }

  const circleChainIdRaw =
    typeof circleChain.chainId === "number"
      ? circleChain.chainId
      : Number(circleChain.chainId ?? circleChain.chain);

  if (Number.isFinite(circleChainIdRaw) && circleChainIdRaw !== wagmiChain.id) {
    throw new Error(
      `Circle chainId (${circleChainIdRaw}) does not match wagmi chain id (${wagmiChain.id}) for ${label}.`
    );
  }

  const explorerTxPattern =
    circleChain.explorerUrl ??
    (wagmiChain.blockExplorers?.default?.url
      ? `${wagmiChain.blockExplorers.default.url.replace(/\/$/, "")}/tx/{hash}`
      : "");

  const blockExplorerUrl = explorerTxPattern
    ? explorerTxPattern.replace("/tx/{hash}", "")
    : wagmiChain.blockExplorers?.default?.url ?? "";

  return {
    id,
    label,
    sublabel,
    shortName,
    description,
    color,
    chainId: circleChain.chainId ?? wagmiChain.id,
    wagmiChain,
    circleChain,
    rpcUrl,
    blockExplorerUrl,
    explorerTxPattern,
    usdcAddress: circleChain.usdcAddress as `0x${string}`,
    circleDomain: circleChain.cctp?.domain ?? 0,
    cctpContracts: {
      tokenMessenger: contracts.tokenMessenger as `0x${string}`,
      messageTransmitter: contracts.messageTransmitter as `0x${string}`,
    },
  };
}

export const supportedNetworks: HopperNetwork[] = [
  createNetwork({
    id: "ethereum-sepolia",
    label: "Ethereum Sepolia",
    sublabel: "Circle canonical testnet",
    shortName: "Sepolia",
    description: "Robust L1 staging ground for CCTP testing.",
    color: "#627EEA",
    wagmiChain: sepolia,
    circleKey: "Ethereum_Sepolia",
    rpcEnvKey: 11155111,
  }),
  createNetwork({
    id: "base-sepolia",
    label: "Base Sepolia",
    sublabel: "Fast, low-cost L2 from Coinbase",
    shortName: "Base",
    description: "Optimised for rapid settlement and developer tooling.",
    color: "#0052FF",
    wagmiChain: baseSepolia,
    circleKey: "Base_Sepolia",
    rpcEnvKey: 84532,
  }),
  createNetwork({
    id: "arc-testnet",
    label: "Arc Testnet",
    sublabel: "USDC-native L1 built by Circle",
    shortName: "Arc",
    description: "Stable-fee chain where USDC is the native gas asset.",
    color: "#0F172A",
    wagmiChain: arcTestnet,
    circleKey: "Arc_Testnet",
    rpcEnvKey: 5042002,
  }),
];

export const networkById: Record<HopperNetworkId, HopperNetwork> =
  supportedNetworks.reduce((acc, network) => {
    acc[network.id] = network;
    return acc;
  }, {} as Record<HopperNetworkId, HopperNetwork>);

export function getNetworkByChainId(
  chainId: number
): HopperNetwork | undefined {
  return supportedNetworks.find((network) => network.chainId === chainId);
}

export const defaultFromNetworkId: HopperNetworkId = "ethereum-sepolia";
export const defaultToNetworkId: HopperNetworkId = "arc-testnet";

const publicClients = new Map<number, ReturnType<typeof createPublicClient>>();

export function getPublicClient(chain: Chain) {
  if (!publicClients.has(chain.id)) {
    publicClients.set(
      chain.id,
      createPublicClient({
        chain,
        transport: http(chain.rpcUrls.default.http[0]!),
      })
    );
  }

  return publicClients.get(chain.id)!;
}
