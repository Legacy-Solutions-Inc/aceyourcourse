import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_COOKIE } from "@/lib/member-app/device-token";
import { addBetaTester, createTopic, moveTopic, renameTopic } from "@/services/admin.mock";
import { addTargetExam, getOrCreateMember, recordConsent } from "@/services/member.mock";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";
import { sampleUserId } from "@/services/mock/members";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { sampleActor } from "../../../test/admin-inputs";
import { onThisDevice, TEST_DEVICE_TOKEN } from "../../../test/member-inputs";

// The Library and opening an item (Phase 3, ticket 05; spec → Content model
// and Access decision seam; stories 93, 94, 103, 133i and 133m), on sample
// data: the pages as a browser would load them. The access decision's every
// outcome is in access.test.ts; the gate, consent and the Active Device in
// member-app.test.tsx and device.test.tsx. It's 17 Nov 2026, 11:42 in
// Manila. The sample CE content: MSTC has Simple Curves (a Free Preview deck,
// a quiz and a Reviewer PDF), Spiral Curves (a deck; its quiz is Hidden and
// its Reviewer PDF a Draft), Surveying (empty) and Algebra (a Hidden deck);
// HPGE has Hydrostatics (a deck and a Free Preview quiz) and two more; PSAD
// has none. The tester's CE pass ends in 90 days, the lapsed tester's ended
// 3 days ago, and the stranger has none.
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
  usePathname: () => "/app/library",
}));

const BOOT = new Date("2026-11-17T03:42:00.000Z");
const OWNER = sampleActor("owner");
const EDITOR = sampleActor("editor");

const SIMPLE_CURVES = sampleTopicId("CE", "MSTC", "Simple Curves");
const SPIRAL_CURVES = sampleTopicId("CE", "MSTC", "Spiral Curves");
const FREE_DECK = sampleContentId(SIMPLE_CURVES, "deck");
const QUIZ = sampleContentId(SIMPLE_CURVES, "quiz");
const HIDDEN_QUIZ = sampleContentId(SPIRAL_CURVES, "quiz");

const redirectsTo = (url: string) =>
  new RegExp(`^NEXT_REDIRECT ${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

/**
 * Signed in as this sample User, a Member who has agreed and has `exam` as
 * their selected Target Exam, using the Member App on this browser.
 */
async function memberOnDevice(email: string, name: string, exam = "CE") {
  const userId = sampleUserId(email);
  await getOrCreateMember({ userId, email, name });
  await recordConsent(userId, { termsVersion: "2.0", privacyVersion: "2.0" });
  await addTargetExam(userId, { examCode: exam, examDate: "2027-01-10" });
  await onThisDevice(userId);
  jar.set("ayc_admin_sample", email);
  jar.set(DEVICE_COOKIE, TEST_DEVICE_TOKEN);
}

const asTester = () => memberOnDevice("tester@example.com", "Bea Tester");
const asLapsed = () => memberOnDevice("lapsed@example.com", "Lou Lapsed");
/** The stranger once an Owner adds them to the beta: a tester with no pass. */
async function asNewTester() {
  await addBetaTester(OWNER, { email: "stranger@example.com" });
  await memberOnDevice("stranger@example.com", "Sam Stranger");
}

const library = async (subject?: string) =>
  (await import("./(shell)/library/page")).default({
    searchParams: Promise.resolve(subject ? { subject } : {}),
  });
const opening = async (kind: string, id: string) =>
  (await import("./(shell)/library/[kind]/[id]/page")).default({
    params: Promise.resolve({ kind, id }),
  });

const topics = (subject = "MSTC") => screen.getByRole("list", { name: `${subject} Topics` });
/** A Topic's row, by its name. */
const row = (name: string, subject = "MSTC") =>
  within(topics(subject))
    .getAllByRole("listitem")
    .find((item) => within(item).queryByRole("heading", { name: new RegExp(name) })) ??
  (() => {
    throw new Error(`No Topic "${name}"`);
  })();
/** A row's item links, by their visible text. */
const itemsIn = (name: string, subject = "MSTC") =>
  within(row(name, subject))
    .queryAllByRole("link")
    .filter((link) => link.getAttribute("href")?.startsWith("/app/library/"))
    .map((link) => link.textContent?.replace(/,.*$/, ""));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(BOOT);
  jar.clear();
  resetSampleStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the Library", () => {
  it("lists the selected Exam's Subjects as tabs and the first Subject's Topics in order", async () => {
    await asTester();
    render(await library());

    expect(screen.getByText("02 · LIBRARY · CE · CELE")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Subjects and topics" }),
    ).toBeInTheDocument();
    const tabs = screen.getByRole("navigation", { name: "Subjects" });
    expect(
      within(tabs)
        .getAllByRole("link")
        .map((tab) => tab.textContent),
    ).toEqual(["MSTC", "HPGE", "PSAD"]);
    expect(within(tabs).getByRole("link", { name: "MSTC" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(tabs).getByRole("link", { name: "HPGE" })).toHaveAttribute(
      "href",
      "/app/library?subject=HPGE",
    );
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Mathematics, Surveying & Transportation Engineering",
      }),
    ).toBeInTheDocument();
    expect(
      within(topics())
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(["01Simple Curves", "02Spiral Curves", "03Surveying", "04Algebra"]);
  });

  it("opens all of CE for the tester's pass, with nothing locked", async () => {
    await asTester();
    render(await library());

    expect(itemsIn("Simple Curves")).toEqual(["Flashcards", "Quiz", "Reviewer PDF"]);
    expect(within(row("Simple Curves")).getByRole("link", { name: "Quiz" })).toHaveAttribute(
      "href",
      `/app/library/quiz/${QUIZ}`,
    );
    expect(screen.queryByText(/🔒/)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /UNLOCK WITH/ })).not.toBeInTheDocument();
  });

  it("gives a tester with no pass Free Preview open and the rest locked, with how to unlock it", async () => {
    await asNewTester();
    render(await library());

    expect(itemsIn("Simple Curves")).toEqual([
      "Flashcards · FREE PREVIEW",
      "🔒Quiz",
      "🔒Reviewer PDF",
    ]);
    expect(
      within(row("Simple Curves")).getByRole("link", {
        name: "Quiz, locked: unlock with CE All-Access",
      }),
    ).toBeInTheDocument();
    expect(itemsIn("Spiral Curves")).toEqual(["🔒Flashcards"]);
    expect(
      within(row("Simple Curves")).getByRole("link", { name: /Unlock with CE All-Access$/ }),
    ).toHaveAttribute("href", "#unlock");

    const unlock = screen.getByRole("region", { name: "🔒 UNLOCK WITH CE ALL-ACCESS" });
    expect(unlock).toHaveTextContent("During the beta, access comes from AYC. Ask us at");
    const { contactEmail } = getSampleStore().catalogue.settings;
    expect(within(unlock).getByRole("link", { name: contactEmail })).toHaveAttribute(
      "href",
      `mailto:${contactEmail}`,
    );
  });

  it("opens every Visible and Published item for active Staff with no pass", async () => {
    await memberOnDevice(OWNER.email, OWNER.name);
    render(await library());

    expect(itemsIn("Simple Curves")).toEqual(["Flashcards", "Quiz", "Reviewer PDF"]);
    expect(screen.queryByText(/🔒/)).not.toBeInTheDocument();
  });

  it("locks CE for the lapsed tester, saying their access ended", async () => {
    await asLapsed();
    render(await library());

    expect(itemsIn("Simple Curves")).toEqual([
      "Flashcards · FREE PREVIEW",
      "🔒Quiz",
      "🔒Reviewer PDF",
    ]);
    expect(
      within(row("Simple Curves")).getByRole("link", {
        name: "Quiz, locked: your CE All-Access ended",
      }),
    ).toBeInTheDocument();
  });

  it("never shows Hidden or unpublished items, and says an empty Topic is still being prepared", async () => {
    await asTester();
    render(await library());

    // Spiral Curves' Hidden quiz and Draft Reviewer PDF aren't there.
    expect(itemsIn("Spiral Curves")).toEqual(["Flashcards"]);
    expect(
      within(row("Surveying")).getByText("Content for this Topic is still being prepared."),
    ).toBeInTheDocument();
    // Algebra has only a Hidden deck.
    expect(itemsIn("Algebra")).toEqual([]);
    expect(
      within(row("Algebra")).getByText("Content for this Topic is still being prepared."),
    ).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(HIDDEN_QUIZ);
  });

  it("opens on the Subject asked for", async () => {
    await asNewTester();
    render(await library("hpge"));

    expect(
      within(screen.getByRole("navigation", { name: "Subjects" })).getByRole("link", {
        name: "HPGE",
      }),
    ).toHaveAttribute("aria-current", "page");
    expect(itemsIn("Hydrostatics", "HPGE")).toEqual(["🔒Flashcards", "Quiz · FREE PREVIEW"]);
  });

  it("says a Subject with no Topics is still being prepared", async () => {
    await asTester();
    render(await library("PSAD"));

    expect(
      screen.getByText(/No Topics in PSAD yet\. Its content is still being prepared/),
    ).toBeInTheDocument();
  });

  it("follows the Topics editor's names and order", async () => {
    await asTester();
    await renameTopic(EDITOR, { id: SPIRAL_CURVES, name: "Spiral Easement Curves" });
    await moveTopic(EDITOR, SPIRAL_CURVES, "up");
    await createTopic(EDITOR, { exam: "CE", subject: "MSTC", name: "Highways" });
    render(await library());

    expect(
      within(topics())
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual([
      "01Spiral Easement Curves",
      "02Simple Curves",
      "03Surveying",
      "04Algebra",
      "05Highways",
    ]);
  });

  it("heads the Library with the selected Exam, here one with no Topics yet", async () => {
    await memberOnDevice("tester@example.com", "Bea Tester", "ME");
    render(await library());

    expect(screen.getByText("02 · LIBRARY · ME · MELE")).toBeInTheDocument();
    expect(screen.getByText(/No Topics in PIP yet/)).toBeInTheDocument();
  });

  it("sends someone signed out to sign in, coming back to the Library", async () => {
    await expect(library()).rejects.toThrow(redirectsTo("/app/sign-in?next=%2Fapp%2Flibrary"));
  });
});

describe("opening an item", () => {
  it("shows the tester's quiz as opening soon", async () => {
    await asTester();
    render(await opening("quiz", QUIZ));

    expect(screen.getByText("LIBRARY · MSTC · QUIZ")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Simple Curves" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Opening soon" })).toBeInTheDocument();
    expect(screen.getByText("OPENING SOON")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to MSTC topics" })).toHaveAttribute(
      "href",
      "/app/library?subject=MSTC",
    );
  });

  it("goes back to the Library, not a Subject, from another Exam's item than the selected one", async () => {
    // The tester studies for ME, and opens a CE quiz by its address: their CE pass opens it.
    await memberOnDevice("tester@example.com", "Bea Tester", "ME");
    render(await opening("quiz", QUIZ));

    expect(screen.getByRole("heading", { level: 2, name: "Opening soon" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the Library" })).toHaveAttribute(
      "href",
      "/app/library",
    );
  });

  it("opens a Free Preview deck for a tester with no pass: with no cards yet, it's being prepared", async () => {
    // The flashcard player itself is in flashcards.test.tsx (ticket 08).
    await asNewTester();
    render(await opening("deck", FREE_DECK));
    expect(screen.getByRole("heading", { level: 2, name: "Nothing here yet" })).toBeInTheDocument();
  });

  it("shows the unlock prompt for a locked quiz", async () => {
    await asNewTester();
    render(await opening("quiz", QUIZ));

    expect(screen.getByText("🔒 LOCKED")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Unlock with CE All-Access" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/During the beta, access comes from AYC\. Ask us at/),
    ).toBeInTheDocument();
  });

  it("tells the lapsed tester their access ended, and that their progress is kept", async () => {
    await asLapsed();
    render(await opening("quiz", QUIZ));

    expect(
      screen.getByRole("heading", { level: 2, name: "Your CE All-Access ended on 14 Nov 2026" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Your access ended\. Your progress is kept\./)).toBeInTheDocument();
  });

  it.each([
    ["the tester", asTester],
    ["active Staff", () => memberOnDevice(OWNER.email, OWNER.name)],
  ])("tells %s a Hidden quiz is no longer available", async (_who, signIn) => {
    await signIn();
    render(await opening("quiz", HIDDEN_QUIZ));

    expect(
      screen.getByRole("heading", { level: 2, name: "No longer available" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This is no longer available. Your progress is kept."),
    ).toBeInTheDocument();
  });

  it("says no longer available once content is hidden while a Member is on it", async () => {
    await asTester();
    render(await opening("quiz", QUIZ));
    expect(screen.getByRole("heading", { level: 2, name: "Opening soon" })).toBeInTheDocument();

    const store = getSampleStore();
    store.quizzes = store.quizzes.map((q) => (q.id === QUIZ ? { ...q, visibility: "hidden" } : q));
    render(await opening("quiz", QUIZ));
    expect(
      screen.getByRole("heading", { level: 2, name: "No longer available" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["an unknown id", "quiz", "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b"],
    ["an id of another kind", "quiz", FREE_DECK],
    ["a kind that isn't one", "video", QUIZ],
  ])("answers 404 for %s", async (_case, kind, id) => {
    await asTester();
    await expect(opening(kind, id)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sends a replaced device to the Active Device screen, coming back to the item", async () => {
    await asTester();
    jar.set(DEVICE_COOKIE, "a-token-from-before-the-switch");
    await expect(opening("quiz", QUIZ)).rejects.toThrow(
      redirectsTo(`/app/device?next=${encodeURIComponent(`/app/library/quiz/${QUIZ}`)}`),
    );
  });

  it("keeps a non-tester out before anything about the item is read", async () => {
    await memberOnDevice("stranger@example.com", "Sam Stranger").catch(() => undefined);
    jar.set("ayc_admin_sample", "stranger@example.com");
    await expect(opening("quiz", QUIZ)).rejects.toThrow(redirectsTo("/app/not-open-yet"));
  });
});
