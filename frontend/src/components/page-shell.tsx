import type { ReactNode } from "react";

import { AccountActions } from "@/features/auth/account-actions";

import { StoreMark } from "./store-mark";

export function PageShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
          <StoreMark />
          <AccountActions />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">{children}</main>
    </div>
  );
}
