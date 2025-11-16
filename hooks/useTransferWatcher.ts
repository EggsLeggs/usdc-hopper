"use client";

import { useCallback, useEffect, useRef } from "react";

import { getNetworkByChainId, getPublicClient } from "@/lib/chains";
import type { StoredTransfer, TransferStepRecord } from "@/lib/storage";

function extractTxHash(value?: string | null): `0x${string}` | undefined {
  if (!value) return undefined;
  const match = value.match(/0x[0-9a-fA-F]{64}/);
  return match ? (match[0] as `0x${string}`) : undefined;
}

function resolveStepTxHash(
  transfer: StoredTransfer,
  step: TransferStepRecord
): `0x${string}` | undefined {
  return (
    extractTxHash(step.txHash) ??
    extractTxHash(step.explorerUrl) ??
    (step.id === "burn"
      ? extractTxHash(transfer.explorerLinks?.source)
      : undefined) ??
    (step.id === "mint"
      ? extractTxHash(transfer.explorerLinks?.destination)
      : undefined)
  );
}

export function useTransferWatcher(
  transfers: StoredTransfer[],
  updateTransfer: (
    id: string,
    updater: (transfer: StoredTransfer) => StoredTransfer
  ) => void
) {
  const checkRef = useRef<() => Promise<void>>(async () => {});
  const retryCounts = useRef(new Map<string, number>());

  useEffect(() => {
    const active = transfers.filter(
      (transfer) =>
        transfer.status !== "completed" && transfer.status !== "failed"
    );

    if (!active.length) {
      checkRef.current = async () => {};
      return;
    }

    let cancelled = false;

    const check = async () => {
      for (const transfer of active) {
        for (const step of transfer.steps) {
          if (step.state !== "pending") {
            continue;
          }

          const derivedTxHash = resolveStepTxHash(transfer, step);

          if (!step.txHash && derivedTxHash) {
            updateTransfer(transfer.id, (current) => ({
              ...current,
              steps: current.steps.map((existing) =>
                existing.id === step.id && !existing.txHash
                  ? { ...existing, txHash: derivedTxHash }
                  : existing
              ),
            }));
          }

          if (!derivedTxHash || !step.chainId) {
            continue;
          }

          const network = getNetworkByChainId(step.chainId);
          if (!network) {
            console.warn(
              `No network found for chainId ${step.chainId} for step ${step.id}`
            );
            continue;
          }

          const client = getPublicClient(network.wagmiChain);
          const stepKey = `${transfer.id}:${step.id}:${derivedTxHash}`;

          try {
            const receipt = await client.getTransactionReceipt({
              hash: derivedTxHash,
            });

            if (receipt && !cancelled) {
              const isSuccess = receipt.status === "success";
              retryCounts.current.delete(stepKey);
              console.log(
                `Step ${step.id} (${derivedTxHash}) status: ${
                  isSuccess ? "success" : "error"
                }`
              );

              updateTransfer(transfer.id, (current) => {
                let updatedSteps = current.steps.map((existing) =>
                  existing.id === step.id
                    ? {
                        ...existing,
                        state: isSuccess ? "success" : "error",
                      }
                    : existing
                );

                if (step.id === "mint") {
                  updatedSteps = updatedSteps.map((existing) => {
                    if (
                      isSuccess &&
                      existing.id === "attestation" &&
                      existing.state !== "success"
                    ) {
                      return { ...existing, state: "success" };
                    }
                    if (
                      !isSuccess &&
                      existing.id === "attestation" &&
                      existing.state === "pending"
                    ) {
                      return { ...existing, state: "error" };
                    }
                    return existing;
                  });
                }

                const allStepsComplete = updatedSteps.every(
                  (s) => s.state === "success" || s.state === "error"
                );
                const allStepsSuccess = updatedSteps.every(
                  (s) => s.state === "success"
                );

                let newStatus = current.status;
                if (step.id === "mint" && isSuccess) {
                  newStatus = "completed";
                } else if (step.id === "mint" && !isSuccess) {
                  newStatus = "failed";
                } else if (
                  allStepsComplete &&
                  allStepsSuccess &&
                  current.status === "minting"
                ) {
                  newStatus = "completed";
                } else if (
                  allStepsComplete &&
                  !allStepsSuccess &&
                  current.status !== "failed"
                ) {
                  newStatus = "failed";
                }

                return {
                  ...current,
                  updatedAt: new Date().toISOString(),
                  status: newStatus,
                  steps: updatedSteps,
                };
              });
            }
          } catch (error) {
            if (cancelled) {
              return;
            }

            const message =
              error instanceof Error ? error.message : String(error);
            const attempts = (retryCounts.current.get(stepKey) ?? 0) + 1;
            retryCounts.current.set(stepKey, attempts);
            const lower = message.toLowerCase();

            if (
              lower.includes("not found") ||
              lower.includes("unknown transaction")
            ) {
              if (attempts % 5 === 0) {
                console.debug(
                  `Waiting for ${step.id} receipt (attempt ${attempts})`,
                  derivedTxHash
                );
              }
              continue;
            }

            console.warn(`Error checking step ${step.id}:`, message);
          }
        }
      }
    };

    checkRef.current = check;

    const id = setInterval(check, 15_000);
    void check();

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [transfers, updateTransfer]);

  const forceCheck = useCallback(() => {
    void checkRef.current();
  }, []);

  return { forceCheck };
}
