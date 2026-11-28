"use client";

import { useRef, useState, useTransition } from "react";

/**
 * A list of dismissible banners (the in-app notices, ticket 17; the renewal
 * banners, Phase 4 ticket 12), each with a `button[data-dismiss]`. Dismissing
 * one hides it at once and tells the server; should the server not answer, it
 * comes back and `failed` names it, for the banner's message. Focus moves to
 * the next banner's Dismiss, or the one before, or to the screen's heading
 * after the last.
 */
export function useDismissible(dismiss: (key: string) => Promise<unknown>) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const list = useRef<HTMLUListElement>(null);

  function moveFocusFrom(index: number) {
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button[data-dismiss]");
    const next = buttons?.[index + 1] ?? buttons?.[index - 1];
    if (next) {
      next.focus();
      return;
    }
    const heading = document.querySelector<HTMLElement>("#main h1");
    if (!heading) return;
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus();
  }

  function onDismiss(key: string, index: number) {
    moveFocusFrom(index);
    setFailed(null);
    setDismissed((before) => new Set(before).add(key));
    startTransition(async () => {
      try {
        // An answer of { ok: false } is nothing of theirs to dismiss (a notice
        // deleted with its Exam, say): there's nothing to bring back.
        await dismiss(key);
      } catch {
        setDismissed((before) => {
          const after = new Set(before);
          after.delete(key);
          return after;
        });
        setFailed(key);
      }
    });
  }

  return { list, isDismissed: (key: string) => dismissed.has(key), failed, onDismiss };
}
