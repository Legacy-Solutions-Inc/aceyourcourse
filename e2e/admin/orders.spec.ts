import { readFile } from "node:fs/promises";

import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { LIVE, resetSampleData, signInAs } from "./helpers";

// Orders & payments on sample data with the payments fake (Phase 4, ticket 07;
// stories 147, 148 and 151o): an Owner finds an Order by its reference and by
// the Member's email, filters GCash and Paid and exports exactly those Orders
// as a CSV, ticks "Include test orders" to see the TEST row, then opens the
// Pending Order, checks its status with PayMongo and saves an internal note.
// "Invoice requested" (ticket 08) finds Maria's Invoice Request; the Owner
// opens it and marks it sent. Refunds (ticket 09): the Owner sees Lou's
// Order REFUNDED and Bea's "PARTIALLY REFUNDED · ₱300", on the list, the
// detail and in the CSV's amount refunded. An Editor sees no SALES group and
// is refused the screens and the export.
//
// The sample Orders, timed from the reset:
//   AYC-10001 Jose, CE 6 months, GCash, Paid, 45 days ago
//   AYC-10002 Maria, CE 3 months, QR Ph, Paid, 20 days ago; invoice requested
//   AYC-10003 Paolo, CE 1 month, GCash, Paid, 6 days ago
//   AYC-10004 Karen, ME 1 month, Card, Failed, 4 days ago
//   AYC-10005 Tess, CE 1 month, Maya, Paid, a Test Order, 2 days ago
//   AYC-10006 Paolo, ME 1 month, Maya, Pending, 1 hour ago
//   AYC-10007 Bea, CE 3 months, QR Ph, Paid, ₱300 refunded, 50 minutes ago
//   AYC-10008 Lou, CE 1 month, GCash, Refunded, 40 minutes ago

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const list = (page: Page) => page.getByRole("region", { name: "Orders list" });
/** The Orders the list shows, by reference, in order. */
const shown = (page: Page) =>
  list(page)
    .getByRole("table")
    .getByRole("row")
    .getByRole("link", { name: /^AYC-\d+$/ });

/** The references a downloaded CSV holds, in order, its header row, and each row's cells. */
async function csvOf(path: string) {
  const lines = (await readFile(path, "utf8")).replace("﻿", "").split("\r\n").slice(0, -1);
  const rows = lines.slice(1).map((line) => line.split(","));
  return {
    header: lines[0],
    references: rows.map((cells) => cells[0]),
    cells: (reference: string) => rows.find((cells) => cells[0] === reference) ?? [],
  };
}

/** The last 30 days' Orders, without Test Orders, newest first: the list as it opens. */
const DEFAULT_LIST = ["AYC-10008", "AYC-10007", "AYC-10006", "AYC-10004", "AYC-10003", "AYC-10002"];

test.beforeEach(async ({ request }) => {
  test.skip(LIVE, "The sample Orders are in the in-memory sample data only.");
  await resetSampleData(request);
});

test.describe("an Owner", () => {
  test("finds an Order by its reference and by the Member's email", async ({ page }) => {
    await signInAs(page, "owner");
    await expect(page).toHaveURL(/\/admin$/);
    await page
      .getByRole("navigation", { name: "Admin" })
      .getByRole("link", { name: /Orders & payments/ })
      .click();
    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(shown(page)).toHaveText(DEFAULT_LIST);

    const search = page.getByRole("searchbox", { name: "Search by order number or email" });
    await search.fill("AYC-10004");
    await expect(page).toHaveURL(/\/admin\/orders\?q=AYC-10004$/);
    await expect(shown(page)).toHaveText(["AYC-10004"]);

    await search.fill("paolo.reyes");
    await expect(page).toHaveURL(/\/admin\/orders\?q=paolo.reyes$/);
    await expect(shown(page)).toHaveText(["AYC-10006", "AYC-10003"]);

    await search.fill("nobody@example.com");
    await expect(
      list(page).getByText("No Orders match. Clear the search or filters."),
    ).toBeVisible();
  });

  test("filters GCash and Paid, and the CSV holds exactly those Orders", async ({ page }) => {
    await signInAs(page, "owner", paths.admin.orders);
    await expect(shown(page)).toHaveCount(DEFAULT_LIST.length);

    await page.getByRole("combobox", { name: "Payment method" }).selectOption({ label: "GCash" });
    await expect(page).toHaveURL(/method=gcash/);
    // Lou's GCash Order was refunded: it leaves the list once Paid is picked.
    await expect(shown(page)).toHaveText(["AYC-10008", "AYC-10003"]);
    await list(page).getByRole("link", { name: "PAID", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/orders\?status=paid&method=gcash$/);
    await expect(shown(page)).toHaveText(["AYC-10003"]);
    await expect(list(page)).toContainText("PAID · LAST 30 DAYS₱499");

    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/^ayc-orders-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = await csvOf(await download.path());
    expect(csv.header).toMatch(/^Reference,Paid at \(Manila\),Member name,Member email,/);
    expect(csv.references).toEqual(["AYC-10003"]);
    await expect(page.getByText("✓ CSV EXPORTED · MATCHING ORDERS ONLY")).toBeVisible();

    // All time adds the GCash Order from 45 days ago, to the list and the CSV.
    await page.getByRole("combobox", { name: "Date range" }).selectOption({ label: "All time" });
    await expect(shown(page)).toHaveText(["AYC-10003", "AYC-10001"]);
    const again = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    expect((await csvOf(await (await again).path())).references).toEqual([
      "AYC-10003",
      "AYC-10001",
    ]);
  });

  test("ticks Include test orders to see the TEST row", async ({ page }) => {
    await signInAs(page, "owner", paths.admin.orders);
    await expect(shown(page)).toHaveCount(DEFAULT_LIST.length);
    await expect(list(page).getByText("TEST", { exact: true })).toHaveCount(0);

    await page.getByRole("checkbox", { name: "Include test orders" }).check();
    await expect(page).toHaveURL(/\/admin\/orders\?tests=1$/);
    await expect(shown(page)).toHaveText([
      "AYC-10008",
      "AYC-10007",
      "AYC-10006",
      "AYC-10005",
      "AYC-10004",
      "AYC-10003",
      "AYC-10002",
    ]);
    const testRow = list(page)
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: "AYC-10005" }) });
    await expect(testRow.getByText("TEST", { exact: true })).toBeVisible();
  });

  test("sees a refunded Order REFUNDED and a partial refund's amount, on the list, the detail and in the CSV", async ({
    page,
  }) => {
    await signInAs(page, "owner", paths.admin.orders);
    const row = (reference: string) =>
      list(page)
        .getByRole("row")
        .filter({ has: page.getByRole("link", { name: reference, exact: true }) });
    await expect(row("AYC-10008").getByText("REFUNDED", { exact: true })).toBeVisible();
    await expect(row("AYC-10007").getByText("PAID", { exact: true })).toBeVisible();
    await expect(row("AYC-10007").getByText("PARTIALLY REFUNDED · ₱300")).toBeVisible();

    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const csv = await csvOf(await (await downloading).path());
    expect(csv.header).toContain(",Status,Amount refunded (PHP),");
    expect(csv.cells("AYC-10007").slice(9, 11)).toEqual(["Paid", "300.00"]);
    expect(csv.cells("AYC-10008").slice(9, 11)).toEqual(["Refunded", "499.00"]);
    expect(csv.cells("AYC-10003").slice(9, 11)).toEqual(["Paid", ""]);

    await list(page).getByRole("link", { name: "AYC-10008" }).click();
    await expect(page).toHaveURL(/\/admin\/orders\/AYC-10008$/);
    const refunded = page.getByRole("region", { name: "AYC-10008" });
    await expect(refunded.getByText("REFUNDED", { exact: true })).toBeVisible();
    await expect(refunded).toContainText("AMOUNT REFUNDED₱499 · in full");
    await expect(refunded).toContainText(
      "Refunded in full in PayMongo · ₱499 · unused days removed",
    );

    await page.goto(paths.admin.order("AYC-10007"));
    const partial = page.getByRole("region", { name: "AYC-10007" });
    await expect(partial.getByText("PARTIALLY REFUNDED · ₱300")).toBeVisible();
    await expect(partial).toContainText("Partially refunded in PayMongo · ₱300 · access unchanged");
  });

  test("opens the Pending Order, checks its status with PayMongo and saves an internal note", async ({
    page,
  }) => {
    await signInAs(page, "owner", paths.admin.orders);
    await list(page).getByRole("link", { name: "AYC-10006" }).click();
    await expect(page).toHaveURL(/\/admin\/orders\/AYC-10006$/);
    const order = page.getByRole("region", { name: "AYC-10006" });
    await expect(order.getByText("PENDING", { exact: true })).toBeVisible();
    await expect(order).toContainText("Waiting for Maya to confirm");

    await page.getByRole("button", { name: "Check status with PayMongo" }).click();
    await expect(page.getByText("CHECKED JUST NOW · STILL PENDING AT MAYA")).toBeVisible();

    const note = page.getByRole("form", { name: "Internal note" });
    await note
      .getByLabel("INTERNAL NOTE")
      .fill("Member emailed today. Told them to wait for Maya.");
    await note.getByRole("button", { name: "Save note" }).click();
    await expect(note.getByRole("status")).toHaveText("✓ NOTE SAVED · ONLY ADMINS SEE IT");

    await page.reload();
    await expect(page.getByRole("textbox", { name: "INTERNAL NOTE" })).toHaveValue(
      "Member emailed today. Told them to wait for Maya.",
    );
  });
});

test("an Owner filters Invoice requested, opens the Order and marks the invoice sent", async ({
  page,
}) => {
  await signInAs(page, "owner", paths.admin.orders);
  await page.getByRole("checkbox", { name: "Invoice requested" }).check();
  await expect(page).toHaveURL(/\/admin\/orders\?invoice=requested$/);
  await expect(shown(page)).toHaveText(["AYC-10002"]);
  await expect(list(page).getByRole("row", { name: /AYC-10002/ })).toContainText(
    "INVOICE REQUESTED",
  );

  await list(page).getByRole("link", { name: "AYC-10002" }).click();
  await expect(page).toHaveURL(/\/admin\/orders\/AYC-10002$/);
  const request = page.getByRole("region", { name: "INVOICE REQUEST" });
  await expect(request).toContainText("Sample Builders Inc.");
  await expect(request).toContainText("12 Sample St, Jaro, Iloilo City");
  await expect(request).toContainText("123-456-789-000");
  await request.getByRole("button", { name: "Mark invoice sent" }).click();
  await expect(request.getByText(/^✓ SENT .* · /)).toBeVisible();
  await expect(request.getByRole("button", { name: "Mark invoice sent" })).toHaveCount(0);

  await page.goto(`${paths.admin.orders}?invoice=requested`);
  await expect(list(page).getByText("No Orders match. Clear the search or filters.")).toBeVisible();
});

test.describe("an Editor", () => {
  test("sees no SALES group, and is refused the Orders, an Order and the export", async ({
    page,
  }) => {
    await signInAs(page, "editor");
    await expect(page).toHaveURL(/\/admin$/);
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByText("SALES", { exact: true })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: /Orders & payments/ })).toHaveCount(0);

    await page.goto(paths.admin.orders);
    await expect(page).toHaveURL(/\/admin\/denied\?reason=owners-only$/);
    await page.goto(paths.admin.order("AYC-10006"));
    await expect(page).toHaveURL(/\/admin\/denied\?reason=owners-only$/);
    expect((await page.request.get(paths.admin.ordersExport)).status()).toBe(403);
  });
});
