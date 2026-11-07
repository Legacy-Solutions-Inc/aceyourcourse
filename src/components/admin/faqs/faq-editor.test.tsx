import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import type { AdminActionState } from "@/lib/admin/action";
import type { AdminFaq, DeletedFaq, FaqReviewOption } from "@/services/admin.types";
import type { Faq } from "@/services/catalogue.types";

import { EditFaq, type FaqEditorActions, NewFaq } from "./faq-editor";

// The FAQ editor and its quote picker, saving through stub Server Actions that
// answer as adminAction would. The router is the framework boundary, so it's
// replaced.
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  unstable_rethrow: () => {},
}));

const OPENED_AT = "2026-10-22T03:42:00.000Z";
const SAVED_AT = "2026-10-22T04:00:00.000Z";

const POSTERS_REVIEW: FaqReviewOption = {
  id: "rev-014",
  stars: 5,
  text: "Glossy type yung paper, makapal sya. Quality 10/10.",
  product: { shortName: "Ultimate CE Posters 2.0", examCode: "CE" },
};
const CARDS_REVIEW: FaqReviewOption = {
  id: "rev-001",
  stars: 4,
  text: "Suitability: Good. Sulit!",
  product: { shortName: "CE Formula Flash Cards", examCode: "CE" },
};
const REVIEWS = [CARDS_REVIEW, POSTERS_REVIEW];

const POSTERS: Faq = {
  id: "faq-005",
  slug: "posters",
  group: "paper",
  order: 2,
  question: "What are the posters like?",
  answer: "A3 size, printed big enough to read.",
  reviewQuote: { reviewId: "rev-014", text: "Glossy type yung paper" },
  popularLabel: null,
  requiresMemberApp: false,
  showOnFaqPage: true,
  showCoverageTable: false,
};
const opened = (faq: Partial<Faq> = {}): AdminFaq => ({
  faq: { ...POSTERS, ...faq },
  stamp: { savedAt: OPENED_AT, savedBy: null },
});
const saved = (faq: Partial<Faq> = {}): AdminFaq => ({
  faq: { ...POSTERS, ...faq },
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

function actionsWith(actions: Partial<FaqEditorActions> = {}): FaqEditorActions {
  return {
    save: answering<AdminFaq>(),
    add: answering<AdminFaq>(),
    remove: answering<DeletedFaq>(),
    ...actions,
  };
}

function renderEdit(actions: Partial<FaqEditorActions> = {}, faq: Partial<Faq> = {}) {
  const user = userEvent.setup();
  const onSaved = vi.fn();
  render(
    <>
      <EditFaq
        opened={opened(faq)}
        reviews={REVIEWS}
        listHref="/admin/reviews?tab=faqs&group=paper"
        actions={actionsWith(actions)}
        onSaved={onSaved}
      />
      <Toaster />
    </>,
  );
  return { user, onSaved };
}

const editor = () => screen.getByRole("form", { name: "Edit question" });
const status = () => within(editor()).getByRole("status");
const question = () => screen.getByLabelText("QUESTION");
const answer = () => screen.getByLabelText("ANSWER");
const quote = () => screen.getByLabelText("QUOTE FROM A REAL REVIEW");
const flag = (name: string) => screen.getByRole("switch", { name });

beforeEach(() => {
  router.refresh.mockClear();
  router.replace.mockClear();
});

describe("EditFaq", () => {
  it("opens with the FAQ's fields, its fixed deep link, and the quote with its credit line", () => {
    renderEdit();

    expect(question()).toHaveValue("What are the posters like?");
    expect(answer()).toHaveValue("A3 size, printed big enough to read.");
    expect(answer()).toHaveAccessibleDescription("36 / 400 CHARACTERS");
    expect(screen.getByLabelText("GROUP")).toHaveValue("paper");
    expect(screen.getByText("DEEP LINK · aceyourcourse.ph/faq#faq-posters")).toBeInTheDocument();
    expect(screen.getByText(POSTERS_REVIEW.text)).toBeInTheDocument();
    expect(quote()).toHaveValue("Glossy type yung paper");
    expect(screen.getByText("★★★★★ · Ultimate CE Posters 2.0")).toBeInTheDocument();
    expect(flag("Show on FAQ page")).toHaveAttribute("aria-checked", "true");
    expect(flag("Show on FAQ page")).toHaveAccessibleDescription("Off keeps it saved but hidden");
    expect(flag("Popular question")).toHaveAttribute("aria-checked", "false");
    expect(flag("Only while the Member App is live")).toHaveAttribute("aria-checked", "false");
    expect(flag("Show the Subjects table")).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByLabelText("CHIP LABEL")).not.toBeInTheDocument();
  });

  it("turns the answer's counter red over 400 characters", async () => {
    const { user } = renderEdit();
    const counter = () => screen.getByText(/\/ 400 CHARACTERS$/);

    await user.clear(answer());
    await user.click(answer());
    await user.paste("a".repeat(400));
    expect(counter()).toHaveTextContent("400 / 400 CHARACTERS");
    expect(counter()).not.toHaveClass("text-destructive");

    await user.type(answer(), "a");
    expect(counter()).toHaveTextContent("401 / 400 CHARACTERS");
    expect(counter()).toHaveClass("text-destructive");
  });

  it("saves every field with the stamp it opened with, then says it's live on the FAQ page", async () => {
    const save = answering<AdminFaq>({
      status: "saved",
      value: saved({ group: "coverage", showOnFaqPage: false, popularLabel: "Posters?" }),
    });
    const { user, onSaved } = renderEdit({ save });

    await user.selectOptions(screen.getByLabelText("GROUP"), "coverage");
    await user.click(flag("Show on FAQ page"));
    await user.click(flag("Popular question"));
    await user.type(screen.getByLabelText("CHIP LABEL"), "Posters?");
    await user.click(screen.getByRole("button", { name: "Save question" }));

    await waitFor(() => expect(status()).toHaveTextContent("✓ SAVED · LIVE ON THE FAQ PAGE"));
    expect(save).toHaveBeenCalledWith(expect.anything(), {
      input: {
        id: "faq-005",
        question: "What are the posters like?",
        answer: "A3 size, printed big enough to read.",
        group: "coverage",
        quoteReviewId: "rev-014",
        quoteText: "Glossy type yung paper",
        popular: true,
        popularLabel: "Posters?",
        requiresMemberApp: false,
        showOnFaqPage: false,
        showCoverageTable: false,
      },
      expected: { savedAt: OPENED_AT },
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ stamp: expect.anything() }));
  });

  it("counts the chip label, red over 40 characters", async () => {
    const { user } = renderEdit({}, { popularLabel: "Posters?" });
    const label = () => screen.getByLabelText("CHIP LABEL");

    expect(label()).toHaveAccessibleDescription("8 / 40 characters");
    await user.clear(label());
    await user.type(label(), "x".repeat(41));

    expect(screen.getByText("41 / 40")).toHaveClass("text-destructive");
  });

  it("shows WRITE A QUESTION AND ANSWER TO SAVE, and each field's message", async () => {
    const save = answering<AdminFaq>({
      status: "refused",
      error: {
        kind: "invalid",
        fieldErrors: { question: ["WRITE THE QUESTION"], answer: ["WRITE THE ANSWER"] },
        formError: "WRITE A QUESTION AND ANSWER TO SAVE",
      },
    });
    const { user } = renderEdit({ save });

    await user.clear(question());
    await user.clear(answer());
    await user.click(screen.getByRole("button", { name: "Save question" }));

    await waitFor(() => expect(status()).toHaveTextContent("WRITE A QUESTION AND ANSWER TO SAVE"));
    expect(question()).toHaveAccessibleDescription("WRITE THE QUESTION");
    expect(question()).toHaveAttribute("aria-invalid", "true");
    expect(answer()).toHaveAccessibleDescription("WRITE THE ANSWER 0 / 400 CHARACTERS");
  });

  it("says a quote isn't in the Review word for word, and a chip label or table's message", async () => {
    const save = answering<AdminFaq>({
      status: "refused",
      error: {
        kind: "invalid",
        fieldErrors: {
          quoteText: ["This text isn’t in the Review word for word."],
          showCoverageTable: ["“What subjects…?” SHOWS IT · ONLY ONE QUESTION CAN"],
        },
      },
    });
    const { user } = renderEdit({ save });

    await user.type(quote(), "!");
    await user.click(flag("Show the Subjects table"));
    await user.click(screen.getByRole("button", { name: "Save question" }));

    await waitFor(() => expect(status()).toHaveTextContent("FIX THE FIELDS MARKED IN RED"));
    expect(quote()).toHaveAccessibleDescription("This text isn’t in the Review word for word.");
    expect(
      screen.getByText("“What subjects…?” SHOWS IT · ONLY ONE QUESTION CAN"),
    ).toBeInTheDocument();
  });

  it("shows the conflict and keeps the edits when someone saved first", async () => {
    const save = answering<AdminFaq>({
      status: "refused",
      error: { kind: "conflict", savedBy: "Angel Rose L. Lepaña", savedAt: SAVED_AT },
    });
    const { user } = renderEdit({ save });

    await user.type(answer(), " Glossy.");
    await user.click(screen.getByRole("button", { name: "Save question" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Angel Rose L\. Lepaña saved this question at/,
    );
    expect(status()).toHaveTextContent("NOT SAVED");
    expect(answer()).toHaveValue("A3 size, printed big enough to read. Glossy.");
  });

  it("confirms a delete with the mockup's copy, then goes back to the list", async () => {
    const remove = answering<DeletedFaq>({ status: "saved", value: { id: "faq-005" } });
    const { user } = renderEdit({ remove });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Delete “What are the posters like?”?",
    });
    expect(dialog).toHaveAccessibleDescription(
      "It’s removed from the FAQ page and from what search engines and AI assistants can quote. To keep it for later, turn off “Show on FAQ page” instead.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Delete question" }));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/admin/reviews?tab=faqs&group=paper", {
        scroll: false,
      }),
    );
    expect(remove).toHaveBeenCalledWith(expect.anything(), { input: { id: "faq-005" } });
    expect(await screen.findByText("✓ DELETED · THE QUESTION IS OFF THE FAQ PAGE")).toBeVisible();
  });

  it("says when the FAQ was already deleted elsewhere", async () => {
    const remove = answering<DeletedFaq>({ status: "refused", error: { kind: "not-found" } });
    const { user } = renderEdit({ remove });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete question" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "IT’S ALREADY BEEN DELETED · RELOAD THE PAGE",
    );
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("the quote picker", () => {
  it("removes the quote, then finds a Review by its words or its Product and credits it", async () => {
    const { user } = renderEdit();

    await user.click(screen.getByRole("button", { name: "Remove quote" }));
    expect(screen.queryByLabelText("QUOTE FROM A REAL REVIEW")).not.toBeInTheDocument();

    const find = screen.getByLabelText("FIND A REVIEW TO QUOTE");
    await user.type(find, "flash cards");
    const matches = screen.getByRole("list", { name: "Matching reviews" });
    expect(within(matches).getAllByRole("button")).toHaveLength(1);
    await user.clear(find);
    await user.type(find, "GLOSSY");
    await user.click(
      screen.getByRole("button", {
        name: "Quote this review: “Glossy type yung paper, makapal sya.…” · Ultimate CE Posters 2.0",
      }),
    );

    expect(screen.getByText("★★★★★ · Ultimate CE Posters 2.0")).toBeInTheDocument();
    expect(quote()).toHaveValue("");
    await user.type(quote(), "Quality 10/10.");
    expect(quote()).toHaveValue("Quality 10/10.");
  });

  it("says when no Review matches", async () => {
    const { user } = renderEdit({}, { reviewQuote: null });

    await user.type(screen.getByLabelText("FIND A REVIEW TO QUOTE"), "zzz");

    expect(screen.getByText("No Reviews match.")).toBeInTheDocument();
  });

  it("quotes the words selected in the Review", async () => {
    const { user } = renderEdit();
    const review = screen.getByText(POSTERS_REVIEW.text);
    const words = review.firstChild;
    if (!words) throw new Error("the Review has no text");

    const range = document.createRange();
    range.setStart(words, 37);
    range.setEnd(words, 51);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    await user.click(screen.getByRole("button", { name: "Quote the selected words" }));

    expect(quote()).toHaveValue("Quality 10/10.");
  });

  it("asks for a selection in the Review when there's none", async () => {
    const { user } = renderEdit();
    window.getSelection()?.removeAllRanges();

    await user.click(screen.getByRole("button", { name: "Quote the selected words" }));

    expect(screen.getByText("Select words in the Review first.")).toBeInTheDocument();
    expect(quote()).toHaveValue("Glossy type yung paper");
  });

  it("keeps a quote whose Review isn't on the website now, saying the page leaves it out", () => {
    renderEdit({}, { reviewQuote: { reviewId: "rev-099", text: "Sulit" } });

    expect(
      screen.getByText(/isn’t on the Website now, so the FAQ page leaves the quote out/),
    ).toBeInTheDocument();
    expect(quote()).toHaveValue("Sulit");
    expect(screen.getByRole("button", { name: "Remove quote" })).toBeInTheDocument();
  });
});

describe("NewFaq", () => {
  function renderNew(actions: Partial<FaqEditorActions> = {}) {
    const user = userEvent.setup();
    const onAdded = vi.fn();
    render(
      <NewFaq
        group="buying"
        reviews={REVIEWS}
        slugs={["ship", "can-i-pay-by-gcash"]}
        actions={actionsWith(actions)}
        onAdded={onAdded}
      />,
    );
    return { user, onAdded };
  }

  it("opens blank in its group, shown on the FAQ page, its deep link set from the question", async () => {
    const { user } = renderNew();

    expect(screen.getByText("NEW QUESTION · BUYING")).toBeInTheDocument();
    expect(screen.getByLabelText("GROUP")).toHaveValue("buying");
    expect(screen.getByRole("switch", { name: "Show on FAQ page" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      screen.getByText("DEEP LINK · SET FROM THE QUESTION WHEN YOU ADD IT"),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("QUESTION"), "Can I pay by GCash?");
    expect(
      screen.getByText("DEEP LINK · aceyourcourse.ph/faq#faq-can-i-pay-by-gcash-2"),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("GROUP"), "shipping");
    expect(screen.getByText("NEW QUESTION · SHIPPING")).toBeInTheDocument();
  });

  it("adds the FAQ and hands it on", async () => {
    const added = saved({ id: "faq-019", slug: "can-i-pay-by-gcash-2", group: "buying" });
    const add = answering<AdminFaq>({ status: "saved", value: added });
    const { user, onAdded } = renderNew({ add });

    await user.type(screen.getByLabelText("QUESTION"), "Can I pay by GCash?");
    await user.type(screen.getByLabelText("ANSWER"), "Yes.");
    await user.click(screen.getByRole("button", { name: "Add question" }));

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(added));
    expect(add).toHaveBeenCalledWith(expect.anything(), {
      input: expect.objectContaining({
        question: "Can I pay by GCash?",
        answer: "Yes.",
        group: "buying",
      }),
      expected: { savedAt: new Date(0).toISOString() },
    });
  });
});
