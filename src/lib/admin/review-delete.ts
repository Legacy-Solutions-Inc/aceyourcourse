import type { ReviewDeletePreview } from "@/services/admin.types";

// The Review delete dialog's copy (mockup 1574; BUILD-MAP §2, deleteReview),
// plus how many FAQ quotes go with it (spec, Phase 2 → Deleting).

/** Pure: the dialog's title and body. */
export function reviewDeleteCopy({ faqQuotes }: ReviewDeletePreview): {
  title: string;
  body: string;
} {
  const quotes =
    faqQuotes === 0
      ? null
      : faqQuotes === 1
        ? "1 FAQ quote from this Review is removed."
        : `${faqQuotes} FAQ quotes from this Review are removed.`;
  return {
    title: "Delete this review?",
    body: [
      "It’s removed from Home, its product page, and its exam page.",
      "The original stays on the store.",
      quotes,
      "This can’t be undone.",
    ]
      .filter(Boolean)
      .join(" "),
  };
}
