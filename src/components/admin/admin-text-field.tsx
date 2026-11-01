import { type ChangeEvent, type HTMLInputTypeAttribute, useId } from "react";

import { cn } from "@/lib/utils";

interface AdminTextFieldProps {
  /** The mono uppercase label, e.g. "SHOPEE". */
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  /** The field's message from the last save, shown under it in red. */
  error?: string;
  type?: HTMLInputTypeAttribute;
  inputMode?: "text" | "decimal" | "numeric" | "email" | "url";
  autoComplete?: string;
  placeholder?: string;
  /** The contact email is set larger and bolder (mockup 682). */
  emphasis?: boolean;
  className?: string;
}

/**
 * One labelled field in an Admin editor, in the mockup's style (mockup 687–690):
 * a mono label over a hard-bordered input, red with its message when the last
 * save refused it.
 */
export function AdminTextField({
  label,
  error,
  emphasis = false,
  className,
  type = "text",
  ...input
}: AdminTextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="font-mono text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "w-full min-w-0 border-[1.5px] bg-white px-2.5 py-2.25 font-mono text-[13px] text-foreground aria-invalid:border-destructive",
          emphasis && "px-3 py-2.5 text-[15px] font-semibold",
        )}
        {...input}
      />
      {error ? (
        <p id={errorId} className="font-mono text-[11px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
