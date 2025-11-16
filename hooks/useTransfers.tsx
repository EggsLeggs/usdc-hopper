"use client";

import { useCallback, useEffect, useState } from "react";

import type { StoredTransfer } from "@/lib/storage";
import { clearTransfers, loadTransfers, persistTransfers } from "@/lib/storage";

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

  const persist = useCallback(
    (updater: (current: StoredTransfer[]) => StoredTransfer[]) => {
      setTransfers((current) => {
        const next = updater(current);
        persistTransfers(next);
        return next;
      });
    },
    [],
  );

  const addTransfer = useCallback(
    (transfer: StoredTransfer) => {
      persist((current) =>
        [transfer, ...current.filter((item) => item.id !== transfer.id)].slice(
          0,
          25,
        ),
      );
    },
    [persist],
  );

  const updateTransfer = useCallback(
    (id: string, updater: (transfer: StoredTransfer) => StoredTransfer) => {
      persist((current) =>
        current.map((transfer) =>
          transfer.id === id ? updater(transfer) : transfer,
        ),
      );
    },
    [persist],
  );

  const refreshTransfers = useCallback(() => {
    setTransfers(loadTransfers());
  }, []);

  const resetTransfers = useCallback(() => {
    clearTransfers();
    setTransfers([]);
  }, []);

  return {
    transfers,
    addTransfer,
    updateTransfer,
    refreshTransfers,
    resetTransfers,
  };
}

