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
  TransferStepState,
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
      transferId?: string;
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

const STEP_NAME_ALIASES: Record<string, string> = {
  approve: "approval",
  approval: "approval",
  allowance: "approval",
  authorize: "approval",
  burn: "burn",
  deposit: "burn",
  send: "burn",
  transfer: "burn",
  attestation: "attestation",
  attest: "attestation",
  confirm: "attestation",
  message: "attestation",
  mint: "mint",
  minting: "mint",
  receive: "mint",
  withdrawal: "mint",
  withdraw: "mint",
};

type BridgeResultStep = BridgeResult["steps"][number] & {
  transactionHash?: string;
  hash?: string;
  txHashes?: string[];
  transactionHashes?: string[];
};

function cloneDefaultSteps(): TransferStepRecord[] {
  return DEFAULT_STEPS.map((step) => ({ ...step }));
}

function extractTxHash(value?: string | null): `0x${string}` | undefined {
  if (!value) return undefined;
  const match = value.match(/0x[0-9a-fA-F]{64}/);
  return match ? (match[0] as `0x${string}`) : undefined;
}

function resolveTxHash(
  step?: BridgeResultStep,
  fallbackExplorerUrls: Array<string | undefined> = []
): `0x${string}` | undefined {
  if (!step) return undefined;

  const directCandidates = [
    step.txHash,
    step.transactionHash,
    step.hash,
    step.txHashes?.[0],
    step.transactionHashes?.[0],
  ];

  for (const candidate of directCandidates) {
    const hash = extractTxHash(candidate);
    if (hash) {
      return hash;
    }
  }

  const explorerCandidates = [step.explorerUrl, ...fallbackExplorerUrls];
  for (const explorerUrl of explorerCandidates) {
    const hash = extractTxHash(explorerUrl);
    if (hash) {
      return hash;
    }
  }

  return undefined;
}

function mapSteps(
  result: BridgeResult,
  fromNetwork: HopperNetwork,
  toNetwork: HopperNetwork
): TransferStepRecord[] {
  const chainByStep: Record<string, number | undefined> = {
    approval: fromNetwork.chainId,
    burn: fromNetwork.chainId,
    attestation: undefined,
    mint: toNetwork.chainId,
  };

  return DEFAULT_STEPS.map((step) => {
    const match = result.steps.find((candidate) => {
      const candidateName = candidate.name.toLowerCase().trim();
      const normalizedName = STEP_NAME_ALIASES[candidateName] || candidateName;

      if (normalizedName === step.id || candidateName === step.id) {
        return true;
      }

      if (
        candidateName.includes(step.id) ||
        step.id.includes(candidateName) ||
        candidateName.includes(normalizedName) ||
        normalizedName.includes(step.id)
      ) {
        return true;
      }

      return false;
    });

    let state: TransferStepState = step.state;
    if (match) {
      if (match.state === "success" || match.state === "noop") {
        state = "success";
      } else if (match.state === "error") {
        state = "error";
      } else if (match.state === "pending") {
        state = "pending";
      }
    } else {
      console.debug(
        `[Bridge] Step "${step.id}" missing from Circle response`,
        result.steps.map((candidate) => candidate.name)
      );
    }

    const txHash = resolveTxHash(match as BridgeResultStep | undefined);

    return {
      ...step,
      state,
      txHash,
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
    steps: cloneDefaultSteps(),
  });

  const reset = useCallback(() => {
    setUiState({
      status: "idle",
      steps: cloneDefaultSteps(),
    });
  }, []);

  const execute = useCallback(
    async ({
      fromNetwork,
      toNetwork,
      amount,
      quote,
      recipient,
    }: BridgeRequest) => {
      if (!connector) {
        throw new Error("Connect a wallet to bridge USDC.");
      }

      if (!address && !recipient) {
        throw new Error("No recipient address found.");
      }

      const transferId = crypto.randomUUID();
      const now = new Date().toISOString();
      const uiSteps = cloneDefaultSteps();
      const baseRecord: StoredTransfer = {
        id: transferId,
        createdAt: now,
        updatedAt: now,
        fromNetworkId: fromNetwork.id,
        toNetworkId: toNetwork.id,
        amount,
        amountOutEstimated: quote?.amountOut,
        status: "pending",
        steps: cloneDefaultSteps(),
        route: quote && {
          provider: quote.provider,
          routeId: quote.routeId,
          etaSeconds: quote.etaSeconds,
          feeAmount: quote.feeAmount,
        },
      };

      persistTransfer(baseRecord);

      setUiState({
        status: "pending",
        steps: uiSteps,
        message: "Awaiting wallet confirmations…",
        transferId,
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

        // Log bridge result for debugging
        console.log("Bridge result:", {
          state: result.state,
          steps: result.steps.map((s) => ({
            name: s.name,
            state: s.state,
            txHash: s.txHash,
            explorerUrl: s.explorerUrl,
          })),
        });

        const steps = mapSteps(result, fromNetwork, toNetwork);

        // Log mapped steps for debugging
        console.log("Mapped steps:", steps);
        const record: StoredTransfer = {
          ...baseRecord,
          updatedAt: new Date().toISOString(),
          status: deriveStatus(result),
          steps,
          explorerLinks: {
            source: steps.find((step) => step.id === "burn")?.explorerUrl,
            destination: steps.find((step) => step.id === "mint")?.explorerUrl,
          },
          errorMessage: undefined,
        };

        persistTransfer(record);

        // Always store transferId so we can track this transfer
        // If bridge result is still pending, keep UI state as pending so watcher can update it
        if (result.state === "pending") {
          setUiState({
            status: "pending",
            steps,
            message: "Bridge in progress…",
            transferId: record.id,
          });
        } else {
          setUiState({
            status: result.state === "success" ? "success" : "error",
            steps,
            transferId: record.id,
            ...(result.state === "error" && {
              message: "Bridge completed with errors",
            }),
          });
        }

        return record.id;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Bridge request failed.";

        persistTransfer({
          ...baseRecord,
          updatedAt: new Date().toISOString(),
          status: "failed",
          steps: baseRecord.steps.map((step, index) =>
            index === 0
              ? {
                  ...step,
                  state: "error",
                }
              : step
          ),
          errorMessage: message,
        });

        setUiState({
          status: "error",
          steps: cloneDefaultSteps(),
          message,
        });
        throw error;
      }
    },
    [address, connector, persistTransfer]
  );

  return {
    execute,
    reset,
    uiState,
  };
}
