import { expect as baseExpect, test } from "@playwright/test";

// The main buying journey: Home → an Exam page → a Product page → the
// Product's own Shopee Listing, opened in a new tab. The Marketplaces aren't
// visited; the buttons' targets are checked instead.

// A link click is a client navigation, and the URL changes only once the new
// page has rendered. A dev server compiling other routes for parallel tests can
// take longer than the default 5 s over it.
const expect = baseExpect.configure({ timeout: 15_000 });

const LAZADA_SHOP = "https://www.lazada.com.ph/shop/aceyourcourse";

test("goes from Home to the CE page, a CE Product and its Shopee Listing in a new tab", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tabpanel").getByRole("link", { name: "All CE reviewers" }).click();
  await expect(page).toHaveURL(/\/exams\/ce$/);

  await page
    .getByRole("list", { name: "Every CE reviewer" })
    .getByRole("link", { name: "CE Formula Flash Cards" })
    .click();
  await expect(page).toHaveURL(/\/products\/ce-formula-flash-cards$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Civil Engineering Formula Flash Cards",
  );

  const shopee = page.getByRole("link", { name: "Buy on Shopee (opens in a new tab)" });
  await expect(shopee).toHaveAttribute("href", /^https:\/\/shopee\.ph\/.*24292303887$/);
  await expect(shopee).toHaveAttribute("target", "_blank");
  await expect(shopee).toHaveAttribute("rel", "noopener noreferrer");
});

test("sends the Lazada button to the shop page when the Product has no Lazada Listing", async ({
  page,
}) => {
  await page.goto("/products/ce-formula-flash-cards");
  const lazada = page.getByRole("link", { name: "Buy on Lazada (opens in a new tab)" });
  await expect(lazada).toHaveAttribute("href", LAZADA_SHOP);
  await expect(lazada).toHaveAttribute("target", "_blank");
});
