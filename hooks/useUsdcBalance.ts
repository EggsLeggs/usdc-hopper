"use client";

import { formatUnits, erc20Abi } from "viem";
import { useReadContract } from "wagmi";

import type { HopperNetwork } from "@/lib/chains";

export function useUsdcBalance(network: HopperNetwork, address?: string) {
  const result = useReadContract({
    address: network.usdcAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    chainId: network.chainId,
    query: {
      enabled: Boolean(address),
      refetchInterval: 20_000,
    },
  });

  const formatted =
    address && result.data
      ? Number(formatUnits(result.data as bigint, 6))
      : 0;

  return {
    ...result,
    formatted,
  };
}

