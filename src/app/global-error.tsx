"use client";

import { useEffect } from "react";

import { StatusPage } from "@/components/website/status-page";

import { fontVariables } from "./fonts";
// Import global styles directly: global-error REPLACES the root layout, so the
// layout's styles and font variables are not in scope.
import "./globals.css";

// Catches errors thrown by the ROOT layout itself. Because it replaces the root
// layout, it must render its own <html> and <body> and stay self-contained.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className={fontVariables}>
      <body className="antialiased">
        <StatusPage
          code="Error"
          title="Something went wrong"
          description="An unexpected error stopped Ace Your Course from loading. Try again in a moment."
          onReset={reset}
          digest={error.digest}
        />
      </body>
    </html>
  );
}
