import { cn } from "@/lib/utils";

/** What a chip's count is of, read after it by screen readers: "1 review", "3 reviews". */
export interface CountNoun {
  one: string;
  other: string;
}

/** A row of filter chips, named by its label (shown, but not read twice). */
export function FilterChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span
        aria-hidden="true"
        className="mr-1 font-mono text-[11px] font-medium tracking-[0.04em] text-ayc-slate uppercase"
      >
        {label}
      </span>
      {children}
    </div>
  );
}

interface FilterChipProps {
  pressed: boolean;
  /** How many it would show. A chip with none is disabled, not hidden. */
  count: number;
  noun: CountNoun;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}

/** A toggle in a filter row, with its count. */
export function FilterChip({
  pressed,
  count,
  noun,
  onClick,
  className,
  children,
}: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={count === 0 && !pressed}
      onClick={onClick}
      className={cn(
        "flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-ayc-navy px-3 text-[13px] font-bold transition-colors hover:bg-ayc-sand disabled:cursor-not-allowed disabled:border-ayc-rule disabled:text-ayc-slate disabled:hover:bg-transparent aria-pressed:bg-ayc-navy aria-pressed:text-ayc-cream motion-reduce:transition-none",
        className,
      )}
    >
      {children}
      <span className="font-mono text-[11px] font-medium">
        {count}
        <span className="sr-only"> {count === 1 ? noun.one : noun.other}</span>
      </span>
    </button>
  );
}
