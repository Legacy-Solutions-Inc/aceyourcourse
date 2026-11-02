import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type AdminSwitchProps = Omit<ComponentProps<"button">, "type" | "role" | "onClick"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/**
 * The Admin's on/off switch, in the mockup's style (mockup 167–168, 220–221):
 * a 36 × 20 track. The button around it is 24 px tall, so the target meets
 * WCAG 2.2's 24 × 24 minimum without changing the look. Name it with
 * `aria-label` or `aria-labelledby`.
 */
export function AdminSwitch({ checked, onCheckedChange, className, ...props }: AdminSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn("flex h-6 w-9 flex-none cursor-pointer items-center", className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative h-5 w-9 rounded-full border-[1.5px] border-ayc-navy transition-colors motion-reduce:transition-none",
          checked ? "bg-ayc-blue" : "bg-ayc-rule",
        )}
      >
        <span
          className={cn(
            "absolute top-px size-3.5 rounded-full bg-white transition-[left] motion-reduce:transition-none",
            checked ? "left-4.5" : "left-px",
          )}
        />
      </span>
    </button>
  );
}
