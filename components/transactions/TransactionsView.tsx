"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { formatAmount, formatDateTime } from "@/lib/format";
import { getNetworkByChainId, networkById } from "@/lib/chains";
import { useTransfers } from "@/hooks/useTransfers";
import { useTransferWatcher } from "@/hooks/useTransferWatcher";

const statusStyles: Record<
  string,
  { bg: string; text: string }
> = {
  pending: {
    bg: "bg-amber-500/15",
    text: "text-amber-300",
  },
  confirming: {
    bg: "bg-sky-500/10",
    text: "text-sky-200",
  },
  minting: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-200",
  },
  completed: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
  },
  failed: {
    bg: "bg-rose-500/15",
    text: "text-rose-300",
  },
};

export function TransactionsView() {
  const { transfers, refreshTransfers, resetTransfers, updateTransfer } =
    useTransfers();
  const { forceCheck } = useTransferWatcher(transfers, updateTransfer);
  const [expandedTransferId, setExpandedTransferId] = useState<string | null>(
    null,
  );

  const hasTransfers = transfers.length > 0;
  const hasPendingTransfers = transfers.some(
    (transfer) =>
      transfer.status !== "completed" && transfer.status !== "failed",
  );

  const toggleDetails = (transferId: string) => {
    setExpandedTransferId((current) =>
      current === transferId ? null : transferId,
    );
  };

  const formatHash = (hash?: string) =>
    hash ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : "—";

  return (
    <section className="glass-card p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">Activity</p>
          <h1 className="text-2xl font-semibold text-white">Transactions</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={forceCheck}
            disabled={!hasPendingTransfers}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Loader2 className="h-4 w-4" />
            Re-check pending
          </button>
          <button
            type="button"
            onClick={refreshTransfers}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:border-white/30"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "Clear all stored transfers? This cannot be undone.",
                )
              ) {
                resetTransfers();
              }
            }}
            className="inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 hover:border-rose-300/70"
          >
            Clear history
          </button>
        </div>
      </div>

      {!hasTransfers ? (
        <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/10 p-10 text-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          <p>No transfers yet. Bridge USDC to see your history.</p>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl border border-white/5">
          <table className="min-w-full divide-y divide-white/5 text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Route</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Explorer</th>
                <th className="px-4 py-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {transfers.map((transfer) => {
                const from = networkById[transfer.fromNetworkId];
                const to = networkById[transfer.toNetworkId];
                const statusStyle =
                  statusStyles[transfer.status] ?? statusStyles.pending;
                const explorerUrl =
                  transfer.explorerLinks?.destination ??
                  transfer.explorerLinks?.source;

                return (
                  <>
                  <tr key={transfer.id}>
                    <td className="px-4 py-4 align-top">
                      <p className="font-semibold text-white">
                        {formatDateTime(transfer.createdAt)}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="font-semibold text-white">
                        {from.shortName} → {to.shortName}
                      </p>
                      <p className="text-xs text-slate-400">
                        Chain IDs {from.chainId} → {to.chainId}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="font-semibold text-white">
                        {formatAmount(transfer.amount)} USDC
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyle.bg} ${statusStyle.text} uppercase tracking-wide`}
                      >
                        {transfer.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      {explorerUrl ? (
                        <Link
                          href={explorerUrl}
                          target="_blank"
                          className="text-sm font-semibold text-sky-300 hover:text-sky-200"
                        >
                          View tx
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-500">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <button
                        type="button"
                        onClick={() => toggleDetails(transfer.id)}
                        className="text-xs font-semibold uppercase tracking-wide text-sky-300 hover:text-sky-200"
                        aria-expanded={expandedTransferId === transfer.id}
                      >
                        {expandedTransferId === transfer.id
                          ? "Hide"
                          : "Details"}
                      </button>
                    </td>
                  </tr>
                  {expandedTransferId === transfer.id && (
                    <tr key={`${transfer.id}-details`}>
                      <td
                        className="bg-slate-900/40 px-4 py-4 text-sm text-slate-300"
                        colSpan={6}
                      >
                        <div className="space-y-4">
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            Transfer ID · {transfer.id}
                          </div>
                          <div className="space-y-3">
                            {transfer.steps.map((step) => {
                              const network = step.chainId
                                ? getNetworkByChainId(step.chainId)
                                : undefined;
                              const chainLabel = network
                                ? `${network.shortName} (${network.chainId})`
                                : step.chainId
                                  ? `Chain ${step.chainId}`
                                  : "Off-chain";

                              return (
                                <div
                                  key={step.id}
                                  className="rounded-xl border border-white/5 bg-white/5 p-3"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-semibold text-white">
                                        {step.label}
                                      </p>
                                      <p className="text-xs uppercase tracking-wide text-slate-400">
                                        {chainLabel}
                                      </p>
                                    </div>
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                                      {step.state}
                                    </span>
                                  </div>
                                  <div className="mt-2 text-xs text-slate-400">
                                    {step.txHash ? (
                                      step.explorerUrl ? (
                                        <Link
                                          href={step.explorerUrl}
                                          target="_blank"
                                          className="font-semibold text-sky-300 hover:text-sky-200"
                                        >
                                          {formatHash(step.txHash)}
                                        </Link>
                                      ) : (
                                        <span>{formatHash(step.txHash)}</span>
                                      )
                                    ) : (
                                      <span>Tx hash pending</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {transfer.errorMessage && (
                            <p className="text-sm text-rose-300">
                              Error: {transfer.errorMessage}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

