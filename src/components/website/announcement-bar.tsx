"use client";

import Link from "next/link";
import { Sparkle, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

// The dismissed announcement's id is remembered in the browser, so the bar
// stays hidden on later visits until the announcement (its id) changes. Every
// storage access is guarded: with storage blocked, dismissing still hides the
// bar for the rest of the visit.
const DISMISSED_KEY = "ayc.announcement.dismissed";
const ROTATE_MS = 4500;

function readDismissedId(): string | null {
  try {
    return window.localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

function rememberDismissed(id: string): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, id);
  } catch {
    // Storage blocked: the dismissal lasts for this visit only.
  }
}

function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

// The server can't see storage, so it always renders the bar. The client then
// reads the stored id and hides the bar if it was dismissed.
const readDismissedIdOnServer = () => null;

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface AnnouncementBarProps {
  /** Changing the id shows the bar again to Visitors who dismissed it. */
  id: string;
  /** Already filtered by the Member App switch. */
  messages: ReadonlyArray<{ text: string; href: string }>;
}

export function AnnouncementBar({ id, messages }: AnnouncementBarProps) {
  const dismissedId = useSyncExternalStore(
    subscribeToStorage,
    readDismissedId,
    readDismissedIdOnServer,
  );
  const [dismissedThisVisit, setDismissedThisVisit] = useState(false);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const hidden = dismissedThisVisit || dismissedId === id;
  const count = messages.length;
  const paused = hovered || focused;

  useEffect(() => {
    if (hidden || paused || count < 2 || prefersReducedMotion()) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [hidden, paused, count]);

  const message = messages[index % count];
  if (hidden || !message) return null;

  function dismiss() {
    setDismissedThisVisit(true);
    rememberDismissed(id);
  }

  return (
    <div
      className="relative flex min-h-8.5 items-center justify-center gap-3 bg-ayc-blue px-11 text-center font-mono text-[11px] leading-[1.3] font-medium tracking-[0.06em] text-ayc-cream uppercase"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <Sparkle aria-hidden="true" className="size-3 shrink-0 fill-ayc-orange text-ayc-orange" />
      <Link
        key={index}
        href={message.href}
        className="animate-in py-2.25 text-ayc-cream underline-offset-2 duration-300 fade-in slide-in-from-bottom-1 hover:text-ayc-cream hover:underline focus-visible:outline-ayc-cream motion-reduce:animate-none"
      >
        {message.text}
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center text-ayc-cream opacity-80 hover:opacity-100 focus-visible:outline-ayc-cream"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}
