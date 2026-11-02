"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { AdminSwitch } from "@/components/admin/admin-switch";
import { callAdminAction } from "@/components/admin/call-admin-action";
import { showSaveFailedToast } from "@/components/admin/save-failed-toast";
import type { AdminAction } from "@/lib/admin/action";
import type { ProductFlags } from "@/services/admin.schema";
import type { AdminError, AdminProductRow } from "@/services/admin.types";

interface ProductFlagSwitchProps {
  productId: string;
  flag: keyof ProductFlags;
  /** The flag as the server last read it. */
  checked: boolean;
  /** The switch's accessible name, e.g. "Show CE Formula Flash Cards on the website". */
  label: string;
  /** The Product's short name, for the messages. */
  title: string;
  action: AdminAction<AdminProductRow>;
}

/**
 * An inline App or Site toggle (mockup 167–168): it flips at once and saves
 * with no conflict check (spec, Phase 2 → Conflict check: single toggles always
 * save). After every answer the list is read again, so it shows what the
 * server now holds. A failed toggle switches back and shows the "Couldn't
 * save" toast; a Product deleted elsewhere says so.
 */
export function ProductFlagSwitch({
  productId,
  flag,
  checked,
  label,
  title,
  action,
}: ProductFlagSwitchProps) {
  const router = useRouter();
  const [shown, show] = useOptimistic(checked);
  const [pending, startTransition] = useTransition();

  function save(next: boolean) {
    startTransition(async () => {
      show(next);
      const state = await callAdminAction(action, { input: { id: productId, [flag]: next } });
      if (state.status === "failed") {
        showSaveFailedToast({
          what: title,
          kept: "The switch is back as it was.",
          onRetry: () => save(next),
        });
      } else if (state.status === "refused") {
        toast(refusalText(state.error.kind, title));
      }
      router.refresh();
    });
  }

  return (
    <AdminSwitch
      checked={shown}
      onCheckedChange={save}
      aria-label={label}
      aria-busy={pending || undefined}
    />
  );
}

/** Pure: what the list says about a toggle that was refused. */
function refusalText(kind: AdminError["kind"], title: string): string {
  return kind === "not-found"
    ? `${title} is no longer in the catalogue, so nothing was changed. The list is up to date.`
    : `${title} wasn’t changed. Reload the page and try again.`;
}
