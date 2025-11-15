"use client";

import { useCallback, useState } from "react";
import { createAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import type { BridgeResult } from "@circle-fin/bridge-kit";
import { useAccount } from "wagmi";

import type { ArcRouteQuote } from "@/lib/arc";
import type { HopperNetwork } from "@/lib/chains";
import { bridgeKit } from "@/lib/bridgeKit";
import type {
  StoredTransfer,
  TransferStepRecord,
  TransferStatus,
} from "@/lib/storage";

type BridgeRequest = {
  fromNetwork: HopperNetwork;
  toNetwork: HopperNetwork;
  amount: string;
  quote?: ArcRouteQuote;
  recipient?: string;
};

type UseBridgeOptions = {
  persistTransfer: (record: StoredTransfer) => void;
};

type BridgeUiState =
  | {
      status: "idle";
      steps: TransferStepRecord[];
    }
  | {
      status: "pending";
      steps: TransferStepRecord[];
      message?: string;
    }
  | {
      status: "success";
      steps: TransferStepRecord[];
      transferId: string;
    }
  | {
    status: "error";
    steps: TransferStepRecord[];
    message: string;
  };

const DEFAULT_STEPS: TransferStepRecord[] = [
  { id: "approval", label: "Approval", state: "pending" },
  { id: "burn", label: "Sending on source chain", state: "pending" },
  { id: "attestation", label: "Circle is confirming", state: "pending" },
  { id: "mint", label: "Minting on destination chain", state: "pending" },
];

function mapSteps(
  result: BridgeResult,
  fromNetwork: HopperNetwork,
  toNetwork: HopperNetwork,
): TransferStepRecord[] {
  const chainByStep: Record<string, number | undefined> = {
    approval: fromNetwork.chainId,
    burn: fromNetwork.chainId,
    attestation: undefined,
    mint: toNetwork.chainId,
  };

  return DEFAULT_STEPS.map((step) => {
    const match = result.steps.find(
      (candidate) =>
        candidate.name.toLowerCase().includes(step.id) ||
        step.id.includes(candidate.name.toLowerCase()),
    );

    return {
      ...step,
      state: match?.state === "success"
        ? "success"
        : match?.state === "error"
          ? "error"
          : step.state,
      txHash: match?.txHash,
      explorerUrl: match?.explorerUrl,
      chainId: chainByStep[step.id],
    };
  });
}

function deriveStatus(result: BridgeResult): TransferStatus {
  if (result.state === "success") return "completed";
  if (result.state === "pending") return "minting";
  return "failed";
}

export function useBridge({ persistTransfer }: UseBridgeOptions) {
  const { address, connector } = useAccount();
  const [uiState, setUiState] = useState<BridgeUiState>({
    status: "idle",
    steps: DEFAULT_STEPS,
  });

  const reset = useCallback(() => {
    setUiState({
      status: "idle",
      steps: DEFAULT_STEPS,
    });
  }, []);

  const execute = useCallback(
    async ({ fromNetwork, toNetwork, amount, quote, recipient }: BridgeRequest) => {
      if (!connector) {
        throw new Error("Connect a wallet to bridge USDC.");
      }

      if (!address && !recipient) {
        throw new Error("No recipient address found.");
      }

      setUiState({
        status: "pending",
        steps: DEFAULT_STEPS,
        message: "Awaiting wallet confirmations…",
      });

      const provider = await connector.getProvider();
      const adapter = await createAdapterFromProvider({
        provider,
      });

      try {
        const result = await bridgeKit.bridge({
          from: { adapter, chain: fromNetwork.circleChain },
          to: {
            adapter,
            chain: toNetwork.circleChain,
            recipientAddress: recipient ?? address!,
          },
          amount,
          config: { transferSpeed: "FAST" },
        });

        const steps = mapSteps(result, fromNetwork, toNetwork);
        const record: StoredTransfer = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          fromNetworkId: fromNetwork.id,
          toNetworkId: toNetwork.id,
          amount,
          amountOutEstimated: quote?.amountOut,
          status: deriveStatus(result),
          steps,
          route: quote && {
            provider: quote.provider,
            routeId: quote.routeId,
            etaSeconds: quote.etaSeconds,
            feeAmount: quote.feeAmount,
          },
          explorerLinks: {
            source: steps.find((step) => step.id === "burn")?.explorerUrl,
            destination: steps.find((step) => step.id === "mint")?.explorerUrl,
          },
        };

        persistTransfer(record);

        setUiState({
          status: "success",
          steps,
          transferId: record.id,
        });

        return record.id;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Bridge request failed.";
        setUiState({
          status: "error",
          steps: DEFAULT_STEPS,
          message,
        });
        throw error;
      }
    },
    [address, connector, persistTransfer],
  );

  return {
    execute,
    reset,
    uiState,
  };
}

