"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, PlugZap } from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

function truncateAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ConnectButton() {
  const { address, isConnecting } = useAccount();
  const { connectors, connectAsync, status: connectStatus } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const readyConnectors = useMemo(() => {
    if (!mounted) return [];
    // Show connectors that are ready, or if no connectors are ready but we have window.ethereum, show injected connector
    const ready = connectors.filter((connector) => connector.ready);
    if (ready.length === 0 && typeof window !== "undefined" && window.ethereum) {
      // Fallback: if MetaMask is installed but not detected, try to show injected connector anyway
      const injectedConnector = connectors.find((c) => c.id === "injected" || c.id.includes("injected"));
      if (injectedConnector) {
        return [injectedConnector];
      }
    }
    return ready;
  }, [connectors, mounted]);

  const handleConnect = async (connectorId: string) => {
    setIsBusy(true);
    try {
      const connector = readyConnectors.find((item) => item.id === connectorId);
      if (!connector) {
        throw new Error("Connector unavailable.");
      }
      await connectAsync({ connector });
      setOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setIsBusy(true);
    try {
      await disconnectAsync();
      setOpen(false);
    } finally {
      setIsBusy(false);
    }
  };

  if (address) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40"
        >
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          {truncateAddress(address)}
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-white/10 bg-slate-900/95 p-3 text-sm shadow-xl">
            <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">
              Wallet connected
            </p>
            <button
              onClick={handleDisconnect}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 py-2 font-medium text-white transition hover:bg-slate-700"
              disabled={isBusy}
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlugZap className="h-4 w-4" />
              )}
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        className="inline-flex items-center gap-3 rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:bg-sky-400 disabled:opacity-70"
        onClick={() => setOpen((prev) => !prev)}
        disabled={isConnecting || connectStatus === "pending"}
      >
        <PlugZap className="h-4 w-4" />
        {isConnecting ? "Connecting…" : "Connect wallet"}
      </button>
      {open && (
        <div className="absolute right-0 mt-3 w-60 rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl">
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">
            Choose a wallet
          </p>
          <div className="space-y-2">
            {readyConnectors.map((connector) => (
              <button
                key={connector.id}
                onClick={() => handleConnect(connector.id)}
                disabled={isBusy}
                className="w-full rounded-xl bg-slate-900 px-3 py-2 text-left text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {connector.name}
              </button>
            ))}
            {readyConnectors.length === 0 && (
              <p className="text-sm text-slate-500">
                No compatible wallets detected.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

