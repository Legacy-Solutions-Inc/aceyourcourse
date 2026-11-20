import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type { AdminQuestion } from "@/services/admin.types";
import type { ContentUploadTicket } from "@/services/uploads.types";

import { QuestionForm, type QuestionFormActions } from "./question-form";

// The question form (ticket 10; story 125): the question, four choices A–D,
// the correct one, the explanation and an optional figure, a live preview
// with the maths rendered, and "Save" and "Save & add next", as the card form
// does cards. The Server Actions are the boundary, so they're replaced: the
// form checks each field and the figure before it uploads or saves anything,
// and shows what the server answered next to the field it's about.
const { toast, putFile } = vi.hoisted(() => ({
  toast: vi.fn(),
  putFile: vi.fn(async () => {}),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/admin/products/put-file", () => ({ putFile }));

const TOPIC = "11111111-1111-4111-8111-111111111111";
const OPENED = { savedAt: "2026-11-18T01:00:00.000Z", savedBy: null };

const QUESTION: AdminQuestion = {
  id: "22222222-2222-4222-8222-222222222222",
  position: 2,
  question: "Degree of curve for $R = 200$ m?",
  choices: { A: "$5.73°$", B: "$11.46°$", C: "$2.86°$", D: "$1.43°$" },
  correct: "A",
  explanation: "$D = \\frac{1145.916}{R}$",
  figure: null,
  stamp: OPENED,
};

const saved = <T,>(value: T): AdminActionState<T> => ({ status: "saved", value });

function renderForm(
  question: AdminQuestion | null = null,
  overrides: Partial<QuestionFormActions> = {},
) {
  const actions = {
    createFigureUpload: vi.fn(async (): Promise<AdminActionState<ContentUploadTicket>> =>
      saved({ uploadUrl: "/upload?token=t", path: "uploads/fig", contentType: "image/png" }),
    ),
    addQuestion: vi.fn(async (_: unknown, { input }: { input: unknown }) =>
      saved({
        ...QUESTION,
        ...(input as object),
        id: "33333333-3333-4333-8333-333333333333",
        position: 3,
      }),
    ),
    saveQuestion: vi.fn(async (_: unknown, { input }: { input: unknown }) =>
      saved({
        ...QUESTION,
        ...(input as object),
        stamp: { savedAt: "2026-11-18T02:00:00.000Z", savedBy: "AYC Content Team" },
      }),
    ),
    ...overrides,
  };
  const onSaved = vi.fn();
  render(
    <QuestionForm
      topicId={TOPIC}
      question={question}
      figureSrc={question?.figure ? "/admin/content/quiz/figure/x" : null}
      actions={actions as QuestionFormActions}
      onSaved={onSaved}
    />,
  );
  return { actions, onSaved, user: userEvent.setup() };
}

const field = (name: RegExp) => screen.getByLabelText(name);
const correct = () => screen.getByRole("group", { name: "CORRECT CHOICE" });
const preview = () => screen.getByRole("region", { name: "PREVIEW · AS MEMBERS SEE IT" });

/** Types a whole question that saves: maths, four choices, B correct (or `pick` null: none picked). */
async function fillIn(
  user: ReturnType<typeof userEvent.setup>,
  { pick = "B" }: { pick?: "B" | null } = {},
) {
  fireEvent.change(field(/^QUESTION/), { target: { value: "Tangent distance for $I = 30°$?" } });
  for (const [choice, text] of Object.entries({
    A: "10 m",
    B: "$R\\tan 15°$",
    C: "20 m",
    D: "5 m",
  })) {
    fireEvent.change(field(new RegExp(`^CHOICE ${choice}`)), { target: { value: text } });
  }
  if (pick) await user.click(within(correct()).getByRole("radio", { name: pick }));
  fireEvent.change(field(/^EXPLANATION/), { target: { value: "$T = R \\tan(I/2)$" } });
}

beforeEach(() => {
  toast.mockClear();
  putFile.mockClear();
  URL.createObjectURL = vi.fn(() => "blob:chosen");
  URL.revokeObjectURL = vi.fn();
});

describe("the question form", () => {
  it("previews the question as Members see it, maths rendered, the correct choice marked", async () => {
    const { user } = renderForm();
    await fillIn(user);

    expect(
      within(preview())
        .getByText(/Tangent distance for/)
        .closest("div")
        ?.querySelector(".katex"),
    ).not.toBeNull();
    const choices = within(preview()).getByRole("list", { name: "Choices" });
    expect(
      within(choices)
        .getAllByRole("listitem")
        .map((item) => item.textContent?.replace(/\s+/g, " ")),
    ).toEqual(["A10 m", expect.stringMatching(/^B.*✓ CORRECT$/), "C20 m", "D5 m"]);
    expect(within(preview()).getByText("EXPLANATION · SHOWN AFTER SCORING")).toBeInTheDocument();
  });

  it("shows where each part will appear while the form is empty", () => {
    renderForm();

    expect(within(preview()).getByText("The question shows here")).toBeInTheDocument();
    expect(within(preview()).getByText("The explanation shows here")).toBeInTheDocument();
  });

  it("saves a new question with “Save & add next”, then clears the form for the next one", async () => {
    const { actions, onSaved, user } = renderForm();
    await fillIn(user);
    await user.click(screen.getByRole("button", { name: "Save & add next" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(actions.addQuestion).toHaveBeenCalledWith(expect.anything(), {
      input: {
        topic: TOPIC,
        question: "Tangent distance for $I = 30°$?",
        choices: { A: "10 m", B: "$R\\tan 15°$", C: "20 m", D: "5 m" },
        correct: "B",
        explanation: "$T = R \\tan(I/2)$",
        figure: null,
      },
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ position: 3 }), true);
    expect(field(/^QUESTION/)).toHaveValue("");
    expect(field(/^CHOICE B/)).toHaveValue("");
    expect(within(correct()).getByRole("radio", { name: "B" })).not.toBeChecked();
    expect(field(/^QUESTION/)).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(
      "✓ SAVED QUESTION 3 · WRITING THE NEXT ONE",
    );
    expect(toast).toHaveBeenCalledWith("✓ SAVED · QUESTION 3");
  });

  it("refuses a question with no correct choice picked, saying so next to the choices", async () => {
    const { actions, user } = renderForm();
    await fillIn(user, { pick: null });
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(actions.addQuestion).not.toHaveBeenCalled();
    expect(correct()).toHaveAccessibleDescription("PICK THE CORRECT CHOICE TO SAVE");
  });

  it("refuses an empty choice next to its field, before saving anything", async () => {
    const { actions, user } = renderForm();
    await fillIn(user);
    fireEvent.change(field(/^CHOICE C/), { target: { value: "  " } });
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(actions.addQuestion).not.toHaveBeenCalled();
    expect(field(/^CHOICE C/)).toHaveAccessibleDescription("ADD CHOICE C TO SAVE");
    expect(field(/^CHOICE C/)).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a formula that won't render in the preview, and refuses it on save", async () => {
    const { actions, user } = renderForm();
    await fillIn(user);
    fireEvent.change(field(/^CHOICE D/), { target: { value: "$\\frac{1}{$" } });

    const problem =
      "Choice D has a formula that won’t render, “\\frac{1}{”: Unexpected end of input in a macro argument, expected '}'";
    expect(within(preview()).getByText(problem)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(actions.addQuestion).not.toHaveBeenCalled();
    expect(field(/^CHOICE D/)).toHaveAccessibleDescription(problem);
  });

  it("edits a question with the stamp it opened with, then each save's own", async () => {
    const { actions, onSaved, user } = renderForm(QUESTION);
    expect(field(/^QUESTION/)).toHaveValue(QUESTION.question);
    expect(within(correct()).getByRole("radio", { name: "A" })).toBeChecked();

    await user.click(within(correct()).getByRole("radio", { name: "C" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));

    expect(actions.saveQuestion).toHaveBeenNthCalledWith(1, expect.anything(), {
      input: {
        id: QUESTION.id,
        question: QUESTION.question,
        choices: QUESTION.choices,
        correct: "C",
        explanation: QUESTION.explanation,
        figure: null,
      },
      expected: { savedAt: OPENED.savedAt },
    });
    expect(actions.saveQuestion).toHaveBeenNthCalledWith(2, expect.anything(), {
      input: expect.objectContaining({ id: QUESTION.id }),
      expected: { savedAt: "2026-11-18T02:00:00.000Z" },
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: QUESTION.id }), false);
    expect(screen.getByRole("status")).toHaveTextContent("✓ SAVED QUESTION 2");
  });

  it("says who saved first when the edit is stale, keeping the form as it is", async () => {
    const { user } = renderForm(QUESTION, {
      saveQuestion: vi.fn(async () => ({
        status: "refused" as const,
        error: { kind: "conflict" as const, savedBy: "Angel", savedAt: "2026-11-18T02:00:00.000Z" },
      })),
    });
    await user.type(field(/^EXPLANATION/), " Arc basis.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("SOMEONE SAVED FIRST");
    expect(screen.getByRole("alert")).toHaveTextContent(/Angel saved this question/);
    expect(field(/^EXPLANATION/)).toHaveValue(`${QUESTION.explanation} Arc basis.`);
  });

  it("shows the server's refusals next to their fields, and the form's own", async () => {
    const { user } = renderForm(null, {
      addQuestion: vi.fn(async () => ({
        status: "refused" as const,
        error: {
          kind: "invalid" as const,
          fieldErrors: {
            "choices.A": ["KEEP IT TO 500 CHARACTERS"],
            correct: ["PICK THE CORRECT CHOICE TO SAVE"],
            figure: ["UPLOAD THE IMAGE AGAIN"],
          },
        },
      })),
    });
    await fillIn(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(field(/^CHOICE A/)).toHaveAccessibleDescription("KEEP IT TO 500 CHARACTERS"),
    );
    expect(correct()).toHaveAccessibleDescription("PICK THE CORRECT CHOICE TO SAVE");
    expect(screen.getByLabelText("Add a figure")).toHaveAccessibleDescription(
      "UPLOAD THE IMAGE AGAIN",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "NOT SAVED · CHECK THE FIELDS MARKED IN RED",
    );
  });

  it("says the question is gone when the server can't find it", async () => {
    const { user } = renderForm(QUESTION, {
      saveQuestion: vi.fn(async () => ({
        status: "refused" as const,
        error: { kind: "not-found" as const },
      })),
    });
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "THAT QUESTION OR TOPIC IS GONE · RELOAD THE PAGE",
    );
  });

  it.each([
    [
      "a GIF",
      new File(["gif"], "curve.gif", { type: "image/gif" }),
      "USE A JPEG, PNG OR WEBP IMAGE",
    ],
    [
      "a figure over 5 MB",
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "curve.png", { type: "image/png" }),
      "KEEP THE IMAGE TO 5 MB",
    ],
  ])("refuses %s before uploading anything", (_, file, message) => {
    const { actions } = renderForm();
    fireEvent.change(screen.getByLabelText("Add a figure"), { target: { files: [file] } });

    expect(screen.getByLabelText("Add a figure")).toHaveAccessibleDescription(message);
    expect(actions.createFigureUpload).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("previews a chosen figure, uploads it on save and saves its path", async () => {
    const { actions, user } = renderForm();
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "curve.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByLabelText("Add a figure"), { target: { files: [file] } });
    expect(within(preview()).getByRole("img", { name: "Figure for the question" })).toHaveAttribute(
      "src",
      "blob:chosen",
    );
    await fillIn(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(actions.addQuestion).toHaveBeenCalled());
    expect(actions.createFigureUpload).toHaveBeenCalledWith(expect.anything(), {
      input: { contentType: "image/png", size: 4 },
    });
    expect(putFile).toHaveBeenCalledWith(
      "/upload?token=t",
      file,
      expect.any(Function),
      "image/png",
    );
    expect(actions.addQuestion).toHaveBeenCalledWith(expect.anything(), {
      input: expect.objectContaining({ figure: "uploads/fig" }),
    });
  });

  it("removes a saved figure, saving the question with none", async () => {
    const { actions, user } = renderForm({ ...QUESTION, figure: "quizzes/q/f.png" });
    expect(within(preview()).getByRole("img", { name: "Figure for the question" })).toHaveAttribute(
      "src",
      "/admin/content/quiz/figure/x",
    );
    await user.click(screen.getByRole("button", { name: "Remove figure" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(actions.saveQuestion).toHaveBeenCalledWith(expect.anything(), {
        input: expect.objectContaining({ figure: null }),
        expected: { savedAt: OPENED.savedAt },
      }),
    );
  });
});
