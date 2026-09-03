import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Game Store",
  description: "Browse and purchase region-specific digital game items.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
