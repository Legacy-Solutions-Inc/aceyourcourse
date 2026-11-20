import path from "node:path";

import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { expectNoBlockingViolations, signInAndOnboard } from "../member-app/helpers";
import { LIVE, resetSampleData, signInAs } from "./helpers";

// Reviewer PDFs (Phase 3, ticket 12; stories 114, 115), on the sample data,
// where the job splits a PDF with the fake renderer, a second a page: an
// Editor uploads a real 3-page PDF, leaves the page while it's split, comes
// back to find it a Draft with every page, and deletes it. A
// password-protected PDF fails with its fix, and a file that isn't a PDF is
// refused before it's uploaded.
// Ticket 13 (stories 116, 128, 133o): the Editor places a Draft under a
// Topic made with "+ New topic", previews it page by page, and publishes it;
// the Beta Tester, whose CE pass is active, finds it in the Library; the
// Editor unpublishes it, and it's gone; publishing it again brings it back.
// Publishing is disabled until it's placed, and a Topic that has a Reviewer
// PDF links to it.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const reviewerPdf = (name: string) =>
  path.join(import.meta.dirname, "..", "..", "test", "fixtures", "reviewer-pdfs", `${name}.pdf`);
const fixture = (name: string) => path.join(import.meta.dirname, "..", "fixtures", name);
const list = (page: Page) => page.getByRole("list", { name: "Reviewer PDFs" });

/** The Beta Tester, with a CE pass, signed in to the Member App in their own browser, on CE MSTC's Library. */
async function memberLibrary(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signInAndOnboard(page, "tester", "CE");
  await page.goto(paths.memberApp.librarySubject("MSTC"));
  await expect(page.getByRole("heading", { level: 1, name: "Subjects and topics" })).toBeVisible();
  return page;
}

/** The Transition Curves Topic in the Member App's Library. */
const transitionCurves = (page: Page) =>
  page
    .getByRole("list", { name: "MSTC Topics" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { level: 3, name: /Transition Curves$/ }) });
const row = (page: Page, name: string) =>
  list(page).getByRole("listitem").filter({ hasText: name });

test.describe("an Editor", () => {
  // The fake renderer runs on the sample data only; live, pdf.js renders, as
  // src/services/page-images.pdfjs.test.ts checks on the same fixtures.
  test.skip(LIVE, "The fake renderer splits PDFs on the sample data only.");

  test.beforeEach(async ({ request }) => {
    await resetSampleData(request);
  });

  test("uploads a PDF, leaves while it's split, finds it a Draft with every page, and deletes it", async ({
    page,
  }) => {
    await signInAs(page, "editor", paths.admin.reviewerPdfs);
    await expect(page.getByRole("heading", { name: "Drop a Reviewer PDF here" })).toBeVisible();

    await page.getByLabel("Choose a PDF").setInputFiles(reviewerPdf("three-pages"));

    await expect(page.getByRole("status").filter({ hasText: "UPLOADED" })).toHaveText(
      "✓ UPLOADED three-pages.pdf · YOU CAN LEAVE THIS PAGE. IT KEEPS GOING AND SHOWS UP AS A DRAFT WHEN DONE.",
    );
    await expect(row(page, "three-pages.pdf")).toContainText("PROCESSING");
    await expect(row(page, "three-pages.pdf")).toContainText("Not placed under a Topic yet");

    // The Editor leaves the page, and comes back.
    await page.goto(paths.admin.overview);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto(paths.admin.reviewerPdfs);
    // Done by now, or the list reads itself again until it is.
    await expect(row(page, "three-pages.pdf")).toContainText("Draft · 3 pages", {
      timeout: 30_000,
    });
    await expect(row(page, "three-pages.pdf")).toContainText("DRAFT");

    await row(page, "three-pages.pdf")
      .getByRole("button", { name: "Delete three-pages.pdf" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Delete “three-pages.pdf”?" });
    await expect(dialog).toContainText("The original PDF and every page image are deleted");
    await dialog.getByRole("textbox").fill("DELETE");
    await dialog.getByRole("button", { name: "Delete Reviewer PDF" }).click();
    await expect(dialog).toBeHidden();
    await expect(row(page, "three-pages.pdf")).toHaveCount(0);
  });

  test("places a Draft under a new Topic, previews it, publishes it to the Library, and unpublishes it", async ({
    page,
    browser,
  }) => {
    // A Draft to split, a Topic to make, a Member to sign in: well past 30 seconds on a cold server.
    test.slow();
    await signInAs(page, "editor", paths.admin.reviewerPdfs);
    await page.getByLabel("Choose a PDF").setInputFiles(reviewerPdf("three-pages"));
    await expect(row(page, "three-pages.pdf")).toContainText("Draft · 3 pages", {
      timeout: 30_000,
    });
    await row(page, "three-pages.pdf").getByRole("link", { name: "three-pages.pdf" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "three-pages.pdf" })).toBeVisible();

    // Publishing waits for a Topic.
    const inTheApp = page.getByRole("region", { name: "IN THE MEMBER APP" });
    await expect(inTheApp.getByRole("button", { name: "Publish" })).toBeDisabled();
    await expect(inTheApp).toContainText("CHOOSE A TOPIC BEFORE PUBLISHING");

    // The preview, page by page, as Members see it.
    const preview = page.getByRole("region", { name: "PREVIEW" });
    await expect(preview.getByRole("img", { name: "Page 1 of 3" })).toBeVisible();
    await expect
      .poll(() => preview.getByRole("img").evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    await preview.getByRole("button", { name: "Next page" }).click();
    await preview.getByRole("button", { name: "Next page" }).click();
    await expect(preview.getByRole("img", { name: "Page 3 of 3" })).toBeVisible();
    await expect(preview.getByRole("status")).toHaveText("PREVIEW · 3 / 3 · AS MEMBERS SEE IT");

    // A Topic that has a Reviewer PDF already says so, and links to it.
    const placement = page.getByRole("region", { name: "PLACEMENT" });
    await placement.getByLabel("EXAM").selectOption("CE");
    await placement.getByLabel("SUBJECT").selectOption("MSTC");
    await placement
      .getByLabel("TOPIC")
      .selectOption({ label: "Simple Curves · has a Reviewer PDF" });
    await expect(placement.getByRole("link", { name: "Open that Reviewer PDF" })).toBeVisible();

    // "+ New topic", without leaving.
    await placement.getByRole("button", { name: "+ New topic" }).click();
    const newTopic = placement.getByRole("form", { name: "New topic" });
    await newTopic.getByLabel("NEW TOPIC IN CE › MSTC").fill("Transition Curves");
    await newTopic.getByRole("button", { name: "Add topic" }).click();
    await expect(newTopic).toBeHidden();
    await expect(placement.getByLabel("TOPIC").locator("option:checked")).toHaveText(
      "Transition Curves",
    );
    await placement.getByRole("button", { name: "Save placement" }).click();
    await expect(placement.getByRole("status")).toHaveText("✓ SAVED");
    await expect(placement).toContainText(
      "Shows in the member Library under CE › MSTC › Transition Curves once it’s published.",
    );
    await expectNoBlockingViolations(page);

    await inTheApp.getByRole("button", { name: "Publish" }).click();
    await expect(inTheApp).toContainText("LIVE IN THE LIBRARY");
    await expect(inTheApp.getByRole("button", { name: "Unpublish" })).toBeEnabled();

    // The Beta Tester, with a CE pass, finds it in the Library.
    const member = await memberLibrary(browser);
    try {
      await expect(transitionCurves(member).getByRole("link")).toHaveText(["Reviewer PDF"]);

      await inTheApp.getByRole("button", { name: "Unpublish" }).click();
      await expect(inTheApp).toContainText("NOT VISIBLE TO MEMBERS");

      await member.reload();
      await expect(transitionCurves(member)).toBeVisible();
      await expect(transitionCurves(member).getByRole("link")).toHaveCount(0);

      // Publishing again brings it back.
      await inTheApp.getByRole("button", { name: "Publish" }).click();
      await expect(inTheApp).toContainText("LIVE IN THE LIBRARY");
      await member.reload();
      await expect(transitionCurves(member).getByRole("link")).toHaveText(["Reviewer PDF"]);
    } finally {
      await member.context().close();
    }
  });

  test("sees a password-protected PDF fail with its fix", async ({ page }) => {
    await signInAs(page, "editor", paths.admin.reviewerPdfs);
    await page.getByLabel("Choose a PDF").setInputFiles(reviewerPdf("password"));

    await expect(row(page, "password.pdf")).toContainText("Couldn’t split this PDF", {
      timeout: 30_000,
    });
    await expect(row(page, "password.pdf")).toContainText(
      "The PDF is password-protected. Remove the password and upload again.",
    );
    await expect(row(page, "password.pdf")).toContainText("FAILED");
  });

  test("has a file that isn't a PDF refused before it's uploaded", async ({ page }) => {
    await signInAs(page, "editor", paths.admin.reviewerPdfs);
    // The sample data's three, from before uploads.
    await expect(list(page).getByRole("listitem")).toHaveCount(3);

    await page.getByLabel("Choose a PDF").setInputFiles(fixture("product-photo.png"));

    await expect(page.getByRole("alert").filter({ hasText: "USE A PDF FILE" })).toBeVisible();
    await expect(list(page).getByRole("listitem")).toHaveCount(3);
  });
});
