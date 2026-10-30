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

/** The document's title, version and effective date, with a draft label until it's final. */
export function LegalHeader({ document, switcher }: LegalHeaderProps) {
  const { title, version, effectiveDate, status } = document;
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
          {status === "draft" ? ` · ${legalPageCopy.draftLabel}` : null}
        </p>
      </div>
    </section>
  );
}
