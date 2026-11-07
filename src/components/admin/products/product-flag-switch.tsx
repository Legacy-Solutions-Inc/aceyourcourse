"use client";

import { useOptimistic } from "react";

import { AdminSwitch } from "@/components/admin/admin-switch";
import { useInstantSave } from "@/components/admin/use-instant-save";
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
 * with no conflict check (useInstantSave). A failed toggle switches back and
 * shows the "Couldn't save" toast; a Product deleted elsewhere says so.
 */
export function ProductFlagSwitch({
  productId,
  flag,
  checked,
  label,
  title,
  action,
}: ProductFlagSwitchProps) {
  const [shown, show] = useOptimistic(checked);
  const { save, pending } = useInstantSave(action, {
    what: title,
    kept: "The switch is back as it was.",
    refused: (error) => refusalText(error.kind, title),
  });

  return (
    <AdminSwitch
      checked={shown}
      onCheckedChange={(next) => save({ id: productId, [flag]: next }, () => show(next))}
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
