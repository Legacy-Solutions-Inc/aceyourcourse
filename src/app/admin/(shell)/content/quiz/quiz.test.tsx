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
  checkQuizImport,
  createImportUpload,
  importQuizzes,
  saveQuizFreePreview,
  saveQuizSettings,
  saveQuizVisibility,
} from "../actions";
import { GET as questionFigure } from "./figure/[question]/route";
import QuizPage from "./page";

// Member App content → a Topic's quiz (Phase 3, ticket 09; stories 126–128),
// on sample data: the page as a browser loads it, its Server Actions as a
// browser sends them, and the Staff-only figure route. Every Admin action's
// refusals for signed-out visitors, non-Staff and closed mode are also in
// actions.permissions.test.ts; the seam's rules in admin.quiz.test.ts.
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

/** The quiz's settings as the page would open them. */
const openedStamp = () => ({ savedAt: getSampleStore().bootedAt });

beforeEach(() => {
  jar.clear();
  resetSampleStore();
});

describe("the quiz page", () => {
  it("opens an Editor on a Topic's quiz: its state, settings and questions, with the correct choices marked", async () => {
    signInAs(EDITOR);
    await withQuestions();
    await renderPage({ topic: SPIRAL_CURVES });

    expect(screen.getByRole("heading", { level: 2, name: "Spiral Curves quiz" })).toBeVisible();
    expect(screen.getByText("CE · MSTC · 2 QUESTIONS · HIDDEN")).toBeInTheDocument();
    expect(screen.getByLabelText(/PASSING SCORE/)).toHaveValue("70");
    expect(screen.getByRole("switch", { name: "Shuffle questions" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Show answers after" })).toBeChecked();
    const questions = within(screen.getByRole("list", { name: "Questions in Spiral Curves" }));
    expect(questions.getByRole("img", { name: "Figure for question 2" })).toHaveAttribute(
      "src",
      expect.stringMatching(/^\/admin\/content\/quiz\/figure\/[0-9a-f-]+$/),
    );
    const choices = within(screen.getByRole("list", { name: "Choices for question 1" }));
    expect(choices.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "A1 m",
      "B2 m✓ CORRECT",
      "C3 m",
      "D4 m",
    ]);
    expect(screen.getByRole("link", { name: "← MSTC Topics" })).toHaveAttribute(
      "href",
      "/admin/content?exam=ce&subject=mstc",
    );
  });

  it("points a Topic with no quiz to the quiz import", async () => {
    signInAs(EDITOR);
    await renderPage({ topic: SURVEYING });

    expect(screen.getByText("CE · MSTC · 0 QUESTIONS · NO QUIZ YET")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Import MSTC’s questions from a spreadsheet" }),
    ).toHaveAttribute("href", "/admin/content/import?exam=ce&subject=mstc&kind=quizzes");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
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

  it("refuses every quiz action from a Member, changing nothing", async () => {
    await getOrCreateMember({ userId: sampleUserId(TESTER), email: TESTER, name: "Bea Tester" });
    signInAs(TESTER);
    const before = JSON.stringify(getSampleStore().quizzes);

    for (const post of [
      () =>
        saveQuizSettings(IDLE, {
          input: { id: SPIRAL_CURVES_QUIZ, passingScore: "1", shuffle: false, showAnswers: false },
          expected: openedStamp(),
        }),
      () => saveQuizVisibility(IDLE, { input: { quiz: SPIRAL_CURVES_QUIZ, visible: false } }),
      () => saveQuizFreePreview(IDLE, { input: { quiz: SPIRAL_CURVES_QUIZ, freePreview: true } }),
    ]) {
      await expect(post()).rejects.toThrow("NEXT_REDIRECT /admin/denied");
    }
    expect(JSON.stringify(getSampleStore().quizzes)).toBe(before);
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
