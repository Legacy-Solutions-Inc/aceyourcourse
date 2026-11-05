import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs } from "./helpers";

// Adding Exams and Subjects on sample data (ticket 23; spec, Phase 2 →
// "Adding Exams and Subjects"): an Owner adds CHE with one Subject, which
// the Admin marks NOT ON SITE while /exams/che answers 404. An Editor adds a
// Product under CHE and shows it on the Website: CHE is then last in the
// Exams menu, and its page answers 200. The Owner then deletes a Subject
// nothing uses, after confirming in the page. Editors see none of it.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const editor = (page: Page) => page.getByRole("complementary", { name: "Exam page editor" });
const column = (page: Page, code: string) =>
  page.getByRole("region", { name: `${code} Exam page` });
const productEditor = (page: Page) => page.getByRole("complementary", { name: "Product editor" });
const productField = (page: Page, name: string) =>
  productEditor(page).getByRole("textbox", { name, exact: true });

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

// Leave the shared dev server on the seed for whatever runs next.
test.afterAll(async ({ request }) => {
  await resetSampleData(request);
});

test("an Owner adds CHE, which reaches the Website once an Editor shows one of its Products", async ({
  page,
  browser,
}) => {
  await signInAs(page, "owner", paths.admin.examPages);
  await column(page, "CE").getByRole("link", { name: "+ Add exam" }).click();
  await expect(page).toHaveURL(/\?page=exam&add=exam$/);

  const form = editor(page).getByRole("form", { name: "New exam" });
  await form.getByLabel("EXAM CODE").fill("che");
  await form.getByLabel("BOARD ACRONYM").fill("CHELE");
  await form.getByLabel("EXAM NAME").fill("Chemical Engineering");
  await form.getByLabel("LONG NAME").fill("Chemical Engineer Licensure Exam");
  await form.getByLabel("TEXT").fill("Every ChE formula, in one place.");
  await form.getByLabel("MADE FOR").fill("ChE reviewees");
  await form.getByLabel("01 · CODE").fill("PCHEM");
  await form.getByLabel("01 · NAME").fill("Physical Chemistry");
  await form.getByRole("button", { name: "Add exam" }).click();

  // Saving opens the new Exam's Header.
  await expect(page).toHaveURL(/\/admin\/exam-pages\?exam=che$/);
  await expect(editor(page).getByRole("heading")).toHaveText("EDIT · HEADER · CHE");
  const che = column(page, "CHE");
  await expect(che.getByRole("link", { name: "CHE NOT ON SITE" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(che).toContainText("CHE isn’t on the Website yet.");
  await expect(che.getByRole("link", { name: /^View page/ })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Pages" })).toContainText("× 6");

  expect((await page.request.get(paths.exams.details("CHE"))).status()).toBe(404);

  // An Editor adds a CHE Product, Coming Soon (it needs no photo), shown on the Website.
  const context = await browser.newContext();
  const editorPage = await context.newPage();
  await signInAs(editorPage, "editor", `${paths.admin.products}?product=new`);
  await expect(productEditor(editorPage).getByRole("form")).toBeVisible();
  await productEditor(editorPage)
    .getByRole("combobox", { name: "EXAM" })
    .selectOption({ label: "CHE · CHELE" });
  await productField(editorPage, "FULL NAME").fill("ChE Formula Flash Cards");
  await productField(editorPage, "SHORT NAME · FOR CARDS").fill("ChE Flash Cards");
  await productField(editorPage, "SIZE & PAPER").fill("A6");
  await productEditor(editorPage).getByRole("button", { name: "PCHEM" }).click();
  await productEditor(editorPage).getByRole("switch", { name: "Coming Soon" }).click();
  await productEditor(editorPage).getByRole("button", { name: "Add product" }).click();
  await expect(editorPage).toHaveURL(/\/admin\/products\?product=prd-[0-9a-f]{8}$/);
  await context.close();

  // CHE is last in the Exams menu, and its page answers 200.
  await page.goto(paths.home);
  await page.getByRole("button", { name: "Exams" }).click();
  const tiles = page
    .getByRole("banner")
    .getByRole("link", { name: /Engineering|Technology|Accountancy/ });
  await expect(tiles.last()).toHaveAttribute("href", "/exams/che");
  const response = await page.goto(paths.exams.details("CHE"));
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Chemical Engineering");
  await expect(page.getByText("Physical Chemistry").first()).toBeVisible();

  // Back in the Admin, CHE is on the Website now.
  await page.goto(`${paths.admin.examPages}?exam=che`);
  await expect(column(page, "CHE").getByRole("link", { name: /^View page/ })).toBeVisible();
  await expect(column(page, "CHE").getByRole("link", { name: "CHE", exact: true })).toBeVisible();
});

test("an Owner adds a Subject to CE and removes it after confirming in the page", async ({
  page,
}) => {
  await signInAs(page, "owner", `${paths.admin.examPages}?exam=ce&section=subjects`);
  const add = editor(page).getByRole("form", { name: "Add subject" });
  await add.getByLabel("CODE").fill("thermo");
  await add.getByLabel("NAME").fill("Thermodynamics");
  await add.getByRole("button", { name: "Add subject" }).click();
  await expect(editor(page).getByLabel("04 · THERMO")).toHaveValue("Thermodynamics");

  // MSTC has Products, so its reason replaces the button.
  await expect(editor(page).getByRole("button", { name: "Remove MSTC" })).toHaveCount(0);
  await expect(editor(page)).toContainText(/Products? uses? MSTC\. Remove it from th/);

  page.on("dialog", () => {
    throw new Error("A browser dialog opened");
  });
  await editor(page).getByRole("button", { name: "Remove THERMO" }).click();
  const dialog = page.getByRole("dialog", { name: "Remove THERMO from CE?" });
  await dialog.getByRole("button", { name: "Remove subject" }).click();
  await expect(dialog).toBeHidden();
  await expect(editor(page).getByLabel("04 · THERMO")).toHaveCount(0);
});

test("a duplicate code is refused on its field, keeping the typed values", async ({ page }) => {
  await signInAs(page, "owner", `${paths.admin.examPages}?page=exam&add=exam`);
  const form = editor(page).getByRole("form", { name: "New exam" });
  await form.getByLabel("EXAM CODE").fill("ce");
  await form.getByLabel("BOARD ACRONYM").fill("CELE");
  await form.getByLabel("EXAM NAME").fill("Civil again");
  await form.getByLabel("LONG NAME").fill("Civil again");
  await form.getByLabel("TEXT").fill("Civil again");
  await form.getByLabel("MADE FOR").fill("Civil again");
  await form.getByLabel("01 · CODE").fill("MSTC");
  await form.getByLabel("01 · NAME").fill("Maths");
  await form.getByRole("button", { name: "Add exam" }).click();

  await expect(form.getByText("CE IS ALREADY AN EXAM")).toBeVisible();
  await expect(form.getByLabel("EXAM NAME")).toHaveValue("Civil again");
  await expect(page).toHaveURL(/\?page=exam&add=exam$/);
});

test("an Editor sees no add or delete controls", async ({ page }) => {
  await signInAs(page, "editor", `${paths.admin.examPages}?page=exam&add=exam`);
  await expect(column(page, "CE")).toBeVisible();
  await expect(page.getByRole("link", { name: "+ Add exam" })).toHaveCount(0);
  await expect(page.getByRole("form", { name: "New exam" })).toHaveCount(0);
  await expect(editor(page).getByRole("button", { name: "Delete exam" })).toHaveCount(0);
  await page.goto(`${paths.admin.examPages}?exam=ce&section=subjects`);
  await expect(editor(page).getByLabel("01 · MSTC")).toBeVisible();
  await expect(editor(page).getByRole("form", { name: "Add subject" })).toHaveCount(0);
  await expect(editor(page).getByRole("button", { name: /^Remove/ })).toHaveCount(0);
});
