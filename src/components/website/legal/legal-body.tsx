import { useId } from "react";

import { legalContainer } from "@/components/website/legal/legal-container";
import { LegalContents } from "@/components/website/legal/legal-contents";
import { legalPageCopy } from "@/content/legal/copy";
import type { LegalDocument } from "@/content/legal/types";
import { listNumber } from "@/lib/text";
import { cn } from "@/lib/utils";

/**
 * The text, with the contact email as a mailto link wherever it appears. The
 * settings schema guarantees the email is a real address, so it's never blank.
 */
function withEmailLinks(text: string, email: string): React.ReactNode {
  return text.split(email).flatMap((part, index) =>
    index === 0
      ? [part]
      : [
          <a
            key={index}
            href={`mailto:${email}`}
            className="font-bold text-ayc-blue underline underline-offset-[0.15em] hover:text-ayc-blue-dark"
          >
            {email}
          </a>,
          part,
        ],
  );
}

interface LegalBodyProps {
  document: Pick<LegalDocument, "summary" | "sections">;
  contactEmail: string;
}

/** The "In short" summary, then the Contents nav beside the numbered sections. */
export function LegalBody({ document, contactEmail }: LegalBodyProps) {
  const summaryId = useId();
  return (
    <>
      <section
        aria-labelledby={summaryId}
        className={cn(legalContainer, "pt-[clamp(28px,4vw,48px)]")}
      >
        <div className="flex flex-col gap-3.5 border-[1.5px] border-ayc-navy bg-ayc-paper p-[clamp(18px,3vw,32px)] shadow-hard-md shadow-ayc-blue">
          <h2
            id={summaryId}
            className="font-mono text-xs font-bold tracking-[0.08em] text-ayc-blue uppercase"
          >
            {legalPageCopy.inShort}
          </h2>
          <ol className="flex flex-col gap-3">
            {document.summary.map((point, index) => (
              <li
                key={point}
                className="grid grid-cols-[32px_minmax(0,1fr)] gap-2.5 text-[17px] leading-normal"
              >
                <span aria-hidden="true" className="font-mono text-sm font-bold text-ayc-blue">
                  {listNumber(index)}
                </span>
                <span>{withEmailLinks(point, contactEmail)}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-ayc-slate">{legalPageCopy.summaryNote}</p>
        </div>
      </section>

      <div
        className={cn(
          legalContainer,
          "flex flex-wrap gap-[clamp(24px,4vw,56px)] pt-[clamp(36px,5vw,64px)] pb-[clamp(56px,7vw,96px)]",
        )}
      >
        <LegalContents sections={document.sections} />
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-7">
          {document.sections.map((section, index) => (
            // scroll-mt clears the sticky site header when a Contents link jumps here.
            <section
              key={section.id}
              id={section.id}
              className="flex scroll-mt-36 flex-col gap-2.5"
            >
              <h2 className="text-[22px] leading-tight font-extrabold tracking-[-0.02em]">
                <span className="mr-1.5 font-mono text-sm font-bold text-ayc-blue">
                  {index + 1}
                </span>{" "}
                {section.title}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-base leading-[1.65] text-pretty">
                  {withEmailLinks(paragraph, contactEmail)}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
