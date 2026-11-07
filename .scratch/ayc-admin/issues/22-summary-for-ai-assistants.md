# 22 — Summary for AI assistants

**What to build:** The Website serves `/llms.txt`, a plain-text summary of Ace Your Course for AI assistants. It's built from the catalogue, so it changes when the catalogue does. Every "Search & AI visibility" panel lists "Summary for AI assistants: ON" under "Set up automatically".

- **What it says, in Markdown (the llms.txt format):**
  - a `# Ace Your Course` title
  - a one-paragraph summary: who AYC is, what it sells, and where it ships from
  - one section per Exam on the Website, with a link to its Exam page:
    - its Live Products, each with its price or price range in pesos, its Product page link and its Marketplace Listing links
    - then its Coming Soon Products, each marked "Coming soon", with no price
  - the FAQ's visible questions and answers
  - links to the Site pages and the official Marketplace shops
- **What it never includes:** Coming Soon Products' prices, hidden Products, hidden FAQs, Review text, ratings, the Member App while its switch is off, or anything from the Admin.

**Blocked by:** 20 — Site page SEO, which builds the Site pages panel that lists it.

**Status:** ready-for-agent

Spec: Phase 2 story 80c; Implementation Decisions → Phase 2 → "Summary for AI assistants (added 2026-11-05)"; Phase 1 SEO and "Reviews never as structured data". Conventions: §3 (the Catalogue seam and tags).

- [ ] **`GET /llms.txt`:**
  - answers 200 with `text/plain; charset=utf-8`
  - is built from the Catalogue seam's reads (no new data source), with absolute URLs from the site URL
  - is never cached past an Admin save, the same way as the sitemap
- [ ] **The middleware** makes no Supabase call for `/llms.txt`, as for the other public pages. The CSP and robots don't block it.
- [ ] **The "Set up automatically" lists** show "Summary for AI assistants: ON" on both the Exam page and the Site page SEO panels.
- [ ] **Sad paths, each with a test:**
  - An Exam with no Product on the Website is left out.
  - A Coming Soon Product shows "Coming soon" and no price.
  - A Product without a Listing on a Marketplace shows only the Listings it has.
  - A hidden FAQ, or a Product that's off the Website, is absent.
  - Markdown characters in catalogue text are escaped, so a name with `*` or `[` doesn't change the structure.
  - A catalogue read failure answers 503 with a short plain-text message, never a stack trace.
  - Reviews and ratings never appear, a rule kept from Phase 1.
