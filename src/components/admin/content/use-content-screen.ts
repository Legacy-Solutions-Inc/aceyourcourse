"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

/**
 * What a deck's or quiz's screen does after its form saves or a row is
 * deleted (tickets 07 and 10): it reads the screen again, and moves the form
 * on. "Save" on a new item opens it; "Save & add next" keeps a new item's
 * form, which clears itself, or opens a new one after an edit. A delete
 * toasts, opens a new item's form when the deleted one was open, and says
 * when it hid the deck or quiz (`nowHidden`), until the next save.
 */
export function useContentScreen({
  noun,
  nowHidden,
  pathOf,
  openId,
}: {
  noun: "CARD" | "QUESTION";
  nowHidden: string;
  /** The screen's address with an item open in the form, or "new". */
  pathOf: (item: string) => string;
  /** The item open in the form, or null for a new one. */
  openId: string | null;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);

  function deleted(gone: { id: string; position: number | null }, hidden: boolean) {
    toast(`✓ DELETED · ${noun} ${gone.position}`);
    setNotice(hidden ? nowHidden : null);
    if (hidden) toast(nowHidden);
    if (gone.id === openId) router.replace(pathOf("new"));
    router.refresh();
  }

  function saved(id: string, next: boolean) {
    setNotice(null);
    if (next) {
      if (openId) router.replace(pathOf("new"));
    } else if (!openId) {
      router.replace(pathOf(id));
    }
    router.refresh();
  }

  return { notice, deleted, saved };
}
