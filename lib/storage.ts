import type { HopperNetworkId } from "./chains";

export type TransferStatus =
  | "pending"
  | "confirming"
  | "minting"
  | "completed"
  | "failed";

export type TransferStepState = "pending" | "success" | "error";

export interface TransferStepRecord {
  id: string;
  label: string;
  state: TransferStepState;
  txHash?: string;
  explorerUrl?: string;
  chainId?: number;
}

export interface StoredTransfer {
  id: string;
  createdAt: string;
  updatedAt: string;
  fromNetworkId: HopperNetworkId;
  toNetworkId: HopperNetworkId;
  amount: string;
  amountOutEstimated?: string;
  status: TransferStatus;
  steps: TransferStepRecord[];
  route?: {
    provider: string;
    routeId?: string;
    etaSeconds?: number;
    feeAmount?: string;
  };
  explorerLinks?: {
    source?: string;
    destination?: string;
  };
  errorMessage?: string;
}

const STORAGE_KEY = "usdc-hopper:transfers";

export function loadTransfers(): StoredTransfer[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredTransfer[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistTransfers(transfers: StoredTransfer[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transfers));
}

export function upsertTransfer(record: StoredTransfer) {
  const current = loadTransfers();
  const updated = [
    record,
    ...current.filter((transfer) => transfer.id !== record.id),
  ].slice(0, 25);

  persistTransfers(updated);
  return updated;
}

export function mutateTransfer(
  id: string,
  updater: (transfer: StoredTransfer) => StoredTransfer
) {
  const current = loadTransfers();
  const updated = current.map((transfer) =>
    transfer.id === id ? updater(transfer) : transfer
  );
  persistTransfers(updated);
  return updated;
}

const NETWORK_PREFERENCES_KEY = "usdc-hopper:network-preferences";

export interface NetworkPreferences {
  fromNetworkId: HopperNetworkId;
  toNetworkId: HopperNetworkId;
}

export function loadNetworkPreferences(): NetworkPreferences | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(NETWORK_PREFERENCES_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as NetworkPreferences;
  } catch {
    return null;
  }
}

export function saveNetworkPreferences(preferences: NetworkPreferences) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    NETWORK_PREFERENCES_KEY,
    JSON.stringify(preferences)
  );
}
