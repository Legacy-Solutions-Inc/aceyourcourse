import Link from "next/link";

import { legalPageCopy } from "@/content/legal/copy";
import type { LegalDocument, LegalKind } from "@/content/legal/types";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";

interface LegalSwitcherProps {
  current: LegalKind;
  documents: Pick<LegalDocument, "kind" | "title">[];
}

/** Links between the legal documents, styled as tabs. Each is its own page. */
export function LegalSwitcher({ current, documents }: LegalSwitcherProps) {
  return (
    <nav aria-label={legalPageCopy.switcherLabel}>
      <ul className="flex flex-wrap gap-1.5">
        {documents.map(({ kind, title }) => {
          const active = kind === current;
          return (
            <li key={kind}>
              <Link
                href={paths.legal[kind]}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center border-[1.5px] border-ayc-navy px-4 font-mono text-[13px] font-bold tracking-[0.04em] uppercase no-underline",
                  active ? "bg-ayc-navy text-ayc-cream" : "text-ayc-navy hover:bg-ayc-sand",
                )}
              >
                {title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
