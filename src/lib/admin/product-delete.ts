import type { ProductDeletePreview } from "@/services/admin.types";

// The typed-DELETE dialog's copy for a Product (mockup 1569; spec, Phase 2 →
// Deleting): the mockup's sentences, with exact counts of what goes with it.

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Pure: the dialog's title and body for deleting this Product. */
export function productDeleteCopy(
  shortName: string,
  examCode: string,
  { reviews, photos, faqQuotes }: ProductDeletePreview,
): { title: string; body: string } {
  const sentences = [
    `It disappears from the website, the Products page, and the ${examCode} exam page.`,
    reviews === 0 && photos === 0
      ? "No Reviews or photos are deleted with it."
      : `${count(reviews, "Review", "Reviews")} and ${count(photos, "photo", "photos")} are deleted with it.`,
  ];
  if (faqQuotes > 0) {
    sentences.push(
      `${count(faqQuotes, "FAQ quote", "FAQ quotes")} from its Reviews ${faqQuotes === 1 ? "is" : "are"} removed.`,
    );
  }
  sentences.push(
    "Store listings on Shopee, Lazada, and TikTok Shop are not affected.",
    "This can’t be undone.",
  );
  return { title: `Delete “${shortName}”?`, body: sentences.join(" ") };
}
