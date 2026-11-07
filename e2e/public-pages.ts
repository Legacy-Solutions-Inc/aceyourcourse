// Every kind of public Website page, for the site-wide checks: the static
// pages, a Live and a Coming Soon Product, two Exams, and an unmatched URL for
// the 404.

/** The Website's fixed pages, which the sitemap lists first. */
export const STATIC_PAGES = [
  "/",
  "/products",
  "/reviews",
  "/faq",
  "/about",
  "/legal/privacy",
  "/legal/terms",
] as const;

/** An unmatched URL. Its 404 is the root not-found page, outside the Website shell. */
export const NOT_FOUND = "/this-page-does-not-exist";

/** The pages inside the Website shell: the navigation, the footer and the Organization data. */
export const SHELL_PAGES = [
  ...STATIC_PAGES,
  "/products/ce-formula-flash-cards",
  "/products/ce-solving-notebook",
  "/exams/ce",
  "/exams/me",
] as const;

export const PUBLIC_PAGES = [...SHELL_PAGES, NOT_FOUND] as const;
