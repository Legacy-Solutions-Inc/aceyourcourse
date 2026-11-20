import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MemberAccess } from "@/lib/member-app/access";
import { DEVICE_COOKIE } from "@/lib/member-app/device-token";
import {
  createCard,
  createQuestion,
  placeReviewerPdf,
  recordReviewerPdf,
  runReviewerPdfJob,
  setReviewerPdfPublished,
} from "@/services/admin.mock";
import {
  addTargetExam,
  getOrCreateMember,
  listAccessPasses,
  markCard,
  readReviewerPage,
  recordConsent,
  saveDeckPosition,
  saveReaderPosition,
  submitQuiz,
} from "@/services/member.mock";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";
import { sampleUserId } from "@/services/mock/members";
import { resetSampleStore } from "@/services/mock/sample-store";
import { createFakeRenderer, fakeStamper } from "@/services/page-images.fake";

import { sampleActor } from "../../../test/admin-inputs";
import { onThisDevice, TEST_DEVICE_TOKEN } from "../../../test/member-inputs";
import { uploadSampleReviewerPdf } from "../../../test/reviewer-pdf-uploads";
import { pdfOfPages } from "../../../test/reviewer-pdfs";

// Home's dashboard on sample data (Phase 3, ticket 15; stories 88–92), as a
// browser loads it: the gate, consent and the Active Device first, then the
// Member's own progress in their selected Target Exam, read through the
// Member seam, with the sidebar's streak button from the shell. The
// numbers' rules are progress.test.ts's; the dashboard's every state is
// dashboard.test.tsx's. It's 17 Nov 2026, 11:42 in Manila. The sample CE
// content: MSTC's Simple Curves has a Visible quiz, Spiral Curves a Visible
// deck, Surveying nothing until an Editor places a Reviewer PDF there. The
// tester's CE pass ends in 90 days; the lapsed tester's ended 3 days ago.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/app",
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}));

const BOOT = new Date("2026-11-17T03:42:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const EDITOR = sampleActor("editor");
const TESTER = "tester@example.com";
const LAPSED = "lapsed@example.com";

const SIMPLE_CURVES = sampleTopicId("CE", "MSTC", "Simple Curves");
const SPIRAL_CURVES = sampleTopicId("CE", "MSTC", "Spiral Curves");
const SURVEYING = sampleTopicId("CE", "MSTC", "Surveying");
const SPIRAL_DECK = sampleContentId(SPIRAL_CURVES, "deck");
const QUIZ = sampleContentId(SIMPLE_CURVES, "quiz");

/** Signed in as this sample User, agreed, with CE as their Target Exam, on this browser. */
async function memberOnDevice(email: string, name: string) {
  const userId = sampleUserId(email);
  await getOrCreateMember({ userId, email, name });
  await recordConsent(userId, { termsVersion: "2.0", privacyVersion: "2.0" });
  await addTargetExam(userId, { examCode: "CE", examDate: "2027-01-10" });
  await onThisDevice(userId);
  jar.set("ayc_admin_sample", email);
  jar.set(DEVICE_COOKIE, TEST_DEVICE_TOKEN);
  return userId;
}

/** A Member's side of the access decision now, as the server gathers it. */
async function accessOf(userId: string): Promise<MemberAccess> {
  return {
    gate: "open",
    device: "active",
    activeStaff: false,
    passes: await listAccessPasses(userId),
    now: new Date(),
  };
}

/**
 * The tester's study in progress, through the seam as the Member App writes
 * it: 3 of Spiral Curves' 4 cards Got it and 1 Review again, stopped at card
 * 3; 1 of Simple Curves' 2 questions right; Surveying's pages 1 and 2 read,
 * stopped at page 2.
 */
async function testerStudies(userId: string) {
  const cards = [];
  for (const front of ["One", "Two", "Three", "Four"]) {
    const added = await createCard(EDITOR, { topic: SPIRAL_CURVES, front, back: "x", note: "" });
    if (!added.ok) throw new Error("Card not added");
    cards.push(added.value);
  }
  const questions = [];
  for (const question of ["First", "Second"]) {
    const added = await createQuestion(EDITOR, {
      topic: SIMPLE_CURVES,
      question,
      choices: { A: "Right", B: "Wrong", C: "No", D: "Nope" },
      correct: "A",
      explanation: "Because.",
      figure: null,
    });
    if (!added.ok) throw new Error("Question not added");
    questions.push(added.value);
  }
  const path = await uploadSampleReviewerPdf(pdfOfPages(4));
  const recorded = await recordReviewerPdf(EDITOR, { path, fileName: "Surveying.pdf" });
  if (!recorded.ok) throw new Error("Reviewer PDF not recorded");
  const reviewer = recorded.value.id;
  while ((await runReviewerPdfJob(reviewer, createFakeRenderer())) === "more");
  await placeReviewerPdf(EDITOR, { id: reviewer, topic: SURVEYING });
  await setReviewerPdfPublished(EDITOR, reviewer, true);

  const access = await accessOf(userId);
  for (const [index, verdict] of (["got", "got", "again", "got"] as const).entries()) {
    await markCard(userId, { cardId: cards[index]?.id ?? "", verdict }, access);
  }
  await saveDeckPosition(userId, { deckId: SPIRAL_DECK, cardId: cards[2]?.id ?? null }, access);
  await submitQuiz(
    userId,
    {
      attemptId: "6a1f0e1c-5b55-4a51-9d0e-000000000001",
      quizId: QUIZ,
      answers: questions.map((question, index) => ({
        questionId: question.id,
        choice: index === 0 ? "A" : "B",
      })),
    },
    access,
  );
  for (const page of [1, 2]) {
    await readReviewerPage(userId, { reviewerPdfId: reviewer, page }, access, fakeStamper);
  }
  await saveReaderPosition(userId, { reviewerPdfId: reviewer, page: 2, zoom: 100 }, access);
  return { reviewer };
}

const home = async () =>
  (await import("./(shell)/(home)/page")).default({ searchParams: Promise.resolve({}) });
const shell = async () => (await import("./(shell)/layout")).default({ children: await home() });
const region = (name: string) => screen.getByRole("region", { name });
const homeLayout = async () =>
  (await import("./(shell)/(home)/layout")).default({ children: <p>Home itself</p> });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(BOOT);
  jar.clear();
  resetSampleStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Home's route group", () => {
  it("stops someone signed out, or who hasn't agreed, before Home's skeleton streams", async () => {
    await expect(homeLayout()).rejects.toThrow("NEXT_REDIRECT /app/sign-in?next=%2Fapp");

    const userId = sampleUserId(TESTER);
    await getOrCreateMember({ userId, email: TESTER, name: "Bea Tester" });
    jar.set("ayc_admin_sample", TESTER);
    await expect(homeLayout()).rejects.toThrow("NEXT_REDIRECT /app/consent?next=%2Fapp");
  });

  it("shows the dashboard's skeleton while Home loads", async () => {
    const { default: HomeLoading } = await import("./(shell)/(home)/loading");

    render(<HomeLoading />);

    expect(screen.getByRole("main")).toHaveTextContent("01 · HOME");
    expect(screen.getByRole("status")).toHaveTextContent("LOADING YOUR DASHBOARD…");
  });

  it("lets a Member who passes the checks through to Home", async () => {
    await memberOnDevice(TESTER, "Bea Tester");

    render(await homeLayout());

    expect(screen.getByText("Home itself")).toBeInTheDocument();
  });
});

describe("Home's dashboard", () => {
  it("shows the countdown, streak, Subject %, quiz average and weak Topics of a Member's study", async () => {
    const { reviewer } = await testerStudies(await memberOnDevice(TESTER, "Bea Tester"));

    render(await shell());

    expect(region("CELE board exam countdown")).toHaveTextContent("54days to go");
    expect(region("Study streak")).toHaveTextContent("1day in a row");
    expect(region("Study streak")).toHaveTextContent(
      "You studied today. Come back tomorrow to make it 2. That’s your best yet.",
    );
    // The sidebar's streak button says the same streak.
    expect(screen.getByRole("link", { name: "1-DAY STREAK DONE TODAY" })).toHaveAttribute(
      "href",
      "/app",
    );

    const subjects = region("Progress by subject");
    expect(subjects).toHaveTextContent("3 / 4 CARDS GOT IT · 50% QUIZ AVG");
    // Simple Curves 50, Spiral Curves 75, Surveying 50.
    expect(within(subjects).getByRole("link", { name: /MSTC/ })).toHaveTextContent(
      "58%MSTCMathematics, Surveying & Transportation Engineering3 / 4 cards got it · 50% quiz avg · 2 / 4 pages read",
    );

    const weak = within(region("Weak topics to review")).getAllByRole("listitem");
    expect(weak).toHaveLength(1);
    expect(weak[0]).toHaveTextContent(/Simple Curves.*BEST SCORE 50% · PASSING 70%/);

    const resume = within(region("Continue where you left off")).getAllByRole("link");
    expect(resume.map((link) => link.getAttribute("href"))).toEqual([
      `/app/library/deck/${SPIRAL_DECK}`,
      `/app/library/reviewer-pdf/${reviewer}`,
    ]);
    expect(resume[0]).toHaveTextContent("CARD 3 OF 4");
    expect(resume[1]).toHaveTextContent("PAGE 2 OF 4");
  });

  it("gives a Member who hasn't studied the starter state, not zeros", async () => {
    await memberOnDevice(TESTER, "Bea Tester");

    render(await shell());

    expect(region("Start studying CE")).toBeInTheDocument();
    expect(region("Study streak")).toHaveTextContent("No streak yet");
    expect(screen.getByRole("link", { name: "START A STREAK STUDY TODAY" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Progress by subject" })).toBeNull();
  });

  it("switches with the selected Target Exam, keeping the account-wide streak", async () => {
    const userId = await memberOnDevice(TESTER, "Bea Tester");
    await testerStudies(userId);
    await addTargetExam(userId, { examCode: "ME", examDate: "2027-02-08" });

    render(await home());

    expect(region("Start studying ME")).toBeInTheDocument();
    expect(region("Study streak")).toHaveTextContent("1day in a row");
  });

  it("keeps a Member's progress visible once their access has ended", async () => {
    await testerStudies(await memberOnDevice(TESTER, "Bea Tester"));
    vi.setSystemTime(new Date(BOOT.getTime() + 100 * DAY));

    render(await home());

    expect(
      within(region("Progress by subject")).getByRole("link", { name: /MSTC/ }),
    ).toHaveTextContent(/^58%/);
    expect(within(region("Continue where you left off")).getAllByRole("link")).toHaveLength(2);
    // The streak lapsed, the best is kept.
    expect(region("Study streak")).toHaveTextContent("Your best is 1 day.");
  });

  it("never shows one Member another's progress", async () => {
    await testerStudies(await memberOnDevice(TESTER, "Bea Tester"));
    await memberOnDevice(LAPSED, "Lou Lapsed");

    render(await home());

    expect(region("Start studying CE")).toBeInTheDocument();
    expect(region("Study streak")).toHaveTextContent("No streak yet");
  });
});
