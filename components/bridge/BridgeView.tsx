"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { BridgeResult } from "@circle-fin/bridge-kit";
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { useAccount } from "wagmi";

import {
  defaultFromNetworkId,
  defaultToNetworkId,
  getNetworkByChainId,
  networkById,
  supportedNetworks,
  type HopperNetwork,
} from "@/lib/chains";
import { formatAmount, formatDateTime } from "@/lib/format";
import {
  type StoredTransfer,
  type TransferStepRecord,
  type TransferStepState,
} from "@/lib/storage";
import { useBridge } from "@/hooks/useBridge";
import { useTransfers } from "@/hooks/useTransfers";
import { useTransferWatcher } from "@/hooks/useTransferWatcher";

const chainIcons: Record<number, string> = {
  [networkById[defaultFromNetworkId].chainId]: "/sepolia.png",
  [networkById["base-sepolia"].chainId]: "/base.svg",
  [networkById["arc-testnet"].chainId]: "/Arc.png",
};

const STEP_LABELS = {
  idle: {
    title: "Ready to bridge",
    description: "Approve MetaMask when prompted to continue.",
  },
  "switching-network": {
    title: "Switching network",
    description: "MetaMask will request a switch to your source chain.",
  },
  approving: {
    title: "Bridge in progress",
    description:
      "Approve the spend, transfer, and receive message transactions in MetaMask.",
  },
  "signing-bridge": {
    title: "Bridge in progress",
    description:
      "Approve the spend, transfer, and receive message transactions in MetaMask.",
  },
  "waiting-receive-message": {
    title: "Waiting for attestation",
    description: "Circle is confirming the transfer—stay on this tab.",
  },
  success: {
    title: "Bridge complete",
    description: "Your USDC arrived on the destination chain.",
  },
  error: {
    title: "Bridge failed",
    description: "Review the error below and try again.",
  },
} satisfies Record<string, { title: string; description: string }>;

const DEFAULT_STEPS: TransferStepRecord[] = [
  { id: "approval", label: "Approval", state: "pending" },
  { id: "burn", label: "Sending on source chain", state: "pending" },
  { id: "attestation", label: "Circle attestation", state: "pending" },
  { id: "mint", label: "Receiving on destination", state: "pending" },
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
  fallbackExplorerUrls: Array<string | undefined> = [],
): `0x${string}` | undefined {
  if (!step) return undefined;
  const candidates = [
    step.txHash,
    step.transactionHash,
    step.hash,
    step.txHashes?.[0],
    step.transactionHashes?.[0],
  ];

  for (const entry of candidates) {
    const hash = extractTxHash(entry);
    if (hash) return hash;
  }

  for (const url of fallbackExplorerUrls) {
    const hash = extractTxHash(url);
    if (hash) return hash;
  }

  return undefined;
}

function buildExplorerUrl(network?: HopperNetwork, txHash?: string) {
  if (!network || !txHash) return undefined;
  if (network.explorerTxPattern?.includes("{hash}")) {
    return network.explorerTxPattern.replace("{hash}", txHash);
  }
  const base = network.blockExplorerUrl
    ? network.blockExplorerUrl.replace(/\/$/, "")
    : "";
  return base ? `${base}/tx/${txHash}` : undefined;
}

function mapBridgeSteps(
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

  return DEFAULT_STEPS.map((template) => {
    const match = result.steps.find((candidate) => {
      const candidateName = candidate.name.toLowerCase().trim();
      const normalized = STEP_NAME_ALIASES[candidateName] || candidateName;
      return (
        normalized === template.id ||
        candidateName === template.id ||
        candidateName.includes(template.id) ||
        template.id.includes(candidateName) ||
        normalized.includes(template.id)
      );
    });

    let state: TransferStepState = template.state;
    if (match) {
      if (match.state === "success" || match.state === "noop") {
        state = "success";
      } else if (match.state === "error") {
        state = "error";
      } else if (match.state === "pending") {
        state = "pending";
      }
    }

    const txHash = resolveTxHash(match as BridgeResultStep | undefined, [
      template.id === "burn"
        ? buildExplorerUrl(fromNetwork, match?.txHash)
        : undefined,
      template.id === "mint"
        ? buildExplorerUrl(toNetwork, match?.txHash)
        : undefined,
    ]);

    return {
      ...template,
      state,
      txHash,
      explorerUrl:
        template.id === "burn"
          ? buildExplorerUrl(fromNetwork, txHash)
          : template.id === "mint"
            ? buildExplorerUrl(toNetwork, txHash)
            : match?.explorerUrl,
      chainId: chainByStep[template.id],
    };
  });
}

function createPendingTransfer(
  id: string,
  amount: string,
  fromNetwork: HopperNetwork,
  toNetwork: HopperNetwork,
): StoredTransfer {
  const timestamp = new Date().toISOString();
  return {
    id,
    createdAt: timestamp,
    updatedAt: timestamp,
    fromNetworkId: fromNetwork.id,
    toNetworkId: toNetwork.id,
    amount,
    status: "pending",
    steps: cloneDefaultSteps().map((step) => ({
      ...step,
      chainId:
        step.id === "approval" || step.id === "burn"
          ? fromNetwork.chainId
          : step.id === "mint"
            ? toNetwork.chainId
            : undefined,
    })),
  };
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

export function BridgeView() {
  const { address, isConnected, chainId } = useAccount();

  const [fromChainId, setFromChainId] = useState(
    networkById[defaultFromNetworkId].chainId,
  );
  const [toChainId, setToChainId] = useState(
    networkById[defaultToNetworkId].chainId,
  );
  const [amount, setAmount] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [bridgeStartTime, setBridgeStartTime] = useState<number | null>(null);

  const {
    state,
    tokenBalance,
    isLoadingBalance,
    balanceError,
    fetchTokenBalance,
    bridge,
    reset,
  } = useBridge();

  const { transfers, addTransfer, updateTransfer } = useTransfers();
  useTransferWatcher(transfers, updateTransfer);

  const fromNetwork = getNetworkByChainId(fromChainId);
  const toNetwork = getNetworkByChainId(toChainId);

  useEffect(() => {
    if (address && isConnected && state.step !== "success") {
      void fetchTokenBalance("USDC", fromChainId);
    }
  }, [address, isConnected, fromChainId, fetchTokenBalance, state.step]);

  useEffect(() => {
    if (bridgeStartTime === null) {
      return;
    }
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - bridgeStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [bridgeStartTime]);

  const sanitizedAmount = amount.trim();
  const canSubmit =
    Boolean(address) &&
    Number(sanitizedAmount) > 0 &&
    fromChainId !== toChainId &&
    !state.isLoading;

  const latestTransfer = transfers[0] ?? null;

  const progressDirection = state.direction ?? {
    fromChainId,
    toChainId,
  };
  const progressFromNetwork = getNetworkByChainId(progressDirection.fromChainId);
  const progressToNetwork = getNetworkByChainId(progressDirection.toChainId);

  const selectAlternateChain = (excluded: number) =>
    supportedNetworks.find((network) => network.chainId !== excluded)?.chainId;

  const handleFromChainChange = (value: number) => {
    setFromChainId(value);
    if (value === toChainId) {
      const fallback = selectAlternateChain(value);
      if (fallback) {
        setToChainId(fallback);
      }
    }
  };

  const handleToChainChange = (value: number) => {
    setToChainId(value);
    if (value === fromChainId) {
      const fallback = selectAlternateChain(value);
      if (fallback) {
        setFromChainId(fallback);
      }
    }
  };

  const handleBridge = async () => {
    if (
      !canSubmit ||
      !fromNetwork ||
      !toNetwork ||
      Number(sanitizedAmount) <= 0
    ) {
      return;
    }

    const transferId = crypto.randomUUID();
    setBridgeStartTime(Date.now());
    setElapsedTime(0);
    const pendingRecord = createPendingTransfer(
      transferId,
      sanitizedAmount,
      fromNetwork,
      toNetwork,
    );

    addTransfer(pendingRecord);

    try {
      const result = await bridge({
        token: "USDC",
        amount: sanitizedAmount,
        direction: {
          fromChainId,
          toChainId,
        },
      });

      updateTransfer(transferId, (current) => {
        const steps = mapBridgeSteps(result.result, fromNetwork, toNetwork);
        return {
          ...current,
          updatedAt: new Date().toISOString(),
          status: "completed",
          steps,
          explorerLinks: {
            source: buildExplorerUrl(fromNetwork, result.sourceTxHash),
            destination: buildExplorerUrl(toNetwork, result.receiveTxHash),
          },
          errorMessage: undefined,
        };
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Bridge request failed.";
      updateTransfer(transferId, (current) => ({
        ...current,
        updatedAt: new Date().toISOString(),
        status: "failed",
        steps: current.steps.map((step, index) =>
          index === 0 ? { ...step, state: "error" } : step,
        ),
        errorMessage: message,
      }));
    } finally {
      setBridgeStartTime(null);
    }
  };

  const handleReset = () => {
    reset();
    setAmount("");
    setBridgeStartTime(null);
    setElapsedTime(0);
    if (address && isConnected) {
      void fetchTokenBalance("USDC", fromChainId);
    }
  };

  const renderIdleView = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <ChainSelect
          label="From"
          chainId={fromChainId}
          exclude={toChainId}
          onChange={handleFromChainChange}
        />
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => {
              setFromChainId(toChainId);
              setToChainId(fromChainId);
            }}
            disabled={state.isLoading}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:border-white/30 disabled:opacity-50"
          >
            <ArrowLeftRight className="h-5 w-5" />
          </button>
        </div>
        <ChainSelect
          label="To"
          chainId={toChainId}
          exclude={fromChainId}
          onChange={handleToChainChange}
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-400">
          Token
        </p>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/usdc.svg"
              alt="USDC"
              width={32}
              height={32}
              className="rounded-full bg-white/80 p-1"
            />
            <div>
              <p className="text-lg font-semibold text-white">USDC</p>
              <p className="text-xs text-slate-400">
                Native token for Circle Bridge Kit testnets
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm text-slate-400">Amount</label>
        <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="flex-1 bg-transparent text-3xl font-semibold text-white outline-none"
            />
            <button
              type="button"
              onClick={() => setAmount(Number(tokenBalance).toString())}
              className="rounded-full bg-slate-900/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 hover:bg-slate-800/60"
            >
              Max
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <div>
              Balance:
              {isLoadingBalance ? (
                <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-slate-300" />
              ) : (
                <span className="ml-2 font-semibold text-white">
                  {Number(tokenBalance).toFixed(2)} USDC
                </span>
              )}
            </div>
            {balanceError && (
              <p className="text-xs text-amber-300">{balanceError}</p>
            )}
          </div>
        </div>
      </div>

      {address && chainId !== fromChainId && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-semibold">
            Switch MetaMask to {fromNetwork?.shortName}
          </p>
          <p className="mt-1 text-xs">
            We will prompt you automatically, but you can switch now to reduce
            friction.
          </p>
        </div>
      )}

      {!isConnected && (
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-100">
          Connect MetaMask to select networks and check balances.
        </div>
      )}

      <button
        type="button"
        onClick={handleBridge}
        disabled={!canSubmit}
        className="w-full rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-400 to-blue-500 px-6 py-4 text-lg font-semibold text-white shadow-[0_0_25px_rgba(14,165,233,0.55)] transition hover:shadow-[0_0_35px_rgba(14,165,233,0.75)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isConnected ? "Bridge USDC" : "Connect wallet to bridge"}
      </button>
    </div>
  );

  const renderProgressView = () => {
    const currentStep = STEP_LABELS[state.step] ?? STEP_LABELS.approving;
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <Loader2 className="h-10 w-10 animate-spin text-orange-400" />
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">
            Bridge in progress
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {currentStep.title}
          </p>
          <p className="mt-2 text-sm text-slate-300">{currentStep.description}</p>
        </div>
        <div className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-mono text-white">
          <Clock className="h-4 w-4 text-orange-400" />
          {formatTime(elapsedTime)}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-sm text-slate-300">
          <p className="text-xs uppercase tracking-wide text-slate-400">Route</p>
          <p className="text-lg font-semibold text-white">
            {progressFromNetwork?.shortName} → {progressToNetwork?.shortName}
          </p>
        </div>
      </div>
    );
  };

  const renderSuccessView = () => {
    const sourceUrl = buildExplorerUrl(
      progressFromNetwork,
      state.sourceTxHash,
    );
    const destinationUrl = buildExplorerUrl(
      progressToNetwork,
      state.receiveTxHash,
    );
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/10">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        </div>
        <div>
          <p className="text-3xl font-semibold text-white">Bridge complete!</p>
          <p className="mt-2 text-sm text-slate-300">
            Your USDC moved from {progressFromNetwork?.label} to{" "}
            {progressToNetwork?.label}.
          </p>
        </div>
        <div className="space-y-2 text-left text-sm">
          {sourceUrl && (
            <Link
              href={sourceUrl}
              target="_blank"
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-200 transition hover:border-emerald-300/40"
            >
              <span>View source tx</span>
              <span className="text-xs text-slate-400">
                {state.sourceTxHash?.slice(0, 10)}…
              </span>
            </Link>
          )}
          {destinationUrl && (
            <Link
              href={destinationUrl}
              target="_blank"
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-200 transition hover:border-emerald-300/40"
            >
              <span>View receive tx</span>
              <span className="text-xs text-slate-400">
                {state.receiveTxHash?.slice(0, 10)}…
              </span>
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="w-full rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:border-white/40"
        >
          Bridge again
        </button>
      </div>
    );
  };

  const renderErrorView = () => (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-rose-400/40 bg-rose-500/10">
        <AlertCircle className="h-10 w-10 text-rose-300" />
      </div>
      <div>
        <p className="text-3xl font-semibold text-white">Bridge failed</p>
        <p className="mt-2 text-sm text-slate-300">
          {state.error ?? "Something went wrong while bridging."}
        </p>
      </div>
      <button
        type="button"
        onClick={handleReset}
        className="w-full rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:border-white/40"
      >
        Try again
      </button>
    </div>
  );

  const content =
    state.step === "success"
      ? renderSuccessView()
      : state.step === "error"
        ? renderErrorView()
        : state.isLoading
          ? renderProgressView()
          : renderIdleView();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <section className="glass-card relative overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-slate-400">
              Circle x Arc testnet
            </p>
            <h1 className="text-3xl font-semibold text-white">
              Bridge USDC between Sepolia, Base, and Arc
            </h1>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-wide text-slate-300">
            MetaMask only · USDC balances
          </div>
        </div>

        <div className="mt-8">{content}</div>
      </section>

      {latestTransfer && (
        <section className="glass-card p-6 sm:p-8">
          <p className="text-sm uppercase tracking-wide text-slate-400">
            Latest transfer
          </p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-2xl font-semibold text-white">
                {formatAmount(latestTransfer.amount)} USDC
              </p>
              <p className="text-sm text-slate-400">
                {networkById[latestTransfer.fromNetworkId].shortName} →{" "}
                {networkById[latestTransfer.toNetworkId].shortName}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Status
              </p>
              <p className="text-lg font-semibold text-white">
                {latestTransfer.status}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Started {formatDateTime(latestTransfer.createdAt)}
          </p>
          {latestTransfer.explorerLinks?.destination && (
            <Link
              href={latestTransfer.explorerLinks.destination}
              target="_blank"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-300 hover:text-sky-200"
            >
              View on explorer
            </Link>
          )}
        </section>
      )}
    </div>
  );
}

function ChainSelect({
  label,
  chainId,
  exclude,
  onChange,
}: {
  label: string;
  chainId: number;
  exclude?: number;
  onChange: (value: number) => void;
}) {
  const network = getNetworkByChainId(chainId);
  return (
    <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Image
            src={chainIcons[chainId] ?? "/globe.svg"}
            alt={network?.label ?? "chain"}
            width={40}
            height={40}
            className="rounded-2xl border border-white/20 bg-white/80 object-cover p-1"
          />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {label}
            </p>
            <p className="text-lg font-semibold text-white">{network?.label}</p>
            <p className="text-xs text-slate-400">Chain ID {chainId}</p>
          </div>
        </div>
        <select
          value={chainId}
          onChange={(event) => onChange(Number(event.target.value))}
          className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-white"
        >
          {supportedNetworks
            .filter(
              (candidate) =>
                candidate.chainId === chainId || candidate.chainId !== exclude,
            )
            .map((candidate) => (
              <option
                key={candidate.chainId}
                value={candidate.chainId}
                className="bg-slate-900 text-white"
              >
                {candidate.label}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}
