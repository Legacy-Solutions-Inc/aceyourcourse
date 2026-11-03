"use client";

import { type ReactNode, useId } from "react";

import { cn } from "@/lib/utils";

// The Product editor's fields, in the mockup's style (mockup 177–228): mono
// uppercase labels over hard-bordered inputs, red with the last save's message
// when it refused them.

const LABEL = "font-mono text-xs font-medium text-muted-foreground";
const INPUT =
  "w-full min-w-0 border-[1.5px] bg-white px-2.5 py-2.25 text-sm font-medium text-foreground placeholder:text-muted-foreground aria-invalid:border-destructive";

function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} className="font-mono text-[11px] font-medium text-destructive">
      {error}
    </p>
  ) : null;
}

/** A section's heading inside the panel: "PRICE & VARIATIONS" (mockup 191). */
export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 border-t-[1.5px] pt-3">
      <h3 id={id} className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">
        {title}
      </h3>
      {children}
    </section>
  );
}

interface TextFieldProps {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  inputMode?: "text" | "decimal" | "numeric" | "url";
  /** A textarea, for paragraphs and one-per-line lists. */
  multiline?: boolean;
  /** Read out after the label: a counter or a note. */
  describedBy?: string;
  /** Shown beside the label, e.g. the SEO counters. */
  aside?: ReactNode;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
}

/** One labelled text field, or a textarea. */
export function TextField({
  label,
  value,
  onChange,
  error,
  placeholder,
  inputMode,
  multiline = false,
  describedBy,
  aside,
  className,
  inputClassName,
  labelClassName,
}: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const shared = {
    id,
    value,
    placeholder,
    "aria-invalid": error ? true : undefined,
    "aria-describedby":
      [error ? errorId : null, describedBy].filter(Boolean).join(" ") || undefined,
  };
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className={cn(LABEL, labelClassName)}>
          {label}
        </label>
        {aside}
      </div>
      {multiline ? (
        <textarea
          {...shared}
          onChange={(event) => onChange(event.target.value)}
          className={cn(INPUT, "min-h-16 resize-y leading-[1.45]", inputClassName)}
        />
      ) : (
        <input
          {...shared}
          inputMode={inputMode}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
          className={cn(INPUT, inputClassName)}
        />
      )}
      <FieldError id={errorId} error={error} />
    </div>
  );
}

interface CountedFieldProps {
  label: string;
  max: number;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/** A field with its limit, counted as it's saved, trimmed (spec, Phase 2 → Exam pages & promo). */
export function CountedField({ max, value, ...field }: CountedFieldProps) {
  const counter = useId();
  const length = value.trim().length;
  return (
    <TextField
      {...field}
      value={value}
      describedBy={counter}
      aside={
        <span
          id={counter}
          className={cn(
            "font-mono text-xs font-medium",
            length > max ? "text-destructive" : "text-ayc-success",
          )}
        >
          {length} / {max}
          <span className="sr-only"> characters</span>
        </span>
      }
    />
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  error?: string;
}

/** A labelled select: the Exam, the format. */
export function SelectField({ label, value, options, onChange, error }: SelectFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(INPUT, "cursor-pointer")}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError id={errorId} error={error} />
    </div>
  );
}

interface ChipsFieldProps {
  label: string;
  options: readonly string[];
  chosen: readonly string[];
  onChange: (chosen: string[]) => void;
  error?: string;
}

/** Multi-select chips: SUBJECTS COVERED (mockup 188–189). Each is a toggle button. */
export function ChipsField({ label, options, chosen, onChange, error }: ChipsFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div
      role="group"
      aria-labelledby={id}
      aria-describedby={error ? errorId : undefined}
      className="flex flex-col gap-1.5"
    >
      <span id={id} className={LABEL}>
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = chosen.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              onClick={() =>
                onChange(on ? chosen.filter((c) => c !== option) : [...chosen, option])
              }
              className={cn(
                "min-h-8 cursor-pointer border-[1.5px] px-2.5 font-mono text-[11px] font-bold",
                on ? "bg-ayc-blue text-ayc-cream" : "bg-ayc-paper text-foreground",
                error && "border-destructive",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      <FieldError id={errorId} error={error} />
    </div>
  );
}

/** The ids that name and describe a row's switch, to spread onto it. */
export interface ToggleRowIds {
  "aria-labelledby": string;
  "aria-describedby": string;
}

interface ToggleRowProps {
  label: string;
  hint: string;
  /** The hint's colour, when it warns. */
  hintClassName?: string;
  /** The switch, named by the label: a form field, or a single toggle that saves at once. */
  children: (ids: ToggleRowIds) => ReactNode;
}

/** One of VISIBILITY's rows: the label and its hint, and the switch (mockup 220–221). */
export function ToggleRow({ label, hint, hintClassName, children }: ToggleRowProps) {
  const id = useId();
  const ids = { "aria-labelledby": `${id}-label`, "aria-describedby": `${id}-hint` };
  return (
    <div className="flex items-center justify-between gap-2.5">
      <span className="flex flex-col gap-0.5">
        <span id={ids["aria-labelledby"]} className="text-sm font-bold">
          {label}
        </span>
        <span
          id={ids["aria-describedby"]}
          className={cn("text-xs text-muted-foreground", hintClassName)}
        >
          {hint}
        </span>
      </span>
      {children(ids)}
    </div>
  );
}
