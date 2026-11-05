import { config } from "@/config";
import { MARKETPLACES, marketplaceShops, websiteCopy } from "@/content/website";
import { productPriceRange } from "@/lib/catalogue/price";
import { paths } from "@/paths";
import type { Exam, FaqGroupWithItems, Product, WebsiteSettings } from "@/services/catalogue.types";

// The Website's summary for AI assistants, served at /llms.txt (ticket 22;
// spec, Phase 2 → Summary for AI assistants). It follows llmstxt.org's
// proposed format: an H1 with the name, a blockquote summary, then H2
// sections of "- [name](url): notes" links. Built from what the Website
// already shows, so nobody edits it. Like the structured data, it never
// carries Review text or Shopee figures (the spec's Phase 1 SEO).

/** What the summary is built from: the Catalogue seam's Website reads. */
export interface LlmsTxtCatalogue {
  /** The Exams on the Website: listExams(). */
  exams: readonly Exam[];
  /** Every Product on the Website, Live then Coming Soon, each in the Website's order. */
  products: readonly Product[];
  /** The FAQ page's visible FAQs: listFaqs(). */
  faqs: readonly FaqGroupWithItems[];
  shopLinks: WebsiteSettings["shopLinks"];
}

/** The Site pages, in the Website's menu order. */
const PAGES = [
  ["Home", paths.home],
  ["All reviewers", paths.products.list],
  ["FAQ", paths.faq],
  ["Reviews", paths.reviews],
  ["About", paths.about],
] as const;

/**
 * Pure: catalogue text as Markdown text on one line, so no heading or list
 * item can start inside it. A line break after a sentence becomes a space,
 * any other (a list's) a semicolon. The characters that make emphasis, links,
 * code, headings or HTML are backslash-escaped.
 */
export function markdownText(text: string): string {
  return text
    .trim()
    .replace(/([^.!?:\s])[^\S\n]*\n\s*/g, "$1; ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\\`*_[\]<>~#]/g, (character) => `\\${character}`);
}

/** Pure: an address that can't end its Markdown link early: brackets and spaces encoded. */
const markdownUrl = (url: string) =>
  url.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");

const link = (name: string, url: string) => `[${markdownText(name)}](${markdownUrl(url)})`;

const absolute = (path: string, siteUrl: string) => new URL(path, siteUrl).href;

/** Pure: "A", "A or B", "A, B or C", with "and" or "or" before the last. */
const listOf = (items: readonly string[], last: "and" | "or") =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} ${last} ${items.at(-1)}`;

function productLine(product: Product, siteUrl: string): string {
  const page = link(product.title, absolute(paths.products.details(product.slug), siteUrl));
  const price = productPriceRange(product);
  // Coming Soon is announced, not for sale: no price and no buy link.
  if (price === null) return `- ${page}: ${websiteCopy.product.comingSoon}`;
  const listings = MARKETPLACES.flatMap(({ id, name }) => {
    const listing = product.listings[id];
    return listing ? [link(name, listing)] : [];
  });
  return `- ${page}: ${price}${listings.length > 0 ? `. Buy on ${listOf(listings, "or")}` : ""}`;
}

function examSection(exam: Exam, products: readonly Product[], siteUrl: string): string[] {
  const page = link(`${exam.longName} page`, absolute(paths.exams.details(exam.code), siteUrl));
  const subjects = exam.subjects.map((subject) => markdownText(subject.name));
  const live = products.filter((product) => product.state === "live");
  const comingSoon = products.filter((product) => product.state === "coming-soon");
  return [
    `## ${markdownText(`${exam.name} (${exam.board})`)}`,
    "",
    `- ${page}${subjects.length > 0 ? `: Subjects: ${subjects.join("; ")}` : ""}`,
    ...[...live, ...comingSoon].map((product) => productLine(product, siteUrl)),
  ];
}

/** Pure: the summary as Markdown, its links absolute on `siteUrl`. */
export function buildLlmsTxt(siteUrl: string, catalogue: LlmsTxtCatalogue): string {
  const products = catalogue.products.filter((product) => product.showOnWebsite);
  const shops = marketplaceShops(catalogue.shopLinks);
  const { whoWeAre } = websiteCopy.llmsTxt;
  const sellsOn =
    shops.length > 0
      ? ` It sells them on ${listOf(
          shops.map((shop) => shop.name),
          "and",
        )}, and`
      : " It";

  const exams = catalogue.exams.flatMap((exam) => {
    const own = products.filter((product) => product.examCode === exam.code);
    return own.length > 0 ? [examSection(exam, own, siteUrl)] : [];
  });
  const faqs = catalogue.faqs
    .flatMap((group) => group.items)
    .filter((faq) => faq.showOnFaqPage)
    .map((faq) => {
      const url = absolute(`${paths.faq}#faq-${faq.slug}`, siteUrl);
      return `- ${link(faq.question, url)}: ${markdownText(faq.answer)}`;
    });

  const sections = [
    [`# ${config.site.name}`],
    [
      `> ${config.site.name} ${whoWeAre}${sellsOn} ships them nationwide from ${websiteCopy.product.shipsFrom}.`,
    ],
    ...exams,
    faqs.length > 0 ? ["## FAQ", "", ...faqs] : [],
    ["## Pages", "", ...PAGES.map(([name, path]) => `- ${link(name, absolute(path, siteUrl))}`)],
    shops.length > 0
      ? [
          "## Shops",
          "",
          ...shops.map((shop) => `- ${link(`${config.site.name} on ${shop.name}`, shop.href)}`),
        ]
      : [],
  ];
  return `${sections
    .filter((lines) => lines.length > 0)
    .map((lines) => lines.join("\n"))
    .join("\n\n")}\n`;
}
