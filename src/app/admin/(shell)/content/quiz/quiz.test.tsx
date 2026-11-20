import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type { AdminQuizSettings } from "@/services/admin.types";
import { getOrCreateMember } from "@/services/member.mock";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";
import { sampleUserId } from "@/services/mock/members";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import { receiveSampleUpload } from "@/services/uploads.mock";

import { importZip, quizCsv } from "../../../../../../test/import-files";
import { imageBytes } from "../../../../../../test/image-bytes";
import {
  addQuestion,
  checkQuizImport,
  createImportUpload,
  importQuizzes,
  moveQuestionInQuiz,
  removeQuestion,
  saveQuestion,
  saveQuizFreePreview,
  saveQuizSettings,
  saveQuizVisibility,
} from "../actions";
import { GET as questionFigure } from "./figure/[question]/route";
import QuizPage from "./page";

// Member App content → a Topic's quiz (Phase 3, tickets 09 and 10; stories
// 125–128), on sample data: the page as a browser loads it, its Server
// Actions as a browser sends them (the question editor's too), and the
// Staff-only figure route. Every Admin action's refusals for signed-out
// visitors, non-Staff and closed mode are also in actions.permissions.test.ts;
// the seam's rules in admin.quiz.test.ts and admin.questions.test.ts.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/admin/content/quiz",
  useRouter: () => ({ refresh: () => {}, replace: () => {} }),
  unstable_rethrow: () => {},
}));

const IDLE: AdminActionState<never> = { status: "idle" };
const EDITOR = "content@aceyourcourse.ph";
const TESTER = "tester@example.com";
const SPIRAL_CURVES = sampleTopicId("CE", "MSTC", "Spiral Curves");
const SPIRAL_CURVES_QUIZ = sampleContentId(SPIRAL_CURVES, "quiz");
const SURVEYING = sampleTopicId("CE", "MSTC", "Surveying");
const PNG = imageBytes("image/png");

const signInAs = (email: string) => jar.set("ayc_admin_sample", email);
const renderPage = async (params: Record<string, string> = {}) =>
  render(await QuizPage({ searchParams: Promise.resolve(params) }));

/** Uploads a file to the sample data, as the import screen does. */
async function upload(purpose: "import-csv" | "import-zip", bytes: Uint8Array) {
  const created = await createImportUpload(IDLE, { input: { purpose, size: bytes.byteLength } });
  if (created.status !== "saved") throw new Error(JSON.stringify(created));
  const url = new URL(created.value.uploadUrl, "http://localhost");
  await receiveSampleUpload(
    url.pathname.split("/").at(-1) ?? "",
    url.searchParams.get("token") ?? "",
    {
      contentType: created.value.contentType,
      contentLength: bytes.byteLength,
      body: async () => bytes,
    },
  );
  return created.value.path;
}

/** Imports two questions into Spiral Curves' Hidden quiz, the second with a figure. */
async function withQuestions() {
  const csv = await upload(
    "import-csv",
    quizCsv([
      "Spiral Curves,Length of spiral $L_s$?,1 m,2 m,3 m,4 m,B,$L_s = 0.036 V^3/R$,",
      "Spiral Curves,Spiral angle?,a,b,c,d,D,Because.,spiral.png",
    ]),
  );
  const zip = await upload("import-zip", importZip({ "spiral.png": PNG }));
  const input = { exam: "ce", subject: "mstc", csv, zip, mode: "add" };
  const checked = await checkQuizImport(IDLE, { input });
  if (checked.status !== "saved") throw new Error(JSON.stringify(checked));
  const imported = await importQuizzes(IDLE, {
    input: { ...input, basedOn: checked.value.basedOn },
  });
  if (imported.status !== "saved") throw new Error(JSON.stringify(imported));
}

/** The quiz's settings as the page would open them, and a question nobody has saved. */
const openedStamp = () => ({ savedAt: getSampleStore().bootedAt });

/** The stamp a saved question's form opens with. */
const openedStampOf = (state: AdminActionState<{ stamp: { savedAt: string } }>) => ({
  savedAt: state.status === "saved" ? state.value.stamp.savedAt : "",
});

/** A question's fields that save, apart from the question itself. */
const FIELDS = {
  choices: { A: "$5.73°$", B: "$11.46°$", C: "$2.86°$", D: "$1.43°$" },
  correct: "C",
  explanation: "$D = \\frac{1145.916}{R}$",
  figure: null,
} as const;

beforeEach(() => {
  jar.clear();
  resetSampleStore();
});

describe("the quiz page", () => {
  it("opens an Editor on a Topic's quiz: its state, settings, questions and a new question's form", async () => {
    signInAs(EDITOR);
    await withQuestions();
    await renderPage({ topic: SPIRAL_CURVES });

    expect(screen.getByRole("heading", { level: 2, name: "Spiral Curves quiz" })).toBeVisible();
    expect(screen.getByText("CE · MSTC · 2 QUESTIONS · HIDDEN")).toBeInTheDocument();
    expect(screen.getByLabelText(/PASSING SCORE/)).toHaveValue("70");
    expect(screen.getByRole("switch", { name: "Shuffle questions" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Show answers after" })).toBeChecked();
    const questions = within(screen.getByRole("list", { name: "Questions in Spiral Curves" }));
    expect(questions.getAllByRole("link").map((link) => link.getAttribute("aria-label"))).toEqual([
      "Edit question 1: Length of spiral $L_s$?",
      "Edit question 2: Spiral angle?",
    ]);
    expect(screen.getByRole("form", { name: "New question" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← MSTC Topics" })).toHaveAttribute(
      "href",
      "/admin/content?exam=ce&subject=mstc",
    );
  });

  it("opens a question in the form, previewed with its figure and its correct choice marked", async () => {
    signInAs(EDITOR);
    await withQuestions();
    const [, second] = getSampleStore().questions.filter((q) => q.quizId === SPIRAL_CURVES_QUIZ);
    await renderPage({ topic: SPIRAL_CURVES, question: second?.id ?? "" });

    expect(screen.getByRole("form", { name: "Question 2" })).toBeInTheDocument();
    const preview = within(screen.getByRole("region", { name: "PREVIEW · AS MEMBERS SEE IT" }));
    expect(preview.getByRole("img", { name: "Figure for the question" })).toHaveAttribute(
      "src",
      `/admin/content/quiz/figure/${second?.id}`,
    );
    const choices = preview.getAllByRole("listitem").map((item) => item.textContent);
    expect(choices).toEqual(["Aa", "Bb", "Cc", "Dd✓ CORRECT"]);
  });

  it("opens a new question's form for a question that was removed, or isn't there", async () => {
    signInAs(EDITOR);
    await withQuestions();
    const [first] = getSampleStore().questions.filter((q) => q.quizId === SPIRAL_CURVES_QUIZ);
    await removeQuestion(IDLE, { input: { id: first?.id ?? "" } });

    await renderPage({ topic: SPIRAL_CURVES, question: first?.id ?? "" });

    expect(screen.getByRole("form", { name: "New question" })).toBeInTheDocument();
    expect(screen.getByText("CE · MSTC · 1 QUESTION · HIDDEN")).toBeInTheDocument();
  });

  it("lets a Topic with no quiz write its first question, or points to the quiz import", async () => {
    signInAs(EDITOR);
    await renderPage({ topic: SURVEYING });

    expect(screen.getByText("CE · MSTC · 0 QUESTIONS · NO QUIZ YET")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "import MSTC’s questions from a spreadsheet" }),
    ).toHaveAttribute("href", "/admin/content/import?exam=ce&subject=mstc&kind=quizzes");
    expect(screen.getByRole("form", { name: "New question" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save settings" })).not.toBeInTheDocument();
  });

  it("answers 404 for a Topic that isn't there", async () => {
    signInAs(EDITOR);
    await expect(renderPage({ topic: "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b" })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    await expect(renderPage({})).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sends someone signed out to sign-in, and a Member to the 403 screen", async () => {
    await expect(renderPage({ topic: SPIRAL_CURVES })).rejects.toThrow(
      "NEXT_REDIRECT /admin/sign-in",
    );
    signInAs(TESTER);
    await expect(renderPage({ topic: SPIRAL_CURVES })).rejects.toThrow(
      "NEXT_REDIRECT /admin/denied",
    );
  });
});

describe("the quiz's actions", () => {
  it("let an Editor change the passing score, and make the quiz Visible and Free Preview", async () => {
    signInAs(EDITOR);
    await withQuestions();

    const saved = await saveQuizSettings(IDLE, {
      input: { id: SPIRAL_CURVES_QUIZ, passingScore: "80", shuffle: false, showAnswers: true },
      expected: openedStamp(),
    });
    expect(saved).toMatchObject({
      status: "saved",
      value: { passingScore: 80, shuffle: false } satisfies Partial<AdminQuizSettings>,
    });
    expect(
      await saveQuizVisibility(IDLE, { input: { quiz: SPIRAL_CURVES_QUIZ, visible: true } }),
    ).toMatchObject({ status: "saved", value: { visibility: "visible" } });
    expect(
      await saveQuizFreePreview(IDLE, { input: { quiz: SPIRAL_CURVES_QUIZ, freePreview: true } }),
    ).toMatchObject({ status: "saved", value: { freePreview: true } });
  });

  it.each(["0", "101", "abc"])(
    "refuses a passing score of %j with the field's message",
    async (score) => {
      signInAs(EDITOR);

      expect(
        await saveQuizSettings(IDLE, {
          input: { id: SPIRAL_CURVES_QUIZ, passingScore: score, shuffle: true, showAnswers: true },
          expected: openedStamp(),
        }),
      ).toEqual({
        status: "refused",
        error: {
          kind: "invalid",
          fieldErrors: { passingScore: ["ENTER A WHOLE NUMBER FROM 1 TO 100"] },
        },
      });
    },
  );

  it("refuses an empty quiz made Visible, and settings without the stamp the form opened with", async () => {
    signInAs(EDITOR);

    expect(
      await saveQuizVisibility(IDLE, { input: { quiz: SPIRAL_CURVES_QUIZ, visible: true } }),
    ).toEqual({
      status: "refused",
      error: { kind: "invalid", fieldErrors: {}, formError: "ADD A QUESTION FIRST" },
    });
    expect(
      await saveQuizSettings(IDLE, {
        input: { id: SPIRAL_CURVES_QUIZ, passingScore: "80", shuffle: true, showAnswers: true },
      }),
    ).toMatchObject({ status: "refused", error: { kind: "invalid" } });
    expect(getSampleStore().quizzes.find((q) => q.id === SPIRAL_CURVES_QUIZ)).toMatchObject({
      visibility: "hidden",
      passingScore: 70,
    });
  });

  it("refuses every quiz action from a Member, the question editor's too, changing nothing", async () => {
    signInAs(EDITOR);
    await withQuestions();
    const [first, second] = getSampleStore().questions;
    await getOrCreateMember({ userId: sampleUserId(TESTER), email: TESTER, name: "Bea Tester" });
    signInAs(TESTER);
    const before = JSON.stringify([getSampleStore().quizzes, getSampleStore().questions]);

    for (const post of [
      () =>
        saveQuizSettings(IDLE, {
          input: { id: SPIRAL_CURVES_QUIZ, passingScore: "1", shuffle: false, showAnswers: false },
          expected: openedStamp(),
        }),
      () => saveQuizVisibility(IDLE, { input: { quiz: SPIRAL_CURVES_QUIZ, visible: false } }),
      () => saveQuizFreePreview(IDLE, { input: { quiz: SPIRAL_CURVES_QUIZ, freePreview: true } }),
      () => addQuestion(IDLE, { input: { topic: SPIRAL_CURVES, question: "Mine?", ...FIELDS } }),
      () =>
        saveQuestion(IDLE, {
          input: { id: first?.id, question: "Changed?", ...FIELDS },
          expected: openedStamp(),
        }),
      () => moveQuestionInQuiz(IDLE, { input: { id: second?.id, direction: "up" } }),
      () => removeQuestion(IDLE, { input: { id: first?.id } }),
    ]) {
      await expect(post()).rejects.toThrow("NEXT_REDIRECT /admin/denied");
    }
    expect(JSON.stringify([getSampleStore().quizzes, getSampleStore().questions])).toBe(before);
  });
});

describe("the question editor's actions", () => {
  it("let an Editor add a question with maths, edit it, reorder it and delete it", async () => {
    signInAs(EDITOR);
    await withQuestions();

    const added = await addQuestion(IDLE, {
      input: { topic: SPIRAL_CURVES, question: "Degree of curve for $R = 200$?", ...FIELDS },
    });
    expect(added).toMatchObject({ status: "saved", value: { position: 3, correct: "C" } });
    const id = added.status === "saved" ? added.value.id : "";
    const edited = await saveQuestion(IDLE, {
      input: { id, question: "Degree of curve?", ...FIELDS, correct: "A" },
      expected: openedStampOf(added),
    });
    expect(edited).toMatchObject({ status: "saved", value: { correct: "A" } });
    expect(await moveQuestionInQuiz(IDLE, { input: { id, direction: "up" } })).toMatchObject({
      status: "saved",
    });
    const removed = await removeQuestion(IDLE, { input: { id } });
    expect(removed).toMatchObject({ status: "saved", value: { quizHidden: false } });

    // Gone from the quiz, kept for old attempts.
    await renderPage({ topic: SPIRAL_CURVES });
    expect(screen.getByText("CE · MSTC · 2 QUESTIONS · HIDDEN")).toBeInTheDocument();
    expect(getSampleStore().questions.find((question) => question.id === id)).toMatchObject({
      question: "Degree of curve?",
      position: null,
      removedAt: expect.any(String),
    });
  });

  it("refuses a question with no correct choice, and an edit without the stamp its form opened with", async () => {
    signInAs(EDITOR);
    await withQuestions();
    const [first] = getSampleStore().questions;

    expect(
      await addQuestion(IDLE, {
        input: { topic: SPIRAL_CURVES, question: "Which?", ...FIELDS, correct: "" },
      }),
    ).toEqual({
      status: "refused",
      error: { kind: "invalid", fieldErrors: { correct: ["PICK THE CORRECT CHOICE TO SAVE"] } },
    });
    expect(
      await saveQuestion(IDLE, { input: { id: first?.id, question: "Changed?", ...FIELDS } }),
    ).toMatchObject({ status: "refused", error: { kind: "invalid" } });
    expect(getSampleStore().questions.map((question) => question.question)).toEqual([
      "Length of spiral $L_s$?",
      "Spiral angle?",
    ]);
  });
});

describe("the question figure route", () => {
  const get = (question: string) =>
    questionFigure(new Request(`http://localhost/admin/content/quiz/figure/${question}`), {
      params: Promise.resolve({ question }),
    });

  /** The questions in Spiral Curves' quiz, in order. */
  const questions = () =>
    getSampleStore()
      .questions.filter((question) => question.quizId === SPIRAL_CURVES_QUIZ)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  it("sends Staff a question's figure, privately, never cached for anyone else", async () => {
    signInAs(EDITOR);
    await withQuestions();
    const response = await get(questions()[1]?.id ?? "");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
  });

  it("answers 404 for a question with no figure, or no such question", async () => {
    signInAs(EDITOR);
    await withQuestions();

    expect((await get(questions()[0]?.id ?? "")).status).toBe(404);
    expect((await get("not-a-question")).status).toBe(404);
  });

  it("sends someone signed out to sign-in, and a Member to the 403 screen", async () => {
    signInAs(EDITOR);
    await withQuestions();
    const id = questions()[1]?.id ?? "";
    jar.clear();

    await expect(get(id)).rejects.toThrow("NEXT_REDIRECT /admin/sign-in");
    signInAs(TESTER);
    await expect(get(id)).rejects.toThrow("NEXT_REDIRECT /admin/denied");
  });
});
