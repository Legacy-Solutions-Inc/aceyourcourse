import Link from "next/link";

import { type ReviewsTab, reviewsTabHref } from "@/lib/admin/review-list";
import { cn } from "@/lib/utils";

const TABS: { tab: ReviewsTab; label: string }[] = [
  { tab: "reviews", label: "REVIEWS" },
  { tab: "faqs", label: "FAQS" },
];

/**
 * REVIEWS and FAQS (mockup 232–234). Each is its own address, so they're
 * links, the current one marked as the page.
 */
export function ReviewsTabs({ tab }: { tab: ReviewsTab }) {
  return (
    <nav aria-label="Reviews and FAQs" className="flex border-b-[1.5px]">
      {TABS.map(({ tab: key, label }) => (
        <Link
          key={key}
          href={reviewsTabHref(key)}
          aria-current={key === tab ? "page" : undefined}
          className={cn(
            "-mr-[1.5px] border-[1.5px] border-b-0 px-4.5 py-2.5 font-mono text-[13px] font-bold tracking-[0.04em]",
            key === tab ? "bg-primary text-primary-foreground" : "bg-ayc-paper hover:bg-ayc-sand",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
