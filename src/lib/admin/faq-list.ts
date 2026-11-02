import { MAX_QUERY_LENGTH } from "@/lib/catalogue/product-filters";
import { paths } from "@/paths";
import type { AdminFaqList, FaqListQuery } from "@/services/admin.types";
import { FAQ_GROUP_TITLES } from "@/services/catalogue.schema";
import type { Faq } from "@/services/catalogue.types";

// The FAQS tab's URL and labels (BUILD-MAP §3.4, FAQS tab). The group, the
// search and the selected FAQ live in the URL, so a reload keeps them:
// ?tab=faqs&group=shipping&q=shopee&faq=<id> or &faq=new (CONVENTIONS §2).
// The seam checks the group.

type SearchParams = Record<string, string | string[] | undefined>;

/** Pure: the FAQS tab's group, search and selected FAQ in its URL. */
export function parseFaqListParams(params: SearchParams): {
  query: FaqListQuery;
  faq: string | null;
} {
  const value = (key: string) => {
    const raw = params[key];
    return (Array.isArray(raw) ? raw[0] : raw)?.trim() || undefined;
  };
  const query: FaqListQuery = {};
  const group = value("group");
  if (group) query.group = group.slice(0, MAX_QUERY_LENGTH);
  const q = value("q");
  if (q) query.q = q.slice(0, MAX_QUERY_LENGTH);
  return { query, faq: value("faq")?.slice(0, MAX_QUERY_LENGTH) ?? null };
}

/** Pure: the FAQS tab's URL for this group, search and selected FAQ. */
export function faqListHref({ group, q }: AdminFaqList["query"], faq: string | null = null) {
  const params = new URLSearchParams({ tab: "faqs", group });
  if (q) params.set("q", q);
  if (faq) params.set("faq", faq);
  return `${paths.admin.reviews}?${params.toString()}`;
}

/** Pure: a group's title in the Admin, as the FAQ page shows it with the Member App off. */
export const faqGroupTitle = (group: Faq["group"]) => FAQ_GROUP_TITLES[group].title;

/**
 * Pure: the list's label (mockup 1188): "SHIPPING · 3 QUESTIONS · ▲▼ TO
 * REORDER", or while searching "8 MATCHES IN ALL GROUPS".
 */
export function faqListLabel({ group, q }: AdminFaqList["query"], count: number): string {
  if (q) return `${count} ${count === 1 ? "MATCH" : "MATCHES"} IN ALL GROUPS`;
  const questions = `${count} ${count === 1 ? "QUESTION" : "QUESTIONS"}`;
  return `${faqGroupTitle(group).toUpperCase()} · ${questions} · ▲▼ TO REORDER`;
}

/**
 * Pure: a row's meta line (mockup 1183): "WITH REVIEW QUOTE" or "ANSWER
 * ONLY", then "· HIDDEN" and "· MEMBER APP ONLY" when the FAQ page leaves it
 * out, with its group first while searching.
 */
export function faqMeta(faq: Faq, searching: boolean): string {
  return [
    searching ? faqGroupTitle(faq.group).toUpperCase() : null,
    faq.reviewQuote ? "WITH REVIEW QUOTE" : "ANSWER ONLY",
    faq.showOnFaqPage ? null : "HIDDEN",
    faq.requiresMemberApp ? "MEMBER APP ONLY" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Pure: an FAQ's deep link as the editor shows it: "aceyourcourse.ph/faq#faq-posters". */
export const faqAddress = (slug: string) => `aceyourcourse.ph${paths.faq}#faq-${slug}`;
