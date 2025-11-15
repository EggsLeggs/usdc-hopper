import type { ReactNode } from "react";

import { SiteHeader } from "@/components/layout/SiteHeader";

export default function RoutesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <SiteHeader />
      <main className="px-4 pb-16 pt-32 sm:px-8">{children}</main>
    </div>
  );
}

