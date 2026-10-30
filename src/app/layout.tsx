import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";

import { Toaster } from "@/components/ui/sonner";
import { config } from "@/config";

import { BRAND_COLORS } from "./brand";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(config.site.url),
  title: {
    default: config.site.name,
    template: `%s · ${config.site.name}`,
  },
  description: config.site.description,
  applicationName: config.site.name,
  openGraph: {
    type: "website",
    siteName: config.site.name,
    title: config.site.name,
    description: config.site.description,
    url: "/",
    locale: "en_PH",
  },
  twitter: {
    card: "summary_large_image",
    title: config.site.name,
    description: config.site.description,
  },
};

// Light-only (no dark mode): tell the browser not to darken form controls or
// scrollbars, and colour the mobile browser bar navy.
export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: BRAND_COLORS.navy,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Read a request header so this layout — and therefore every route — renders
  // dynamically per request. That lets Next.js apply the per-request CSP nonce
  // (set in src/middleware.ts) to its own framework scripts, which the enforced
  // strict CSP requires. Nonces are per-request, so pages cannot be static.
  await headers();

  return (
    <html lang="en" className={fontVariables}>
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
