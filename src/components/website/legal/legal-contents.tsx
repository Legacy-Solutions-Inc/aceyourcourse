import { useId } from "react";

import { legalPageCopy } from "@/content/legal/copy";
import type { LegalSection } from "@/content/legal/types";

/** The anchor nav: one link to each numbered section (#s1, #s2, …). */
export function LegalContents({ sections }: { sections: LegalSection[] }) {
  const labelId = useId();
  return (
    <nav aria-labelledby={labelId} className="flex flex-[0_1_220px] flex-col text-sm">
      <p
        id={labelId}
        className="pb-2 font-mono text-[11px] font-bold tracking-[0.08em] text-ayc-slate uppercase"
      >
        {legalPageCopy.contents}
      </p>
      <ol className="flex flex-col gap-0.5">
        {sections.map((section, index) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="block border-b border-ayc-ruled py-1.5 text-ayc-navy no-underline hover:text-ayc-blue"
            >
              {index + 1}. {section.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
