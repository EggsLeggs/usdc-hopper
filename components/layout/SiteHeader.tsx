"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ConnectButton } from "@/components/wallet/ConnectButton";

const tabs = [
  { href: "/bridge", label: "Bridge" },
  { href: "/transactions", label: "Transactions" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-3xl border border-white/10 bg-slate-900/70 px-6 py-4 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-400 p-[2px]">
              <div className="flex h-full w-full items-center justify-center rounded-[1rem] bg-slate-950 text-lg font-black text-white">
                UH
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-400">Circle x Arc</p>
              <p className="text-lg font-semibold text-white">USDC Hopper</p>
            </div>
          </div>
        </div>
        <nav className="flex items-center gap-1 rounded-full bg-white/5 p-1">
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-white text-slate-900 shadow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <ConnectButton />
      </div>
    </header>
  );
}

