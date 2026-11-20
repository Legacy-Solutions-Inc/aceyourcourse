"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { StudyStreak } from "@/lib/member-app/progress";

// The shell's Study Streak, for the sidebar's streak button (mockup L132;
// story 90). The shell's layout reads it on the server, but a layout stays
// as it is while the Member moves between screens, so after a first Study
// Day the button would still say yesterday's streak. Home's dashboard reads
// the streak afresh on every visit and shares its read here; whichever read
// is newer is the one shown, so the button and the streak card never
// disagree. Only the Member's own streak, read on the server for this
// signed-in Member, is ever shared.

/** What the streak button says of the Member's Study Streak. */
export type ShellStreak = Pick<StudyStreak, "current" | "studiedToday">;

/** A read of the streak, and when the server made it (ms since the epoch). */
export interface StreakRead extends ShellStreak {
  readAt: number;
}

interface ShellStreakValue {
  streak: ShellStreak | null;
  share: (read: StreakRead) => void;
}

const ShellStreakContext = createContext<ShellStreakValue>({ streak: null, share: () => {} });

/** Holds the layout's read of the streak, and any newer read a screen shares. */
export function ShellStreakProvider({
  initial,
  children,
}: {
  initial: StreakRead;
  children: React.ReactNode;
}) {
  const [shared, setShared] = useState<StreakRead | null>(null);
  const latest = shared && shared.readAt > initial.readAt ? shared : initial;
  const { current, studiedToday } = latest;
  const value = useMemo(
    () => ({ streak: { current, studiedToday }, share: setShared }),
    [current, studiedToday],
  );
  return <ShellStreakContext value={value}>{children}</ShellStreakContext>;
}

/** The Member's Study Streak as the shell knows it, or null outside the shell. */
export const useShellStreak = () => useContext(ShellStreakContext).streak;

/**
 * Shares a fresh read of the Member's streak with the shell's button, which
 * lives in the layout, outside this screen's tree. Renders nothing.
 */
export function ShareStreak({ read }: { read: StreakRead }) {
  const { share } = useContext(ShellStreakContext);
  const { current, studiedToday, readAt } = read;
  useEffect(() => share({ current, studiedToday, readAt }), [share, current, studiedToday, readAt]);
  return null;
}

/** Pure: the streak button's words (mockup L132): "6-DAY STREAK" and what to do today. */
export function streakButtonWords({ current, studiedToday }: ShellStreak): {
  label: string;
  hint: string;
} {
  if (current === 0) return { label: "START A STREAK", hint: "STUDY TODAY" };
  return { label: `${current}-DAY STREAK`, hint: studiedToday ? "DONE TODAY" : "STUDY TODAY" };
}
