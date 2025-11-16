"use client";

import { useMemo, useState } from "react";
import { Loader2, LogOut, PlugZap, Wallet2 } from "lucide-react";
import { useAccount, useDisconnect } from "wagmi";
import { useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit";

import { networkById } from "@/lib/chains";
import { useUsdcBalance } from "@/hooks/useUsdcBalance";

function truncateAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const primaryNetwork = networkById["ethereum-sepolia"];

export function ConnectButton() {
  const { address, isConnecting } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const [menuOpen, setMenuOpen] = useState(false);

  const { formatted: usdcBalance, isFetching } = useUsdcBalance(
    primaryNetwork,
    address,
  );

  const balanceLabel = useMemo(() => {
    if (!address) return "0.00";
    return usdcBalance.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [address, usdcBalance]);

  const handleConnect = () => {
    openConnectModal?.();
  };

  const handleViewAccount = () => {
    if (openAccountModal) {
      openAccountModal();
    } else {
      setMenuOpen(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectAsync();
    setMenuOpen(false);
  };

  if (!address) {
    return (
      <button
        className="inline-flex items-center gap-3 rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:bg-sky-400 disabled:opacity-70"
        onClick={handleConnect}
        disabled={isConnecting}
      >
        <PlugZap className="h-4 w-4" />
        {isConnecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((prev) => !prev)}
        className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40"
      >
        <div className="text-left">
          <p className="font-semibold text-white">
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
            ) : (
              `${balanceLabel} USDC`
            )}
          </p>
        </div>
        <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-200">
          {truncateAddress(address)}
        </span>
      </button>
      {menuOpen && (
        <div className="absolute right-0 mt-2 min-w-[14rem] rounded-2xl border border-white/10 bg-slate-900/95 p-4 text-sm shadow-xl">
          <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">
            MetaMask connected
          </p>
          <div className="space-y-2">
            <button
              onClick={handleViewAccount}
              className="flex w-full items-center justify-between rounded-xl bg-slate-800 px-3 py-2 text-white transition hover:bg-slate-700"
            >
              <span className="inline-flex items-center gap-2">
                <Wallet2 className="h-4 w-4" />
                View account
              </span>
            </button>
            <button
              onClick={handleDisconnect}
              className="flex w-full items-center justify-between rounded-xl bg-rose-500/10 px-3 py-2 text-rose-200 transition hover:bg-rose-500/20"
            >
              <span className="inline-flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Disconnect
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

