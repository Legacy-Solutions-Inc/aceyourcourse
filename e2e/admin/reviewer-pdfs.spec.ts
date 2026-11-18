import path from "node:path";

import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { LIVE, resetSampleData, signInAs } from "./helpers";

// Reviewer PDFs (Phase 3, ticket 12; stories 114, 115), on the sample data,
// where the job splits a PDF with the fake renderer, a second a page: an
// Editor uploads a real 3-page PDF, leaves the page while it's split, comes
// back to find it a Draft with every page, and deletes it. A
// password-protected PDF fails with its fix, and a file that isn't a PDF is
// refused before it's uploaded.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const reviewerPdf = (name: string) =>
  path.join(import.meta.dirname, "..", "..", "test", "fixtures", "reviewer-pdfs", `${name}.pdf`);
const fixture = (name: string) => path.join(import.meta.dirname, "..", "fixtures", name);
const list = (page: Page) => page.getByRole("list", { name: "Reviewer PDFs" });
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
