import { expect as baseExpect, type Page, test } from "@playwright/test";

import { ratingMarkup } from "../test/rating-markup";
import { PUBLIC_PAGES, SHELL_PAGES, STATIC_PAGES } from "./public-pages";

// Checks over every public Website page. The e2e server runs with the Member
// App switch off (MEMBER_APP_LIVE unset), the launch default.

// A link click is a client navigation, and the URL changes only once the new
// page has rendered. A dev server compiling other routes for parallel tests can
// take longer than the default 5 s over it.
const expect = baseExpect.configure({ timeout: 15_000 });

const PHONE = { width: 390, height: 844 };

/**
 * Every same-origin link on the page, as a path and query without the #hash.
 * Every a[href] in the DOM, hidden ones included, so a link in a closed panel
 * is checked too.
 */
function internalLinks(page: Page): Promise<string[]> {
  return page.locator("a[href]").evaluateAll((anchors) =>
    anchors.flatMap((anchor) => {
      const url = new URL(anchor.getAttribute("href") ?? "", location.href);
      return url.origin === location.origin ? [url.pathname + url.search] : [];
    }),
  );
}

const pathOf = (link: string) => new URL(link, "http://localhost").pathname;
const isUnder = (link: string, root: string) =>
  pathOf(link) === root || pathOf(link).startsWith(`${root}/`);

/** The page's JSON-LD objects. */
async function jsonLd(page: Page): Promise<Record<string, unknown>[]> {
  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  return scripts.map((script) => JSON.parse(script) as Record<string, unknown>);
}

for (const path of PUBLIC_PAGES) {
  test.describe(path, () => {
    test("has no Member App link while the switch is off", async ({ page }) => {
      await page.goto(path);
      const links = await internalLinks(page);
      expect(links).toContain("/");
      expect(links.filter((link) => isUnder(link, "/app"))).toEqual([]);
    });

    // 390 px is a typical phone; 320 px the narrowest still in use.
    for (const width of [320, 390]) {
      test.describe(`on a ${width} px phone`, () => {
        test.use({ viewport: { width, height: 844 } });

        test("fits without scrolling sideways", async ({ page }) => {
          await page.goto(path);
          const { scrollWidth, innerWidth } = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }));
          expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
        });
      });
    }
  });
}

for (const path of SHELL_PAGES) {
  test.describe(path, () => {
    test("has AYC's Organization data, with the shop and social links from the footer", async ({
      page,
    }) => {
      await page.goto(path);
      const organizations = (await jsonLd(page)).filter((data) => data["@type"] === "Organization");
      expect(organizations).toHaveLength(1);
      expect(organizations[0]).toMatchObject({ name: "Ace Your Course" });

      const footerLinks = await page
        .getByRole("contentinfo")
        .getByRole("link")
        .evaluateAll((anchors) =>
          anchors.flatMap((anchor) => {
            const href = anchor.getAttribute("href") ?? "";
            return href.startsWith("https://") ? [href] : [];
          }),
        );
      expect(footerLinks.length).toBeGreaterThan(0);
      expect(organizations[0]?.sameAs).toEqual(expect.arrayContaining([...new Set(footerLinks)]));
    });

    test("emits no rating or review structured data", async ({ page }) => {
      await page.goto(path);
      const data = await jsonLd(page);
      expect(data.length).toBeGreaterThan(0);
      expect(data.flatMap((item) => ratingMarkup(item))).toEqual([]);
    });

    test.describe("on a 390 px phone", () => {
      test.use({ viewport: PHONE });

      test("opens the menu, which goes to Products", async ({ page }) => {
        await page.goto(path);
        await page.getByRole("button", { name: "Open menu" }).click();
        const drawer = page.getByRole("dialog", { name: "Menu" });
        await expect(drawer).toBeVisible();

        await drawer.getByRole("link", { name: "Products", exact: true }).click();
        await expect(page).toHaveURL(/\/products$/);
        await expect(drawer).toBeHidden();
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      });
    });
  });
}

test("every internal link on every public page resolves", async ({ page, request }) => {
  test.setTimeout(180_000);
  const links = new Set<string>();
  for (const path of PUBLIC_PAGES) {
    await page.goto(path);
    for (const link of await internalLinks(page)) {
      // The Member App isn't built yet, and /relay is the analytics proxy.
      if (!isUnder(link, "/app") && !isUnder(link, "/relay")) links.add(link);
    }
  }

  const broken: string[] = [];
  for (const link of links) {
    const response = await request.get(link);
    if (response.status() >= 400) broken.push(`${link} → ${response.status()}`);
  }
  expect(links.size).toBeGreaterThan(PUBLIC_PAGES.length);
  expect(broken).toEqual([]);
});

test("the Organization logo is a PNG served by the site", async ({ page, request }) => {
  await page.goto("/");
  const organization = (await jsonLd(page)).find((data) => data["@type"] === "Organization");
  const logo = new URL(String(organization?.logo));
  const response = await request.get(logo.pathname);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
});

test("the sitemap lists the static pages and every Exam and Product the Website links to", async ({
  page,
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const xml = await response.text();
  const listed = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => pathOf(loc ?? ""));

  // The Products page links every Product (Coming Soon in its own row), and its
  // footer every Exam.
  await page.goto("/products");
  const shown = (await internalLinks(page)).filter((link) =>
    /^\/(exams|products)\/[^/?]+$/.test(link),
  );
  expect(shown.filter((link) => link.startsWith("/exams/")).length).toBeGreaterThan(0);
  expect(shown.filter((link) => link.startsWith("/products/")).length).toBeGreaterThan(0);

  expect(listed).toEqual(expect.arrayContaining([...STATIC_PAGES, ...new Set(shown)]));
  expect(listed.filter((path) => /^\/(auth|app|admin|dashboard)(\/|$)/.test(path))).toEqual([]);
  expect(xml).not.toContain("/auth/");
});

test("the summary for AI assistants is plain-text Markdown, naming the catalogue", async ({
  request,
}) => {
  const response = await request.get("/llms.txt");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("text/plain; charset=utf-8");
  const text = await response.text();
  expect(text.startsWith("# Ace Your Course\n\n> ")).toBe(true);
  expect(text).toMatch(
    /^- \[Civil Engineering Formula Flash Cards\]\(https?:\/\/\S+\/products\/ce-formula-flash-cards\): ₱1,200\. Buy on \[Shopee\]/m,
  );
  expect(text).toContain("## FAQ");
  // No Review text or Shopee figures, and no Member App with its switch off.
  expect(text).not.toMatch(/★|\brating|member app/i);
});

test("robots keeps the signed-in areas out and links the sitemap", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  const robots = await response.text();
  for (const area of ["/app", "/admin", "/auth"]) {
    expect(robots).toContain(`Disallow: ${area}$`);
    expect(robots).toContain(`Disallow: ${area}/`);
  }
  expect(robots).toContain("Allow: /");
  expect(robots).toContain("Disallow: /relay/");
  expect(robots).not.toContain("/dashboard");
  expect(robots).toMatch(/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m);
});
