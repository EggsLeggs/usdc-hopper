"use client";

import { useEffect } from "react";

import {
  getNetworkByChainId,
  getPublicClient,
} from "@/lib/chains";
import type { StoredTransfer } from "@/lib/storage";

export function useTransferWatcher(
  transfers: StoredTransfer[],
  updateTransfer: (
    id: string,
    updater: (transfer: StoredTransfer) => StoredTransfer,
  ) => void,
) {
  useEffect(() => {
    const active = transfers.filter(
      (transfer) =>
        transfer.status !== "completed" && transfer.status !== "failed",
    );

    if (!active.length) return;
    let cancelled = false;

    async function check() {
      for (const transfer of active) {
        for (const step of transfer.steps) {
          if (!step.txHash || step.state !== "pending" || !step.chainId) {
            continue;
          }

          const network = getNetworkByChainId(step.chainId);
          if (!network) continue;

          try {
            const client = getPublicClient(network.wagmiChain);
            const receipt = await client.getTransactionReceipt({
              hash: step.txHash as `0x${string}`,
            });

            if (receipt && !cancelled) {
              updateTransfer(transfer.id, (current) => ({
                ...current,
                updatedAt: new Date().toISOString(),
                status:
                  step.id === "mint" && receipt.status === "success"
                    ? "completed"
                    : current.status,
                steps: current.steps.map((existing) =>
                  existing.id === step.id
                    ? {
                        ...existing,
                        state: receipt.status === "success" ? "success" : "error",
                      }
                    : existing,
                ),
              }));
            }
          } catch {
            // Transaction might not be available yet; ignore.
          }
        }
      }
    }

    const id = setInterval(check, 15_000);
    check();

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [transfers, updateTransfer]);
}

