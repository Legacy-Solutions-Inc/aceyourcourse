import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import type { AdminActionState } from "@/lib/admin/action";
import type {
  AdminReview,
  DeletedReview,
  ReviewDeletePreview,
  ReviewProductOption,
} from "@/services/admin.types";
import type { Review } from "@/services/catalogue.types";

import { EditReview, NewReview, type ReviewEditorActions } from "./review-editor";

// The Review editor, saving through stub Server Actions that answer as
// adminAction would. The router is the framework boundary, so it's replaced.
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  unstable_rethrow: () => {},
}));

const OPENED_AT = "2026-10-22T03:42:00.000Z";
const SAVED_AT = "2026-10-22T04:00:00.000Z";

const PRODUCTS: ReviewProductOption[] = [
  {
    id: "prd-001",
    slug: "ce-formula-flash-cards",
    examCode: "CE",
    shortName: "CE Formula Flash Cards",
    variations: ["BUNDLE SECOND ED."],
  },
  {
    id: "prd-005",
    slug: "ultimate-ce-posters-2-0",
    examCode: "CE",
    shortName: "Ultimate CE Posters 2.0",
    variations: ["MSTC, HPGE, PSAD", "MSTC ONLY"],
  },
];

const QUOTED: Review = {
  id: "rev-014",
  productId: "prd-005",
  stars: 5,
  text: "Glossy type yung paper, makapal sya.\nQuality 10/10.",
  variation: "MSTC, HPGE, PSAD",
  helpful: 0,
  marketplace: "shopee",
  homePin: 6,
};
const opened = (review: Partial<Review> = {}): AdminReview => ({
  review: { ...QUOTED, ...review },
  stamp: { savedAt: OPENED_AT, savedBy: null },
});
const saved = (review: Partial<Review> = {}): AdminReview => ({
  review: { ...QUOTED, ...review },
  stamp: { savedAt: SAVED_AT, savedBy: "AYC Content Team" },
});

type Submission = { input: unknown; expected?: { savedAt: string } };

/** A stub Server Action that answers each call in turn. */
function answering<T>(...answers: AdminActionState<T>[]) {
  return vi.fn(async (_previous: AdminActionState<T>, _submission: Submission) => {
    const next = answers.shift();
    if (!next) throw new Error("no more answers");
    return next;
  });
}

function actionsWith(actions: Partial<ReviewEditorActions> = {}): ReviewEditorActions {
  return {
    save: answering<AdminReview>(),
    add: answering<AdminReview>(),
    remove: answering<DeletedReview>(),
    countDelete: vi.fn(async () => ({
      status: "saved" as const,
      value: { faqQuotes: 1 } satisfies ReviewDeletePreview,
    })),
    setPin: answering<AdminReview>(),
    ...actions,
  };
}

function renderEdit(actions: Partial<ReviewEditorActions> = {}, review: Partial<Review> = {}) {
  const user = userEvent.setup();
  render(
    <>
      <EditReview
        opened={opened(review)}
        products={PRODUCTS}
        deletePreview={{ faqQuotes: 1 }}
        pinnedCount={9}
        listHref="/admin/reviews?exam=ce"
        actions={actionsWith(actions)}
      />
      <Toaster />
    </>,
  );
  return user;
}

const editor = () => screen.getByRole("form", { name: "Edit review" });
const text = () => screen.getByLabelText("REVIEW TEXT · COPY WORD FOR WORD");
const status = () => within(editor()).getByRole("status");

beforeEach(() => {
  router.refresh.mockClear();
  router.replace.mockClear();
});

describe("EditReview", () => {
  it("opens with the Review's fields, its stars checked and the Website's card as PREVIEW", () => {
    renderEdit();

    expect(screen.getByRole("radio", { name: "5 stars" })).toBeChecked();
    expect(text()).toHaveValue(QUOTED.text);
    expect(screen.getByLabelText("PRODUCT")).toHaveValue("prd-005");
    expect(screen.getByLabelText("VARIATION BOUGHT · OPTIONAL")).toHaveValue("MSTC, HPGE, PSAD");
    expect(screen.getByLabelText("STORE")).toHaveValue("shopee");
    expect(screen.getByLabelText("HELPFUL VOTES")).toHaveValue("0");
    const card = screen.getByRole("figure");
    expect(within(card).getByText("Ultimate CE Posters 2.0")).toBeInTheDocument();
    expect(within(card).getByText("Variation: MSTC, HPGE, PSAD")).toBeInTheDocument();
    expect(status()).toHaveTextContent("UP TO DATE");
  });

  it("lists the Product's variations, and keeps one copied from the store", () => {
    renderEdit({}, { variation: "MSTC, HPGE, PSAD,160 gsm" });

    const options = within(screen.getByLabelText("VARIATION BOUGHT · OPTIONAL")).getAllByRole(
      "option",
    );
    expect(options.map((option) => option.textContent)).toEqual([
      "Not specified",
      "MSTC, HPGE, PSAD,160 gsm",
      "MSTC, HPGE, PSAD",
      "MSTC ONLY",
    ]);
  });

  it("lists the Live Products as “CE · CE Formula Flash Cards”", () => {
    renderEdit();

    const options = within(screen.getByLabelText("PRODUCT")).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "CE · CE Formula Flash Cards",
      "CE · Ultimate CE Posters 2.0",
    ]);
  });

  it("sets a variation the new Product doesn't have back to Not specified", async () => {
    const user = renderEdit();

    await user.selectOptions(screen.getByLabelText("PRODUCT"), "prd-001");

    expect(screen.getByLabelText("VARIATION BOUGHT · OPTIONAL")).toHaveValue("");
    expect(
      within(screen.getByRole("figure")).getByText("Variation not specified"),
    ).toBeInTheDocument();
  });

  it("updates PREVIEW as the stars and text change, and hides it with no text", async () => {
    const user = renderEdit();

    await user.click(screen.getByRole("radio", { name: "3 stars" }));
    expect(within(screen.getByRole("figure")).getByRole("img")).toHaveAccessibleName(
      "3 out of 5 stars",
    );
    expect(status()).toHaveTextContent("UNSAVED CHANGES");

    await user.clear(text());
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
    expect(
      screen.getByText("The card preview appears once you paste the review."),
    ).toBeInTheDocument();
  });

  it("saves the fields with the stamp it opened with, then says it's live", async () => {
    const save = answering<AdminReview>({
      status: "saved",
      value: saved({ helpful: 4, marketplace: "lazada" }),
    });
    const user = renderEdit({ save });

    await user.selectOptions(screen.getByLabelText("STORE"), "lazada");
    await user.clear(screen.getByLabelText("HELPFUL VOTES"));
    await user.type(screen.getByLabelText("HELPFUL VOTES"), "4");
    await user.click(screen.getByRole("button", { name: "Save review" }));

    await waitFor(() => expect(status()).toHaveTextContent("✓ SAVED · LIVE ON THE SITE"));
    expect(save).toHaveBeenCalledWith(expect.anything(), {
      input: {
        id: "rev-014",
        stars: 5,
        text: QUOTED.text,
        productId: "prd-005",
        variation: "MSTC, HPGE, PSAD",
        marketplace: "lazada",
        helpful: "4",
      },
      expected: { savedAt: OPENED_AT },
    });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("shows PASTE THE REVIEW TEXT TO SAVE, and the field's message, for no text", async () => {
    const save = answering<AdminReview>({
      status: "refused",
      error: {
        kind: "invalid",
        fieldErrors: { text: ["PASTE THE REVIEW TEXT"] },
        formError: "PASTE THE REVIEW TEXT TO SAVE",
      },
    });
    const user = renderEdit({ save });

    await user.clear(text());
    await user.click(screen.getByRole("button", { name: "Save review" }));

    await waitFor(() => expect(status()).toHaveTextContent("PASTE THE REVIEW TEXT TO SAVE"));
    expect(text()).toHaveAccessibleDescription("PASTE THE REVIEW TEXT");
    expect(text()).toHaveAttribute("aria-invalid", "true");
  });

  it("shows each field's message: stars, votes and the variation", async () => {
    const save = answering<AdminReview>({
      status: "refused",
      error: {
        kind: "invalid",
        fieldErrors: {
          stars: ["CHOOSE 1 TO 5 STARS"],
          helpful: ["ENTER A WHOLE NUMBER, 0 OR MORE"],
          variation: ["NOT A VARIATION OF ULTIMATE CE POSTERS 2.0"],
        },
      },
    });
    const user = renderEdit({ save });

    await user.click(screen.getByRole("button", { name: "Save review" }));

    await waitFor(() => expect(status()).toHaveTextContent("FIX THE FIELDS MARKED IN RED"));
    expect(screen.getByRole("group", { name: "STARS" })).toHaveAccessibleDescription(
      "CHOOSE 1 TO 5 STARS",
    );
    expect(screen.getByLabelText("HELPFUL VOTES")).toHaveAccessibleDescription(
      "ENTER A WHOLE NUMBER, 0 OR MORE",
    );
    expect(screen.getByLabelText("VARIATION BOUGHT · OPTIONAL")).toHaveAccessibleDescription(
      "NOT A VARIATION OF ULTIMATE CE POSTERS 2.0",
    );
  });

  it("says which FAQ quotes the Review when an edit would break the quote", async () => {
    const message =
      "The FAQ “What are the posters like?” quotes this Review. Edit that quote first.";
    const save = answering<AdminReview>({
      status: "refused",
      error: { kind: "invalid", fieldErrors: {}, formError: message },
    });
    const user = renderEdit({ save });

    await user.clear(text());
    await user.type(text(), "Quality 10/10.");
    await user.click(screen.getByRole("button", { name: "Save review" }));

    await waitFor(() => expect(status()).toHaveTextContent(message));
    expect(text()).toHaveValue("Quality 10/10.");
  });

  it("shows the conflict and keeps the edits when someone saved first", async () => {
    const save = answering<AdminReview>({
      status: "refused",
      error: { kind: "conflict", savedBy: "Angel Rose L. Lepaña", savedAt: SAVED_AT },
    });
    const user = renderEdit({ save });

    await user.click(screen.getByRole("radio", { name: "2 stars" }));
    await user.click(screen.getByRole("button", { name: "Save review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Angel Rose L\. Lepaña saved this Review at/,
    );
    expect(screen.getByRole("radio", { name: "2 stars" })).toBeChecked();
  });

  it("shows the “Couldn't save” toast when the save breaks down, keeping the edits", async () => {
    const save = answering<AdminReview>({ status: "failed" });
    const user = renderEdit({ save });

    await user.click(screen.getByRole("radio", { name: "4 stars" }));
    await user.click(screen.getByRole("button", { name: "Save review" }));

    expect(await screen.findByText(/“This review” wasn’t saved/)).toBeInTheDocument();
    expect(status()).toHaveTextContent("COULDN’T SAVE · YOUR EDITS ARE STILL IN THE FORM");
    expect(screen.getByRole("radio", { name: "4 stars" })).toBeChecked();
  });

  it("saves Pin on Home at once, as a single toggle, with the counter under it", async () => {
    const setPin = answering<AdminReview>({ status: "saved", value: saved({ homePin: null }) });
    const user = renderEdit({ setPin });

    const pin = screen.getByRole("switch", { name: "Pin on Home" });
    expect(pin).toHaveAccessibleDescription("9 OF 9 PINNED ON HOME");
    expect(pin).toHaveAttribute("aria-checked", "true");
    await user.click(pin);

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(setPin).toHaveBeenCalledWith(expect.anything(), {
      input: { id: "rev-014", pinned: false },
    });
    expect(status()).toHaveTextContent("UP TO DATE");
  });

  it("confirms a delete with the FAQ quote count, then goes back to the list", async () => {
    const remove = answering<DeletedReview>({
      status: "saved",
      value: { id: "rev-014", faqQuotes: 1 },
    });
    const user = renderEdit({ remove });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete this review?" });
    expect(dialog).toHaveAccessibleDescription(
      "It’s removed from Home, its product page, and its exam page. The original stays on the store. 1 FAQ quote from this Review is removed. This can’t be undone.",
    );
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Delete review" })).toBeEnabled(),
    );
    await user.click(within(dialog).getByRole("button", { name: "Delete review" }));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/admin/reviews?exam=ce", { scroll: false }),
    );
    expect(remove).toHaveBeenCalledWith(expect.anything(), { input: { id: "rev-014" } });
    expect(await screen.findByText("✓ DELETED · THE REVIEW IS OFF THE SITE")).toBeInTheDocument();
  });

  it("reads the count again as the dialog opens", async () => {
    const countDelete = vi.fn(async () => ({
      status: "saved" as const,
      value: { faqQuotes: 2 },
    }));
    const user = renderEdit({ countDelete });

    await user.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(dialog).toHaveAccessibleDescription(/2 FAQ quotes from this Review are removed\./),
    );
  });

  it("says when the Review was already deleted elsewhere", async () => {
    const remove = answering<DeletedReview>({ status: "refused", error: { kind: "not-found" } });
    const user = renderEdit({ remove });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Delete review" })).toBeEnabled(),
    );
    await user.click(within(dialog).getByRole("button", { name: "Delete review" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "IT’S ALREADY BEEN DELETED · RELOAD THE PAGE",
    );
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("NewReview", () => {
  function renderNew(actions: Partial<ReviewEditorActions> = {}, onAdded = vi.fn()) {
    const user = userEvent.setup();
    render(
      <NewReview
        products={PRODUCTS}
        pinnedCount={9}
        actions={actionsWith(actions)}
        onAdded={onAdded}
      />,
    );
    return { user, onAdded };
  }

  it("opens blank at 5★ for the first Live Product, with no preview until there's text", async () => {
    const { user } = renderNew();

    expect(screen.getByRole("radio", { name: "5 stars" })).toBeChecked();
    expect(screen.getByLabelText("PRODUCT")).toHaveValue("prd-001");
    expect(screen.getByLabelText("STORE")).toHaveValue("shopee");
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("REVIEW TEXT · COPY WORD FOR WORD"), "Sulit!");
    expect(within(screen.getByRole("figure")).getByText("Sulit!")).toBeInTheDocument();
  });

  it("adds the Review with Pin on Home as one of its fields", async () => {
    const added = saved({ id: "rev-017", productId: "prd-001", homePin: 10 });
    const add = answering<AdminReview>({ status: "saved", value: added });
    const { user, onAdded } = renderNew({ add });

    await user.type(
      screen.getByLabelText("REVIEW TEXT · COPY WORD FOR WORD"),
      "Sulit!{Enter}Ganda",
    );
    await user.selectOptions(screen.getByLabelText("STORE"), "tiktok");
    await user.click(screen.getByRole("switch", { name: "Pin on Home" }));
    await user.click(screen.getByRole("button", { name: "Add review" }));

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(added));
    expect(add).toHaveBeenCalledWith(expect.anything(), {
      input: {
        stars: 5,
        text: "Sulit!\nGanda",
        productId: "prd-001",
        variation: "",
        marketplace: "tiktok",
        helpful: "",
        pinned: true,
      },
      expected: { savedAt: new Date(0).toISOString() },
    });
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});
