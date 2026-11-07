import Link from "next/link";

import { faqListHref } from "@/lib/admin/faq-list";
import { productListHref } from "@/lib/admin/product-list";
import { reviewListHref } from "@/lib/admin/review-list";
import { cn } from "@/lib/utils";

/** Each opens its screen with the new form (CONVENTIONS §2); the mockup's only navigate. */
const ACTIONS = [
  { label: "Add product", href: productListHref({ q: null, exam: null, missing: false }, "new") },
  {
    label: "Add Review",
    href: reviewListHref({ q: null, exam: null, stars: null, pinned: false }, "new"),
  },
  { label: "Add FAQ", href: faqListHref({}, "new") },
];

/** The Overview's quick actions (mockup 707, 1664), the first in orange. */
export function QuickActions() {
  return (
    <nav aria-label="Quick actions" className="flex flex-wrap gap-2">
      {ACTIONS.map(({ label, href }, index) => (
        <Link
          key={label}
          href={href}
          className={cn(
            "flex min-h-11 items-center gap-2 border-[1.5px] px-3.5 text-sm font-bold transition-transform hover:-translate-x-px hover:-translate-y-px motion-reduce:transition-none",
            index === 0 ? "bg-ayc-orange shadow-hard-sm" : "bg-ayc-paper",
          )}
        >
          <span aria-hidden className="font-mono text-[13px]">
            +
          </span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
