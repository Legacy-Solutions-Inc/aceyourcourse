import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import type { AdminActionState } from "@/lib/admin/action";
import type {
  AdminProduct,
  AdminProductRow,
  DeletedProduct,
  ProductDeletePreview,
} from "@/services/admin.types";
import type { Product } from "@/services/catalogue.types";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";

import { EditProduct, NewProduct, type ProductEditorActions } from "./product-editor";

// The Product editor, saving through stub Server Actions that answer as
// adminAction would. The router is the framework boundary, so it's replaced.
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  unstable_rethrow: () => {},
}));

const OPENED_AT = "2026-10-22T03:42:00.000Z";
const SAVED_AT = "2026-10-22T04:00:00.000Z";
const EXAMS = CATALOGUE_SEED.exams;
const seedProduct = (id: string): Product => {
  const found = CATALOGUE_SEED.products.find((p) => p.id === id);
  if (!found) throw new Error(`No Product ${id}`);
  return structuredClone(found);
};
const opened = (id: string, reviewCount = 3): AdminProduct => ({
  product: seedProduct(id),
  stamp: { savedAt: OPENED_AT, savedBy: null },
  reviewCount,
});
const PREVIEW: ProductDeletePreview = { reviews: 3, photos: 2, faqQuotes: 1 };

type Submission = { input: unknown; expected?: { savedAt: string } };

/** A stub Server Action that answers each call in turn. */
function answering<T>(...answers: AdminActionState<T>[]) {
  return vi.fn(async (_previous: AdminActionState<T>, _submission: Submission) => {
    const next = answers.shift();
    if (!next) throw new Error("no more answers");
    return next;
  });
}

function actionsWith(actions: Partial<ProductEditorActions> = {}): ProductEditorActions {
  return {
    save: answering<AdminProduct>(),
    add: answering<AdminProduct>(),
    remove: answering<DeletedProduct>(),
    countDelete: vi.fn(async () => ({ status: "saved" as const, value: PREVIEW })),
    setFlag: answering<AdminProductRow>(),
    ...actions,
  };
}

function renderEdit(id = "prd-005", actions: Partial<ProductEditorActions> = {}) {
  const user = userEvent.setup();
  render(
    <>
      <EditProduct
        opened={opened(id)}
        exams={EXAMS}
        deletePreview={PREVIEW}
        listQuery={{ q: null, exam: "ce", missing: false }}
        actions={actionsWith(actions)}
      />
      <Toaster />
    </>,
  );
  return user;
}

const field = (name: string) => screen.getByRole("textbox", { name });
const status = () => screen.getByRole("status");
/** What the browser sent the Server Action, on its first call. */
const sent = (action: { mock: { calls: [unknown, Submission][] } }) => action.mock.calls[0]?.[1];

describe("EditProduct", () => {
  beforeEach(() => {
    router.refresh.mockClear();
    router.replace.mockClear();
  });

  it("opens with the Product's fields, the Exam as “CE · CELE”, and its address and photos", () => {
    renderEdit();

    expect(screen.getByText("EDIT · ULTIMATE CE POSTERS 2.0")).toBeInTheDocument();
    expect(field("FULL NAME")).toHaveValue("Ultimate Civil Engineering Posters");
    expect(field("PRICE FROM")).toHaveValue("400");
    expect(field("PRICE UP TO · OPTIONAL")).toHaveValue("1,250");
    expect(screen.getByRole("combobox", { name: "EXAM" })).toHaveDisplayValue("CE · CELE");
    expect(screen.getByRole("combobox", { name: "FORMAT" })).toHaveDisplayValue("Posters");
    expect(screen.getByRole("button", { name: "PSAD", pressed: true })).toBeInTheDocument();
    expect(
      screen.getByText("PAGE ADDRESS · aceyourcourse.ph/products/ultimate-ce-posters-2-0"),
    ).toBeInTheDocument();
    expect(screen.getByText("2 photos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View page ↗/ })).toHaveAttribute(
      "href",
      "/products/ultimate-ce-posters-2-0",
    );
    expect(status()).toHaveTextContent("UP TO DATE");
  });

  it("has no “View page” link for a Product hidden from the website, whose page answers 404", () => {
    const hidden = opened("prd-005");
    hidden.product.showOnWebsite = false;
    render(
      <EditProduct
        opened={hidden}
        exams={EXAMS}
        deletePreview={PREVIEW}
        listQuery={{ q: null, exam: null, missing: false }}
        actions={actionsWith()}
      />,
    );

    expect(screen.queryByRole("link", { name: /View page/ })).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Show on website" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("describes each VISIBILITY switch with its hint", () => {
    renderEdit("prd-005");

    expect(screen.getByRole("switch", { name: "Coming Soon" })).toHaveAccessibleDescription(
      "Announced, not out yet: no price, store buttons or Shopee figures",
    );
  });

  it("shows the variations without the Marketplace's prefix, and saves it back with it", async () => {
    const save = answering<AdminProduct>({ status: "saved", value: opened("prd-005") });
    const user = renderEdit("prd-005", { save });

    expect(field("Variation 2 name")).toHaveValue("MSTC ONLY");
    await user.clear(field("Variation 2 name"));
    await user.type(field("Variation 2 name"), "MSTC");
    await user.click(screen.getByRole("button", { name: "Remove variation HPGE ONLY" }));
    await user.click(screen.getByRole("button", { name: "+ Add variation" }));
    await user.type(field("Variation 4 name"), "BONUS");
    await user.type(field("Variation 4 price"), "99");
    await user.click(screen.getByRole("button", { name: "Save product" }));

    expect(sent(save)).toMatchObject({
      input: {
        id: "prd-005",
        variations: [
          { name: "CE POSTERS 2.0: MSTC, HPGE, PSAD", price: "1,250" },
          { name: "CE POSTERS 2.0: MSTC", price: "400" },
          { name: "CE POSTERS 2.0: PSAD ONLY", price: "700" },
          { name: "BONUS", price: "99" },
        ],
      },
      expected: { savedAt: OPENED_AT },
    });
  });

  it("saves with the stamp it opened with, says it's live, and refreshes the list", async () => {
    const after = opened("prd-001", 5);
    after.product.priceFrom = 125000;
    after.stamp = { savedAt: SAVED_AT, savedBy: "AYC Content Team" };
    const save = answering<AdminProduct>(
      { status: "saved", value: after },
      { status: "saved", value: after },
    );
    const user = renderEdit("prd-001", { save });

    await user.clear(field("PRICE FROM"));
    await user.type(field("PRICE FROM"), "₱1,250");
    expect(status()).toHaveTextContent("UNSAVED CHANGES");
    await user.click(screen.getByRole("button", { name: "Save product" }));

    expect(sent(save)).toMatchObject({
      input: { id: "prd-001", priceFrom: "₱1,250" },
      expected: { savedAt: OPENED_AT },
    });
    await waitFor(() => expect(status()).toHaveTextContent("✓ SAVED · LIVE ON THE SITE"));
    expect(field("PRICE FROM")).toHaveValue("1,250");
    expect(router.refresh).toHaveBeenCalled();

    // The next save checks against the stamp the first one left.
    await user.click(screen.getByRole("button", { name: "Save product" }));
    expect(save.mock.calls[1]?.[1]).toMatchObject({ expected: { savedAt: SAVED_AT } });
  });

  it("shows each field's message and the form's, keeping the edits", async () => {
    const save = answering<AdminProduct>({
      status: "refused",
      error: {
        kind: "invalid",
        fieldErrors: {
          title: ["ADD A NAME"],
          "variations.0.price": ["ENTER A PRICE IN PESOS, LIKE 1,250"],
        },
        formError: "ADD A NAME AND PRICE TO SAVE",
      },
    });
    const user = renderEdit("prd-005", { save });

    await user.clear(field("FULL NAME"));
    await user.click(screen.getByRole("button", { name: "Save product" }));

    await waitFor(() => expect(status()).toHaveTextContent("ADD A NAME AND PRICE TO SAVE"));
    expect(field("FULL NAME")).toHaveAccessibleDescription("ADD A NAME");
    expect(field("FULL NAME")).toHaveValue("");
    expect(field("Variation 1 price")).toHaveAccessibleDescription(
      "ENTER A PRICE IN PESOS, LIKE 1,250",
    );
    // Editing a variation clears that list's old messages.
    await user.type(field("Variation 1 price"), "0");
    expect(field("Variation 1 price")).not.toHaveAccessibleDescription();
  });

  it("shows the conflict notice for a stale save, keeping the form", async () => {
    const save = answering<AdminProduct>({
      status: "refused",
      error: { kind: "conflict", savedBy: "Angel Rose L. Lepaña", savedAt: SAVED_AT },
    });
    const user = renderEdit("prd-005", { save });

    await user.type(field("EDITION"), "b");
    await user.click(screen.getByRole("button", { name: "Save product" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Angel Rose L\. Lepaña saved this Product at .*\. Copy your changes, then reload to see theirs\./,
    );
    expect(field("EDITION")).toHaveValue("2.0b");
  });

  it("shows the “Couldn't save” toast when the save breaks down", async () => {
    const save = answering<AdminProduct>({ status: "failed" });
    const user = renderEdit("prd-005", { save });

    await user.click(screen.getByRole("button", { name: "Save product" }));

    expect(await screen.findByText("COULDN’T SAVE")).toBeInTheDocument();
    expect(screen.getByText(/“Ultimate CE Posters 2\.0” wasn’t saved/)).toBeInTheDocument();
  });

  it("drops the Subjects that aren't on the new Exam when the Exam changes", async () => {
    const save = answering<AdminProduct>({ status: "saved", value: opened("prd-005") });
    const user = renderEdit("prd-005", { save });

    await user.selectOptions(screen.getByRole("combobox", { name: "EXAM" }), "ME · MELE");

    const subjects = within(screen.getByRole("group", { name: "SUBJECTS COVERED" }));
    expect(subjects.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "PIP",
      "MATH",
      "MD",
    ]);
    expect(subjects.queryAllByRole("button", { pressed: true })).toEqual([]);
    await user.click(subjects.getByRole("button", { name: "MD" }));
    await user.click(screen.getByRole("button", { name: "Save product" }));
    expect(sent(save)).toMatchObject({ input: { examCode: "ME", subjectCodes: ["MD"] } });
  });

  it("hides the price, variations, Shopee figures and Listings while Coming Soon is on", async () => {
    const user = renderEdit("prd-005");
    expect(screen.getByRole("region", { name: "PRICE & VARIATIONS" })).toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "Coming Soon" }));

    expect(screen.queryByRole("region", { name: "PRICE & VARIATIONS" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "UNITS SOLD" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "STORE LINKS" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "PRODUCT PAGE TEXT" })).toBeInTheDocument();
  });

  it("notes the Shopee figures' source and their “as of” date", () => {
    renderEdit("prd-005");

    expect(
      screen.getByText(
        "Copy these from the Shopee listing. Best sellers on Home are ranked by units sold.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("AS OF 29 OCT 2026")).toBeInTheDocument();
  });

  it("labels an empty Listing as using the shop page, and a filled one as a product link", () => {
    renderEdit("prd-005");

    expect(field("SHOPEE · PRODUCT LINK")).toHaveValue(seedProduct("prd-005").listings.shopee);
    expect(field("LAZADA · USING SHOP PAGE")).toHaveValue("");
    expect(field("TIKTOK SHOP · USING SHOP PAGE")).toHaveAttribute(
      "placeholder",
      "Paste TikTok Shop product link (optional)",
    );
  });

  it("shows the generated text as the blank fields' placeholders, with live SEO counters", async () => {
    const user = renderEdit("prd-005");

    const title = field("PAGE TITLE");
    expect(title).toHaveValue("");
    expect(title).toHaveAttribute(
      "placeholder",
      "Ultimate CE Posters 2.0 · CELE Reviewer · Ace Your Course",
    );
    expect(title).toHaveAccessibleDescription("57 / 60 characters");
    const description = field("META DESCRIPTION");
    expect(description.getAttribute("placeholder")).toMatch(
      /^Ultimate Civil Engineering Posters for the CELE, covering MSTC, HPGE, PSAD\./,
    );
    expect(description).toHaveAccessibleDescription(
      `${description.getAttribute("placeholder")?.length} / 160 characters`,
    );
    expect(field("WHAT’S INSIDE")).toHaveAttribute(
      "placeholder",
      "Posters for the CELE, covering MSTC, HPGE, PSAD. For the board exam, school, and professional review.",
    );

    await user.type(title, "x".repeat(61));
    expect(title).toHaveAccessibleDescription("61 / 60 characters");
  });

  it("switches “Show on website” at once, outside the form's save", async () => {
    const setFlag = answering<AdminProductRow>({
      status: "saved",
      value: {
        id: "prd-005",
        slug: "ultimate-ce-posters-2-0",
        title: "Ultimate Civil Engineering Posters",
        shortName: "Ultimate CE Posters 2.0",
        examCode: "CE",
        format: "posters",
        state: "live",
        priceFrom: 40000,
        priceTo: 125000,
        unitsSold: 172,
        cover: null,
        storeLinks: { shopee: "product", lazada: "shop", tiktok: "shop" },
        showOnWebsite: false,
        availableInApp: false,
        stamp: { savedAt: OPENED_AT, savedBy: null },
      },
    });
    const save = answering<AdminProduct>();
    const user = renderEdit("prd-005", { setFlag, save });

    await user.click(screen.getByRole("switch", { name: "Show on website" }));

    await waitFor(() =>
      expect(sent(setFlag)).toEqual({ input: { id: "prd-005", showOnWebsite: false } }),
    );
    expect(save).not.toHaveBeenCalled();
    expect(status()).toHaveTextContent("UP TO DATE");
  });
});

describe("EditProduct: Delete", () => {
  beforeEach(() => {
    router.refresh.mockClear();
    router.replace.mockClear();
  });

  const dialog = () => screen.getByRole("dialog", { name: "Delete “Ultimate CE Posters 2.0”?" });
  const confirmButton = () => within(dialog()).getByRole("button", { name: "Delete product" });
  const typed = () => within(dialog()).getByRole("textbox", { name: "TYPE DELETE TO CONFIRM" });

  it("asks for DELETE typed exactly, with exact counts of what goes", async () => {
    const user = renderEdit("prd-005");

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(dialog()).toHaveAccessibleDescription(
      "It disappears from the website, the Products page, and the CE exam page. 3 Reviews and 2 photos are deleted with it. 1 FAQ quote from its Reviews is removed. Store listings on Shopee, Lazada, and TikTok Shop are not affected. This can’t be undone.",
    );
    expect(confirmButton()).toBeDisabled();
    await user.type(typed(), "delete");
    expect(confirmButton()).toBeDisabled();
    await user.clear(typed());
    await user.type(typed(), "DELETE");
    expect(confirmButton()).toBeEnabled();
  });

  it("deletes once confirmed, and goes back to the list with its filters, without saving the form", async () => {
    const remove = answering<DeletedProduct>({
      status: "saved",
      value: { id: "prd-005", slug: "ultimate-ce-posters-2-0", ...PREVIEW },
    });
    const save = answering<AdminProduct>();
    const user = renderEdit("prd-005", { remove, save });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.type(typed(), "DELETE{Enter}");

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/admin/products?exam=ce", { scroll: false }),
    );
    expect(sent(remove)).toEqual({ input: { id: "prd-005" } });
    expect(save).not.toHaveBeenCalled();
    expect(await screen.findByText("✓ DELETED · ULTIMATE CE POSTERS 2.0")).toBeInTheDocument();
  });

  it("says so when the Product was already deleted elsewhere", async () => {
    const remove = answering<DeletedProduct>({ status: "refused", error: { kind: "not-found" } });
    const user = renderEdit("prd-005", { remove });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.type(typed(), "DELETE");
    await user.click(confirmButton());

    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(
      "IT’S ALREADY BEEN DELETED · RELOAD THE PAGE",
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("reads the counts again as it opens, counting a Review added since the page loaded", async () => {
    const countDelete = answering<ProductDeletePreview>({
      status: "saved",
      value: { reviews: 4, photos: 2, faqQuotes: 1 },
    });
    const user = renderEdit("prd-005", { countDelete });

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(sent(countDelete)).toEqual({ input: { id: "prd-005" } });
    await waitFor(() =>
      expect(dialog()).toHaveAccessibleDescription(/4 Reviews and 2 photos are deleted with it\./),
    );
  });

  it("says so as it opens when the Product was already deleted elsewhere", async () => {
    const countDelete = answering<ProductDeletePreview>({
      status: "refused",
      error: { kind: "not-found" },
    });
    const user = renderEdit("prd-005", { countDelete });

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(
      "IT’S ALREADY BEEN DELETED · RELOAD THE PAGE",
    );
    // The editor stays, with its edits, behind the dialog.
    expect(screen.getByRole("textbox", { name: "FULL NAME", hidden: true })).toHaveValue(
      "Ultimate Civil Engineering Posters",
    );
  });

  it("clears what was typed when it's cancelled", async () => {
    const user = renderEdit("prd-005");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.type(typed(), "DELETE");
    await user.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(typed()).toHaveValue("");
    expect(confirmButton()).toBeDisabled();
  });
});

describe("NewProduct", () => {
  it("opens blank for the first Exam, saying a photo is needed to go Live", () => {
    render(<NewProduct exams={EXAMS} actions={actionsWith()} onAdded={() => {}} />);

    expect(screen.getByText("NEW PRODUCT")).toBeInTheDocument();
    expect(screen.getByText("Add at least one photo to make it Live")).toBeInTheDocument();
    expect(
      screen.getByText("PAGE ADDRESS · SET FROM THE FULL NAME WHEN YOU ADD IT"),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "EXAM" })).toHaveDisplayValue("CE · CELE");
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View page/ })).not.toBeInTheDocument();
  });

  it("adds a Coming Soon Product with its flags, then hands it on", async () => {
    const added = opened("prd-009", 0);
    const add = answering<AdminProduct>({ status: "saved", value: added });
    const onAdded = vi.fn();
    const user = userEvent.setup();
    render(<NewProduct exams={EXAMS} actions={actionsWith({ add })} onAdded={onAdded} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "EXAM" }), "MT · MTLE");
    await user.type(field("FULL NAME"), "MT Notebook");
    await user.type(field("SHORT NAME · FOR CARDS"), "MT Notebook");
    await user.type(field("SIZE & PAPER"), "A5");
    await user.click(screen.getByRole("button", { name: "HEMA" }));
    await user.click(screen.getByRole("switch", { name: "Coming Soon" }));
    await user.click(screen.getByRole("switch", { name: "Available in app" }));
    await user.click(screen.getByRole("button", { name: "Add product" }));

    expect(sent(add)).toMatchObject({
      input: {
        title: "MT Notebook",
        examCode: "MT",
        subjectCodes: ["HEMA"],
        comingSoon: true,
        showOnWebsite: true,
        availableInApp: true,
      },
    });
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(added));
  });
});
