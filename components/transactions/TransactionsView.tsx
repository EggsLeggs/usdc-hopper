"use client";

import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";

import { formatAmount, formatDateTime, formatDuration } from "@/lib/format";
import { networkById } from "@/lib/chains";
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
  const { transfers, refreshTransfers, updateTransfer } = useTransfers();
  useTransferWatcher(transfers, updateTransfer);

  const hasTransfers = transfers.length > 0;

  return (
    <section className="glass-card p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Activity</p>
          <h1 className="text-2xl font-semibold text-white">Transactions</h1>
        </div>
        <button
          type="button"
          onClick={refreshTransfers}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:border-white/30"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
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
                  <tr key={transfer.id}>
                    <td className="px-4 py-4 align-top">
                      <p className="font-semibold text-white">
                        {formatDateTime(transfer.createdAt)}
                      </p>
                      <p className="text-xs text-slate-400">
                        ETA {formatDuration(transfer.route?.etaSeconds)}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="font-semibold text-white">
                        {from.shortName} → {to.shortName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {transfer.route?.provider ?? "Arc Router"}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="font-semibold text-white">
                        {formatAmount(transfer.amount)} →{" "}
                        {formatAmount(transfer.amountOutEstimated ?? "0")} USDC
                      </p>
                      {transfer.route?.feeAmount && (
                        <p className="text-xs text-slate-400">
                          Fees {formatAmount(transfer.route.feeAmount)} USDC
                        </p>
                      )}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

