"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import type { AdminAction } from "@/lib/admin/action";
import type { AdminError } from "@/services/admin.types";

import { callAdminAction } from "./call-admin-action";
import { showSaveFailedToast } from "./save-failed-toast";

interface InstantSaveOptions {
  /** What the "Couldn't save" toast names, e.g. the Product's short name. */
  what: string;
  /** What that toast says is kept, e.g. "The switch is back as it was.". */
  kept: string;
  /** What a refused save says, as a plain toast. */
  refused: (error: AdminError) => string;
}

/**
 * The save path of a control that saves as soon as it's used, with no form
 * and no conflict check: a single toggle such as Show on website or Pin on
 * Home, or ▲▼ (spec, Phase 2 → Conflict check). `save` sends the input,
 * shows the "Couldn't save" toast (with Retry) when the save breaks down or
 * a toast saying why it was refused, and then reads the page again, so it
 * shows what the server now holds. `optimistic` runs first, inside the same
 * transition, for a control that flips before the answer arrives.
 */
export function useInstantSave<T>(
  action: AdminAction<T>,
  { what, kept, refused }: InstantSaveOptions,
) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function save(input: unknown, optimistic?: () => void) {
    startTransition(async () => {
      optimistic?.();
      const state = await callAdminAction(action, { input });
      if (state.status === "failed") {
        showSaveFailedToast({ what, kept, onRetry: () => save(input, optimistic) });
      } else if (state.status === "refused") {
        toast(refused(state.error));
      }
      router.refresh();
    });
  }

  return { save, pending };
}
