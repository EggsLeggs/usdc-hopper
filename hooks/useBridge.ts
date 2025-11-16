"use client";

import { useCallback, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { createAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import type { BridgeResult } from "@circle-fin/bridge-kit";
import type { EIP1193Provider } from "viem";
import { createPublicClient, formatUnits, http } from "viem";

import { bridgeKit } from "@/lib/bridgeKit";
import {
  getNetworkByChainId,
  networkById,
  supportedNetworks,
} from "@/lib/chains";

export type BridgeToken = "USDC";

export type BridgeStep =
  | "idle"
  | "switching-network"
  | "approving"
  | "signing-bridge"
  | "waiting-receive-message"
  | "success"
  | "error";

export interface BridgeDirection {
  fromChainId: number;
  toChainId: number;
}

export interface BridgeState {
  step: BridgeStep;
  error: string | null;
  result: BridgeResult | null;
  isLoading: boolean;
  sourceTxHash?: string;
  receiveTxHash?: string;
  direction?: BridgeDirection;
}

export interface BridgeExecutionResult {
  amount: string;
  direction: BridgeDirection;
  result: BridgeResult;
  sourceTxHash?: string;
  receiveTxHash?: string;
}

type TokenInfo = {
  symbol: string;
  name: string;
  decimals: number;
  contractAddress: `0x${string}`;
};

export const CHAIN_TOKENS: Record<
  number,
  Record<BridgeToken, TokenInfo>
> = supportedNetworks.reduce((acc, network) => {
  acc[network.chainId] = {
    USDC: {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      contractAddress: network.usdcAddress,
    },
  };
  return acc;
}, {} as Record<number, Record<BridgeToken, TokenInfo>>);

export const SEPOLIA_CHAIN_ID = networkById["ethereum-sepolia"].chainId;
export const BASE_SEPOLIA_CHAIN_ID = networkById["base-sepolia"].chainId;
export const ARC_CHAIN_ID = networkById["arc-testnet"].chainId;

const RPC_FALLBACKS: Record<number, string[]> = {
  [SEPOLIA_CHAIN_ID]: [
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://rpc.sepolia.org",
    "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
  ],
  [BASE_SEPOLIA_CHAIN_ID]: [
    "https://sepolia.base.org",
    "https://base-sepolia.blockpi.network/v1/rpc/public",
  ],
  [ARC_CHAIN_ID]: [
    "https://rpc.testnet.arc.network/",
    "https://rpc.testnet.arc.network",
  ],
};

const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
] as const;

type RpcClient = ReturnType<typeof createPublicClient>;

const rpcClientCache = new Map<string, RpcClient>();

function getRpcCandidates(chainId: number) {
  const network = getNetworkByChainId(chainId);
  const defaults = RPC_FALLBACKS[chainId] ?? [];
  const primary = network?.rpcUrl ? [network.rpcUrl] : [];
  const merged = [...primary, ...defaults].filter(Boolean);
  const unique = Array.from(new Set(merged));
  if (!unique.length) {
    throw new Error(`No RPC endpoints configured for chain ${chainId}`);
  }
  return unique;
}

async function getPublicRpcClient(chainId: number): Promise<RpcClient> {
  const candidates = getRpcCandidates(chainId);
  let lastError: unknown;

  for (const rpcUrl of candidates) {
    if (rpcClientCache.has(rpcUrl)) {
      return rpcClientCache.get(rpcUrl)!;
    }

    try {
      const network = getNetworkByChainId(chainId);
      if (!network) {
        throw new Error(`Unsupported chain ${chainId}`);
      }

      const client = createPublicClient({
        chain: network.wagmiChain,
        transport: http(rpcUrl, {
          retryCount: 2,
          timeout: 8000,
        }),
      });

      await client.getBlockNumber();
      rpcClientCache.set(rpcUrl, client);
      return client;
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Failed to connect to RPC (${chainId}): ${message}`);
}

export function useBridge() {
  const { address, connector, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();

  const [state, setState] = useState<BridgeState>({
    step: "idle",
    error: null,
    result: null,
    isLoading: false,
  });

  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string>("");

  const fetchTokenBalance = useCallback(
    async (token: BridgeToken, sourceChainId: number) => {
      if (!address) return;

      setIsLoadingBalance(true);
      setBalanceError("");

      try {
        const chainTokens = CHAIN_TOKENS[sourceChainId];
        if (!chainTokens) {
          throw new Error(`Chain ${sourceChainId} not supported`);
        }

        const tokenInfo = chainTokens[token];
        const client = await getPublicRpcClient(sourceChainId);
        const balance = await client.readContract({
          address: tokenInfo.contractAddress,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        });

        const formatted = formatUnits(balance as bigint, tokenInfo.decimals);
        setTokenBalance(formatted);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to fetch balance.";
        console.error(`[Bridge] Balance error (${sourceChainId}):`, message);
        setTokenBalance("0");
        setBalanceError(message);
      } finally {
        setIsLoadingBalance(false);
      }
    },
    [address]
  );

  const reset = useCallback(() => {
    setState({
      step: "idle",
      error: null,
      result: null,
      isLoading: false,
      sourceTxHash: undefined,
      receiveTxHash: undefined,
      direction: undefined,
    });
    setTokenBalance("0");
    setBalanceError("");
  }, []);

  const bridge = useCallback(
    async ({
      token,
      amount,
      direction,
    }: {
      token: BridgeToken;
      amount: string;
      direction: BridgeDirection;
    }): Promise<BridgeExecutionResult> => {
      if (!isConnected || !address) {
        throw new Error("Connect MetaMask to bridge USDC.");
      }

      if (!amount || Number(amount) <= 0) {
        throw new Error(`Enter a valid ${token} amount to bridge.`);
      }

      const { fromChainId, toChainId } = direction;
      if (fromChainId === toChainId) {
        throw new Error("Select two different networks to bridge between.");
      }

      const fromNetwork = getNetworkByChainId(fromChainId);
      const toNetwork = getNetworkByChainId(toChainId);

      if (!fromNetwork || !toNetwork) {
        throw new Error("One of the selected chains is not supported.");
      }

      try {
        setState((prev) => ({
          ...prev,
          step: "idle",
          error: null,
          isLoading: true,
        }));

        let provider: EIP1193Provider | undefined;
        if (connector) {
          provider = (await connector.getProvider()) as EIP1193Provider;
        } else if (typeof window !== "undefined" && window.ethereum) {
          provider = window.ethereum as EIP1193Provider;
        }

        if (!provider) {
          throw new Error("MetaMask provider not detected.");
        }

        if (chainId !== fromChainId) {
          setState((prev) => ({ ...prev, step: "switching-network" }));
          await switchChain({ chainId: fromChainId });
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        setState((prev) => ({ ...prev, step: "approving" }));

        const adapter = await createAdapterFromProvider({ provider });

        const result = await bridgeKit.bridge({
          from: {
            adapter,
            chain: fromNetwork.circleChain,
          },
          to: {
            adapter,
            chain: toNetwork.circleChain,
            recipientAddress: address,
          },
          amount,
        });

        const { sourceTxHash, receiveTxHash } = result.steps.reduce(
          (acc, step) => {
            if (step.name === "burn" && step.txHash) {
              acc.sourceTxHash = step.txHash;
            }
            if (step.name === "mint" && step.txHash) {
              acc.receiveTxHash = step.txHash;
            }
            if (!acc.sourceTxHash && step.name === "approve" && step.txHash) {
              acc.sourceTxHash = step.txHash;
            }
            return acc;
          },
          {
            sourceTxHash: undefined as string | undefined,
            receiveTxHash: undefined as string | undefined,
          }
        );

        setState({
          step: "success",
          error: null,
          result,
          isLoading: false,
          sourceTxHash,
          receiveTxHash,
          direction,
        });

        return {
          amount,
          direction,
          result,
          sourceTxHash,
          receiveTxHash,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Bridge transaction failed.";
        setState({
          step: "error",
          error: message,
          result: null,
          isLoading: false,
        });
        throw error;
      }
    },
    [address, chainId, connector, isConnected, switchChain]
  );

  return {
    state,
    tokenBalance,
    isLoadingBalance,
    balanceError,
    fetchTokenBalance,
    bridge,
    reset,
    currentChainId: chainId,
  };
}

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}
