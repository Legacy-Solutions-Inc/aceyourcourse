"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { POLL_MS, STATUS_CHECK_AFTER_MS } from "./order-view";

export interface OrderPollerProps {
  /**
   * The status-check backup (ticket 04): has the server ask the payments
   * client for this Order's status. Null where there's no client.
   */
  check: (() => Promise<void>) | null;
}

/**
 * Confirming payment's refresh (spec, Phase 4 → Return flow; Phase 4
 * planning decisions → Recording an outcome): reads the Order again every few
 * seconds while the screen is open, so it moves on to Paid or Failed, or to
 * "still waiting", by itself. After about 15 seconds on the screen with no
 * outcome, each read first has the server ask PayMongo, which covers a slow
 * webhook or none; the server keeps that to once every 10 seconds per Order.
 * Renders nothing.
 */
export function OrderPoller({ check }: OrderPollerProps) {
  const router = useRouter();
  // Each read renders the page again and binds the check anew, so the latest
  // one is kept aside and the clock runs from when the screen opened.
  const latestCheck = useRef(check);
  useEffect(() => {
    latestCheck.current = check;
  }, [check]);
  useEffect(() => {
    const openedAt = Date.now();
    let busy = false;
    const timer = setInterval(() => {
      if (busy) return;
      busy = true;
      const current = latestCheck.current;
      const asking = current && Date.now() - openedAt >= STATUS_CHECK_AFTER_MS ? current() : null;
      // A failed check changes nothing: the next read asks again.
      void Promise.resolve(asking)
        .catch(() => {})
        .finally(() => {
          busy = false;
          router.refresh();
        });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
