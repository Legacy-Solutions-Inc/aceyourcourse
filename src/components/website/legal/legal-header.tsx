import { useId } from "react";

import { legalContainer } from "@/components/website/legal/legal-container";
import { legalPageCopy } from "@/content/legal/copy";
import type { LegalDocument } from "@/content/legal/types";
import { formatDate } from "@/lib/manila-time";
import { cn } from "@/lib/utils";

interface LegalHeaderProps {
  document: Pick<LegalDocument, "title" | "version" | "effectiveDate" | "status">;
  /** The LegalSwitcher, shown above the title. */
  switcher: React.ReactNode;
}

/**
 * The document's title, version and effective date, with a visible "Draft,
 * pending legal review" notice under them until the document is final.
 */
export function LegalHeader({ document, switcher }: LegalHeaderProps) {
  const { title, version, effectiveDate, status } = document;
  const draftId = useId();
  return (
    <section className="border-b-[1.5px] border-ayc-navy">
      <div
        className={cn(
          legalContainer,
          "flex flex-col gap-4 pt-[clamp(36px,5vw,72px)] pb-[clamp(28px,4vw,48px)]",
        )}
      >
        {switcher}
        <h1 className="text-[clamp(40px,5.6vw,72px)] leading-none font-extrabold tracking-[-0.035em] text-balance">
          {title}
        </h1>
        <p
          data-testid="legal-version"
          className="font-mono text-xs font-medium tracking-[0.04em] text-ayc-slate uppercase"
        >
          Version {version} · Effective{" "}
          <time dateTime={effectiveDate}>{formatDate(effectiveDate)}</time>
        </p>
        {status === "draft" ? (
          <div
            role="note"
            aria-labelledby={draftId}
            className="flex max-w-[68ch] flex-col gap-1 border-[1.5px] border-dashed border-ayc-navy bg-ayc-paper px-4 py-3"
          >
            <p
              id={draftId}
              className="font-mono text-xs font-bold tracking-[0.06em] text-ayc-blue uppercase"
            >
              {legalPageCopy.draftLabel}
            </p>
            <p className="text-sm leading-normal">{legalPageCopy.draftNote}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
