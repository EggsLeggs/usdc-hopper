"use client";

import { useQuery } from "@tanstack/react-query";

import type { HopperNetwork } from "@/lib/chains";
import { arcClient } from "@/lib/arc";

type Params = {
  fromNetwork?: HopperNetwork;
  toNetwork?: HopperNetwork;
  amount: string;
  walletAddress?: string;
};

export function useArcQuote({
  fromNetwork,
  toNetwork,
  amount,
  walletAddress,
}: Params) {
  const sanitizedAmount = amount.trim();
  const enabled =
    Boolean(fromNetwork && toNetwork && walletAddress) &&
    fromNetwork?.id !== toNetwork?.id &&
    Number(sanitizedAmount) > 0;

  return useQuery({
    queryKey: [
      "arc-quote",
      fromNetwork?.id,
      toNetwork?.id,
      sanitizedAmount,
      walletAddress,
    ],
    enabled,
    staleTime: 30_000,
    queryFn: () =>
      arcClient.quote({
        fromNetwork: fromNetwork!,
        toNetwork: toNetwork!,
        amount: sanitizedAmount,
        walletAddress: walletAddress!,
      }),
  });
}

