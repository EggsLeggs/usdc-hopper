"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  Loader2,
  Timer,
} from "lucide-react";
import { useAccount } from "wagmi";

import {
  defaultFromNetworkId,
  defaultToNetworkId,
  networkById,
  supportedNetworks,
  type HopperNetworkId,
} from "@/lib/chains";
import { formatAmount, formatDuration } from "@/lib/format";
import {
  loadNetworkPreferences,
  saveNetworkPreferences,
} from "@/lib/storage";
import { useArcQuote } from "@/hooks/useArcQuote";
import { useBridge } from "@/hooks/useBridge";
import { useTransfers } from "@/hooks/useTransfers";
import { useTransferWatcher } from "@/hooks/useTransferWatcher";
import { useUsdcBalance } from "@/hooks/useUsdcBalance";

function NetworkSelect({
  label,
  value,
  onChange,
  exclude,
}: {
  label: string;
  value: HopperNetworkId;
  onChange: (value: HopperNetworkId) => void;
  exclude?: HopperNetworkId;
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-400">{label}</span>
      <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
        <select
          value={value}
          onChange={(event) =>
            onChange(event.target.value as HopperNetworkId)
          }
          className="w-full bg-transparent text-base font-semibold text-white outline-none"
        >
          {supportedNetworks
            .filter((network) => network.id !== exclude)
            .map((network) => (
              <option
                key={network.id}
                value={network.id}
                className="bg-slate-900 text-white"
              >
                {network.label}
              </option>
            ))}
        </select>
      </div>
    </label>
  );
}

function QuoteSummary({
  amountOut,
  feeAmount,
  etaSeconds,
}: {
  amountOut?: string;
  feeAmount?: string;
  etaSeconds?: number;
}) {
  return (
    <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">
          Estimated receive
        </p>
        <p className="text-lg font-semibold text-white">
          {amountOut ? `${formatAmount(amountOut)} USDC` : "—"}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">
          Estimated fees
        </p>
        <p className="text-lg font-semibold text-white">
          {feeAmount ? `${formatAmount(feeAmount)} USDC` : "—"}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">
          Estimated time
        </p>
        <p className="text-lg font-semibold text-white">
          {formatDuration(etaSeconds)}
        </p>
      </div>
    </div>
  );
}

function StatusStep({
  label,
  state,
}: {
  label: string;
  state: "pending" | "success" | "error";
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
        {state === "success" ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
        ) : state === "error" ? (
          <AlertTriangle className="h-5 w-5 text-amber-300" />
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-400 capitalize">{state}</p>
      </div>
    </div>
  );
}

function BalanceRow({
  balance,
  loading,
  onMax,
}: {
  balance: number;
  loading: boolean;
  onMax: () => void;
}) {
  return (
    <div className="flex items-center justify-between text-sm text-slate-400">
      <span>
        Balance:{" "}
        {loading ? (
          <Loader2 className="inline h-3.5 w-3.5 animate-spin text-slate-400" />
        ) : (
          `${formatAmount(balance)} USDC`
        )}
      </span>
      <button
        type="button"
        onClick={onMax}
        className="text-xs font-semibold uppercase tracking-wide text-sky-300 hover:text-sky-200"
      >
        Max
      </button>
    </div>
  );
}

export function BridgeView() {
  const { address } = useAccount();
  
  const [initialPreferences] = useState(() => loadNetworkPreferences());

  // Start with defaults to avoid hydration mismatch
  const [fromId, setFromId] = useState<HopperNetworkId>(
    initialPreferences?.fromNetworkId ?? defaultFromNetworkId,
  );
  const [toId, setToId] = useState<HopperNetworkId>(
    initialPreferences?.toNetworkId ?? defaultToNetworkId,
  );
  const [amount, setAmount] = useState("0");
  const [showDetails, setShowDetails] = useState(false);
  
  useEffect(() => {
    saveNetworkPreferences({ fromNetworkId: fromId, toNetworkId: toId });
  }, [fromId, toId]);

  const fromNetwork = networkById[fromId];
  const toNetwork = networkById[toId];

  const { transfers, addTransfer, updateTransfer } = useTransfers();
  const { uiState, execute, reset } = useBridge({
    persistTransfer: addTransfer,
  });

  // Watch for transfer updates
  useTransferWatcher(transfers, updateTransfer);

  const { formatted: balance, isFetching: balanceLoading } = useUsdcBalance(
    fromNetwork,
    address,
  );

  const quoteQuery = useArcQuote({
    fromNetwork,
    toNetwork,
    amount,
    walletAddress: address ?? "",
  });

  // Sync UI state with persisted transfer when it exists
  const activeTransfer = useMemo(() => {
    // If we have a transferId, use that (works for both pending and success states)
    if ("transferId" in uiState && uiState.transferId) {
      return transfers.find((t) => t.id === uiState.transferId);
    }
    // Fallback: If we're in pending state without transferId, look for the most recent active transfer
    if (uiState.status === "pending") {
      const active = transfers.find(
        (t) =>
          t.status !== "completed" &&
          t.status !== "failed" &&
          t.fromNetworkId === fromId &&
          t.toNetworkId === toId,
      );
      return active ?? transfers[0] ?? null;
    }
    return null;
  }, [transfers, uiState, fromId, toId]);

  // Use active transfer's steps if available (they're kept up-to-date by watcher),
  // otherwise use UI state steps
  const displaySteps = useMemo(() => {
    return activeTransfer?.steps ?? uiState.steps;
  }, [activeTransfer?.steps, uiState.steps]);

  const swapNetworks = () => {
    setFromId(toId);
    setToId(fromId);
  };

  const canSubmit =
    Boolean(address) &&
    Number(amount) > 0 &&
    fromId !== toId &&
    uiState.status !== "pending";

  const handleBridge = async () => {
    if (!canSubmit) return;
    try {
      await execute({
        fromNetwork,
        toNetwork,
        amount,
        quote: quoteQuery.data,
        recipient: address ?? undefined,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const latestTransfer = transfers[0];

  const buttonLabel = useMemo(() => {
    if (!address) return "Connect wallet to bridge";
    if (uiState.status === "pending") return "Bridging…";
    if (Number(amount) === 0) return "Enter amount to bridge";
    if (fromId === toId) return "Select different networks";
    return "Bridge USDC";
  }, [address, uiState.status, amount, fromId, toId]);

  const showQuoteState =
    quoteQuery.isFetching && !quoteQuery.data ? "Loading quote…" : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="glass-card p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Testnet bridge</p>
            <h1 className="text-2xl font-semibold text-white">
              Move USDC across chains
            </h1>
          </div>
          <div className="pill">
            <Timer className="h-3.5 w-3.5" />
            Live
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <NetworkSelect
                label="From network"
                value={fromId}
                onChange={(value) => setFromId(value)}
                exclude={toId}
              />
            </div>
            <button
              type="button"
              onClick={swapNetworks}
              className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:border-white/30"
            >
              <ArrowDownUp className="h-4 w-4 rotate-90" />
              Swap
            </button>
            <div className="flex-1">
              <NetworkSelect
                label="To network"
                value={toId}
                onChange={(value) => setToId(value)}
                exclude={fromId}
              />
            </div>
          </div>

          <label className="block">
            <span className="text-sm text-slate-400">USDC amount</span>
            <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <input
                type="number"
                min="0"
                step="0.000001"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full bg-transparent text-3xl font-semibold text-white outline-none"
                placeholder="0.00"
              />
              <BalanceRow
                balance={balance}
                loading={balanceLoading}
                onMax={() => setAmount(balance.toString())}
              />
            </div>
          </label>

          <QuoteSummary
            amountOut={quoteQuery.data?.amountOut}
            feeAmount={quoteQuery.data?.feeAmount}
            etaSeconds={quoteQuery.data?.etaSeconds}
          />

          {showQuoteState && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {showQuoteState}
            </div>
          )}

          {uiState.status === "error" && (
            <div className="flex gap-3 rounded-2xl border border-amber-400/50 bg-amber-500/10 p-4 text-sm text-amber-200">
              <AlertTriangle className="h-5 w-5 flex-none" />
              <div>
                <p className="font-semibold">Bridge failed</p>
                <p>{uiState.message}</p>
                <button
                  className="mt-2 text-xs font-semibold uppercase tracking-wide text-amber-200"
                  onClick={reset}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleBridge}
            disabled={!canSubmit}
            className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-6 py-4 text-lg font-semibold text-slate-950 shadow-lg shadow-sky-500/30 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {buttonLabel}
          </button>
        </div>
      </section>

      {uiState.status !== "idle" && (
        <section className="glass-card p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Circle status</p>
              <h2 className="text-xl font-semibold text-white">Transfer flow</h2>
            </div>
            <button
              className="text-xs font-semibold uppercase tracking-wide text-sky-300"
              onClick={() => setShowDetails((prev) => !prev)}
            >
              {showDetails ? "Hide details" : "Advanced details"}
            </button>
          </div>

          <div className="mt-6 space-y-5">
            {displaySteps.map((step) => (
              <StatusStep key={step.id} label={step.label} state={step.state} />
            ))}
          </div>

          {showDetails && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-sm text-slate-300">
              <p className="mb-2 font-semibold text-white">Networks</p>
              <div className="space-y-1 text-xs text-slate-400">
                <p>
                  {fromNetwork.label} · Domain {fromNetwork.circleDomain}
                </p>
                <p>
                  {toNetwork.label} · Domain {toNetwork.circleDomain}
                </p>
                <p>
                  TokenMessenger: {fromNetwork.cctpContracts.tokenMessenger}
                </p>
                <p>
                  MessageTransmitter: {fromNetwork.cctpContracts.messageTransmitter}
                </p>
              </div>
              {quoteQuery.data && (
                <>
                  <p className="mt-4 mb-2 font-semibold text-white">Arc route</p>
                  <p>Provider: {quoteQuery.data.provider}</p>
                  <p>Route id: {quoteQuery.data.routeId}</p>
                </>
              )}
            </div>
          )}

          {latestTransfer && (
            <div className="mt-8 rounded-2xl border border-white/5 bg-slate-900/50 p-4 text-sm text-slate-200">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Most recent transfer</p>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-300">
                  {latestTransfer.status}
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold text-white">
                {formatAmount(latestTransfer.amount)} →{" "}
                {formatAmount(latestTransfer.amountOutEstimated ?? "0")} USDC
              </p>
              <p className="text-xs text-slate-400">
                {networkById[latestTransfer.fromNetworkId].shortName} →{" "}
                {networkById[latestTransfer.toNetworkId].shortName}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

