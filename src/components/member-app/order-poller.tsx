"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { POLL_MS } from "./order-view";

/**
 * Confirming payment's refresh (spec, Phase 4 → Return flow): reads the Order
 * again every few seconds while the screen is open, so it moves on to Paid or
 * Failed, or to "still waiting", by itself. Renders nothing.
 */
export function OrderPoller() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
