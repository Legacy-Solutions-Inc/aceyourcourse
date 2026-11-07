import { expect, type Page, test } from "@playwright/test";

// The Privacy Policy and Terms of Use on a real browser, with the Member App
// switch off (the launch default). Expected copy is src/content/legal/.

const EMAIL = "aceyourcourseinc@gmail.com";
const SECTION_IDS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];

const switcher = (page: Page) => page.getByRole("navigation", { name: "Legal documents" });
const contents = (page: Page) => page.getByRole("navigation", { name: "Contents" });
const summary = (page: Page) => page.getByRole("region", { name: "In short" });

for (const { path, title, other, otherPath } of [
  {
    path: "/legal/privacy",
    title: "Privacy Policy",
    other: "Terms of Use",
    otherPath: "/legal/terms",
  },
  {
    path: "/legal/terms",
    title: "Terms of Use",
    other: "Privacy Policy",
    otherPath: "/legal/privacy",
  },
]) {
  test.describe(`the ${title}`, () => {
    test("shows the header, the In short summary, the contents and the numbered sections", async ({
      page,
    }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(`${title} · Ace Your Course`);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        new RegExp(`${path}$`),
      );

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(
        page.getByText("Version 1.0 · Effective 1 Dec 2026 · Draft for legal review"),
      ).toBeVisible();
      await expect(summary(page).getByRole("listitem")).toHaveCount(5);
      await expect(
        summary(page).getByText("This summary isn’t a replacement for the full text below."),
      ).toBeVisible();

      const links = contents(page).getByRole("link");
      await expect(links).toHaveCount(SECTION_IDS.length);
      for (const [index, id] of SECTION_IDS.entries()) {
        await expect(links.nth(index)).toHaveAttribute("href", `#${id}`);
        await expect(links.nth(index)).toHaveText(new RegExp(`^${index + 1}\\. `));
        await expect(page.locator(`#${id}`).getByRole("heading", { level: 2 })).toHaveText(
          new RegExp(`^${index + 1} `),
        );
      }
    });

    test("marks itself current in the switcher and links to the other document", async ({
      page,
    }) => {
      await page.goto(path);
      await expect(switcher(page).getByRole("link", { name: title })).toHaveAttribute(
        "aria-current",
        "page",
      );
      const otherLink = switcher(page).getByRole("link", { name: other });
      await expect(otherLink).not.toHaveAttribute("aria-current");

      await otherLink.click();
      await expect(page).toHaveURL(otherPath);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(other);
      await expect(switcher(page).getByRole("link", { name: other })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });

    // On a 320 px phone the announcement bar wraps, so the sticky header is tallest.
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 320, height: 640 },
    ]) {
      test(`jumps to a section from the contents, clear of the sticky header, at ${viewport.width} px`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.goto(path);
        await contents(page).getByRole("link").nth(6).click();

        await expect(page).toHaveURL(new RegExp(`${path}#s7$`));
        const heading = page.locator("#s7").getByRole("heading", { level: 2 });
        await expect(heading).toBeInViewport();
        // The heading isn't hidden under the sticky site header.
        const headerBottom = await page
          .getByRole("banner")
          .evaluate((header) => header.getBoundingClientRect().bottom);
        const headingTop = await heading.evaluate((element) => element.getBoundingClientRect().top);
        expect(headingTop).toBeGreaterThanOrEqual(headerBottom);
      });
    }

    test("links nowhere in the Member App, and sets no cookies", async ({ page, context }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

      await expect(page.locator('a[href^="/app"]')).toHaveCount(0);
      expect(await context.cookies()).toEqual([]);
    });
  });
}

test("the Privacy Policy describes the Website's anonymous analytics and its contact", async ({
  page,
}) => {
  await page.goto("/legal/privacy");
  const main = page.getByRole("main");

  await expect(main.getByText(/anonymous analytics with PostHog/)).toBeVisible();
  await expect(main.getByText(/The analytics are cookieless/)).toBeVisible();
  await expect(main.getByText(/PostHog discards your IP address/)).toBeVisible();
  await expect(
    main.getByText(/no accounts, no sign-in, no forms, no cart and no payments/),
  ).toBeVisible();
  await expect(main.getByText(/Supabase, Inc\. runs our database in Singapore/)).toBeVisible();

  const contact = main.getByText(/^Our data protection contact is/);
  await expect(contact.getByRole("link", { name: EMAIL })).toHaveAttribute(
    "href",
    `mailto:${EMAIL}`,
  );
});

test("the Terms of Use cover Marketplace purchases, as-of figures and IPOPHIL", async ({
  page,
}) => {
  await page.goto("/legal/terms");
  const main = page.getByRole("main");

  await expect(main.getByText(/under its terms and policies/)).toBeVisible();
  await expect(main.getByText(/units sold\) are shown as of a date/)).toBeVisible();
  await expect(main.getByText(/The Marketplace listing is authoritative/)).toBeVisible();
  await expect(main.getByText(/registered with the Intellectual Property Office/)).toBeVisible();
  await expect(main.getByText(/You may not reproduce/)).toBeVisible();
});

test("/legal redirects to the Privacy Policy", async ({ page, request }) => {
  const response = await request.get("/legal", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toBe("/legal/privacy");

  await page.goto("/legal");
  await expect(page).toHaveURL("/legal/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy Policy");
});

for (const path of ["/legal/cookies", "/legal/PRIVACY"]) {
  test(`${path} is a 404 inside the Website shell`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });
}
