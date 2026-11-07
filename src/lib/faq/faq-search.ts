import type { FaqGroupWithItems } from "@/services/catalogue.types";

/**
 * Pure: the FAQ page's search. Keeps the FAQs whose question or answer
 * contains the query, ignoring case and surrounding spaces, and drops every
 * group left empty. A blank query returns the groups unchanged.
 */
export function filterFaqs(
  groups: readonly FaqGroupWithItems[],
  query: string,
): FaqGroupWithItems[] {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return [...groups];
  return groups.flatMap((group) => {
    const items = group.items.filter((faq) =>
      `${faq.question}\n${faq.answer}`.toLowerCase().includes(wanted),
    );
    return items.length > 0 ? [{ ...group, items }] : [];
  });
}
