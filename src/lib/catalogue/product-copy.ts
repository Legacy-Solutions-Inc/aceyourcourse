import { config } from "@/config";
import { websiteCopy } from "@/content/website";
import { productFormatLabel } from "@/lib/catalogue/format";
import type { Exam, Product } from "@/services/catalogue.types";

// Product page text and SEO text. Each one is the Product's own when it is
// set, otherwise a default generated from the Product and its Exam, using the
// mockup's template sentences (docs/mockup/website/Product.dc.html L104–112).

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

/** "Flash cards for the CELE, covering MSTC, HPGE, PSAD. For the board exam…" */
export function productWhatsInside(product: Product, exam: Exam): string {
  return (
    product.whatsInside ??
    `${lead(productFormatLabel(product.format), product, exam)} ${websiteCopy.product.reviewUse}`
  );
}

export function productMadeFor(product: Product, exam: Exam): string[] {
  return (
    product.madeFor ?? [
      `${exam.name} students`,
      websiteCopy.product.boardExamReviewees,
      exam.madeFor,
    ]
  );
}

/** The whole document title, brand included, at most 60 characters. */
export function productSeoTitle(product: Product, exam: Exam): string {
  if (product.seoTitle) return product.seoTitle;
  const brand = ` · ${config.site.name}`;
  const candidates = [
    `${product.shortName} · ${exam.board} Reviewer`,
    `${product.shortName} · ${exam.board}`,
    product.shortName,
  ];
  const fits = candidates.find((title) => title.length + brand.length <= TITLE_MAX);
  return `${fits ?? truncate(product.shortName, TITLE_MAX - brand.length)}${brand}`;
}

/** 80–160 characters: the lead sentence, then as many extra sentences as fit. */
export function productSeoDescription(product: Product, exam: Exam): string {
  if (product.seoDescription) return product.seoDescription;
  const comingSoon = product.state === "coming-soon" ? `${websiteCopy.product.comingSoon}: ` : "";
  let description = `${comingSoon}${lead(product.title, product, exam)}`;
  if (description.length > DESCRIPTION_MAX) {
    description =
      truncate(`${comingSoon}${product.title} for the ${exam.board}`, DESCRIPTION_MAX - 1) + ".";
  }
  for (const sentence of [
    websiteCopy.product.reviewUse,
    `Ships from ${websiteCopy.product.shipsFrom}.`,
  ]) {
    if (description.length + 1 + sentence.length <= DESCRIPTION_MAX) {
      description += ` ${sentence}`;
    }
  }
  return description;
}

/** "{subject} for the {board}, covering {Subject codes}." */
function lead(subject: string, product: Product, exam: Exam): string {
  return `${subject} for the ${exam.board}, covering ${product.subjectCodes.join(", ")}.`;
}

/** Cut at a word boundary so the result, with its "…", is at most `max` long. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const atWord = cut.slice(0, Math.max(cut.lastIndexOf(" "), 1));
  return `${atWord.trimEnd()}…`;
}
