import Link from "next/link";

import { paths } from "@/paths";

import { ResetSampleDataButton } from "./reset-sample-data-button";

interface AdminHeaderProps {
  group: string;
  title: string;
  /**
   * Set while the Admin runs on sample data (Stage A): the header shows the red
   * "SAMPLE DATA" tag, with Reset, which calls `reset`.
   */
  sampleData?: { reset: () => Promise<void> };
  /** The screen's primary button, such as "+ Add product". */
  primaryAction?: React.ReactNode;
}

/**
 * Each screen's header (mockup 72–79): the group label and title, the
 * "SAMPLE DATA" tag with Reset, "View site ↗" and the screen's primary action.
 */
export function AdminHeader({ group, title, sampleData, primaryAction }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b-[1.5px] bg-background px-4 py-3.5 wide:px-7">
      <div className="flex flex-col gap-0.5">
        <p className="font-mono text-[11px] font-medium tracking-[0.06em] text-ayc-blue">{group}</p>
        <h1 className="text-[26px] leading-tight font-extrabold tracking-[-0.02em]">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {sampleData ? (
          <>
            <span className="border-[1.5px] border-dashed border-destructive px-1.75 py-1.5 font-mono text-[10px] leading-none font-bold tracking-[0.06em] text-destructive">
              SAMPLE DATA
            </span>
            <ResetSampleDataButton action={sampleData.reset} />
          </>
        ) : null}
        <Link
          href={paths.home}
          className="flex min-h-10 items-center border-[1.5px] px-3.5 text-sm font-semibold hover:bg-ayc-sand"
        >
          {/* A flex item would drop the space before the arrow. */}
          <span>
            View site <span aria-hidden="true">↗</span>
          </span>
        </Link>
        {primaryAction}
      </div>
    </header>
  );
}
