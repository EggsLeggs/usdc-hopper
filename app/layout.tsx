import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppProviders } from "@/components/providers/AppProviders";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "USDC Hopper",
  description:
    "Bridge testnet USDC between Circle CCTP chains and Arc with a single click.",
  metadataBase: new URL("https://usdc-hopper.dev"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-slate-950 text-slate-100 antialiased`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
