"use client";

import { useId } from "react";

import { AdminSwitch } from "@/components/admin/admin-switch";
import { cn } from "@/lib/utils";

interface ContentSwitchProps {
  label: string;
  description: string;
  checked: boolean;
  /** Why it can't be used, shown in its description's place, or null when it can. */
  disabledReason: string | null;
  onChange: (checked: boolean) => void;
  pending: boolean;
}

/**
 * One of a deck's or quiz's switches (tickets 07 and 09): "Visible to
 * members" or "Free Preview", with its label and, when it can't be used,
 * why.
 */
export function ContentSwitch({
  label,
  description,
  checked,
  disabledReason,
  onChange,
  pending,
}: ContentSwitchProps) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-[1_1_220px] items-start gap-2.5">
      <AdminSwitch
        checked={checked}
        onCheckedChange={onChange}
        disabled={pending || disabledReason !== null}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-description`}
        className="disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span id={`${id}-label`} className="text-sm font-bold">
          {label}
        </span>
        <span
          id={`${id}-description`}
          className={cn(
            "text-xs leading-[1.45]",
            disabledReason ? "font-mono font-bold text-destructive" : "text-muted-foreground",
          )}
        >
          {disabledReason ?? description}
        </span>
      </div>
    </div>
  );
}
