// ─────────────────────────────────────────────────────────────────────────────
// Fixed FAQ page copy (docs/mockup/website/FAQ_v2.dc.html), typed so a missing
// string is a type error. The questions and answers themselves are catalogue
// data, read through the Catalogue seam's listFaqs(). Copy that mentions the
// Member App is kept separate, so it renders only while the switch is on.
// ─────────────────────────────────────────────────────────────────────────────

export const faqPageCopy = {
  metaTitle: "FAQ · shipping, paper, coverage",
  metaDescription:
    "Answers to the questions reviewees always ask: where orders ship from, paper and print, what each exam’s reviewer covers, and how to make sure you’re buying the original.",
  headingLead: "Questions reviewees",
  headingHighlight: "always ask",
  /** Followed by the contact email. */
  intro:
    "Shipping, paper, what’s covered, and how to make sure you’re getting the original. If yours isn’t here, email customer support at",
  searchLabel: "Search the FAQ",
  searchPlaceholder: "Search: shipping, paper, coverage…",
  clear: "Clear",
  popular: "Popular",
  topics: "Topics",
  expandAll: "Expand all",
  collapseAll: "Collapse all",
  fromAReview: "From a review",
  noResultsHint: "Try a shorter word, or ask us directly on Shopee chat.",
  /** Followed by the contact email, when there's no Shopee shop to chat on. */
  noResultsHintEmail: "Try a shorter word, or email us at",
  clearSearch: "Clear search",
  chatOnShopee: "Chat us on Shopee",
  stillHaveAQuestion: "Still have a question?",
  /** Followed by the contact email. */
  supportLead: "Customer support: email us at",
  supportShopee: ", or chat us on Shopee.",
  emailUs: "Email us",
  // Shown only while the Member App switch is on.
  app: {
    searchPlaceholder: "Search: shipping, SPayLater, two devices…",
  },
};
