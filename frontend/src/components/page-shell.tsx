import type { ReactNode } from "react";

import { AccountActions } from "@/features/auth/account-actions";

import { StoreMark } from "./store-mark";

export function PageShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[var(--background)]/85 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5 sm:px-8">
          <StoreMark />
          <AccountActions />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">{children}</main>
    </div>
  );
}
