"use client";

import { useCallback, useEffect, useState } from "react";

import type { StoredTransfer } from "@/lib/storage";
import { loadTransfers, persistTransfers } from "@/lib/storage";

export function useTransfers() {
  const [transfers, setTransfers] = useState<StoredTransfer[]>(() =>
    loadTransfers(),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setTransfers(loadTransfers());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const persist = useCallback((next: StoredTransfer[]) => {
    setTransfers(next);
    persistTransfers(next);
  }, []);

  const addTransfer = useCallback((transfer: StoredTransfer) => {
    persist(
      [transfer, ...transfers.filter((item) => item.id !== transfer.id)].slice(
        0,
        25,
      ),
    );
  }, [persist, transfers]);

  const updateTransfer = useCallback(
    (id: string, updater: (transfer: StoredTransfer) => StoredTransfer) => {
      persist(
        transfers.map((transfer) =>
          transfer.id === id ? updater(transfer) : transfer,
        ),
      );
    },
    [persist, transfers],
  );

  const refreshTransfers = useCallback(() => {
    setTransfers(loadTransfers());
  }, []);

  return {
    transfers,
    addTransfer,
    updateTransfer,
    refreshTransfers,
  };
}

