import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_COOKIE, hashDeviceToken } from "@/lib/member-app/device-token";
import { createCard, createQuestion } from "@/services/admin.mock";
import {
  addTargetExam,
  claimDevice,
  getOrCreateMember,
  recordConsent,
} from "@/services/member.mock";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";
import { sampleUserId } from "@/services/mock/members";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { sampleActor } from "../../../test/admin-inputs";
import * as account from "./(shell)/account/actions";
import * as targetExams from "./(shell)/actions";
import * as study from "./(shell)/library/actions";
import * as root from "./actions";
import * as consent from "./consent/actions";
import * as device from "./device/actions";
import * as signIn from "./sign-in/actions";

// ─────────────────────────────────────────────────────────────────────────────
// The Member App's gate matrix (spec, Phase 3 → The beta gate, Consent and
// Active Device): every Member App Server Action is a public endpoint, so
// each one is listed here with who may call it, and called as a browser would
// by everyone it must refuse:
//   - "member": behind the gate, then consent, then the Active Device (the
//     Target Exam actions, the flashcard player's and the quiz screen's, and
//     Account's Privacy Requests). Signed out goes to the sign-in screen, someone the
//     gate doesn't let in goes to "Not open yet", with no Member record made,
//     a Member who hasn't agreed to the current Terms and Privacy Policy goes
//     to the consent screen, and a request that isn't from the Member's Active
//     Device (no device token, or a replaced one) goes to the Active Device
//     screen, changing nothing.
//   - "before-device": behind the gate and consent. That's the Active Device
//     screen's actions, since claiming the device is what they do.
//   - "before-consent": behind the gate only. That's the consent action alone,
//     since consent is what it gives.
//   - "anyone": signing in and out, which happen before the gate. Those are
//     refused only when the Member App is closed.
// Anyone at all gets a 404 in closed mode. A new action in any "use server"
// module under src/app/app that isn't in the registry fails the first test, so
// a later ticket's action can't skip the gate unnoticed.
// ─────────────────────────────────────────────────────────────────────────────

const { jar, mode } = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  mode: { current: "sample" as "sample" | "closed" },
}));

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
}));
vi.mock("@/lib/admin/mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/mode")>()),
  get adminMode() {
    return mode.current;
  },
}));

const STRANGER = "stranger@example.com";
const TESTER = "tester@example.com";
const SIMPLE_CURVES = sampleTopicId("CE", "MSTC", "Simple Curves");
/** Simple Curves' deck is Free Preview: every Member past the checks could study it. */
const FREE_DECK = sampleContentId(SIMPLE_CURVES, "deck");
/** A card in it, written for each test, that the player's actions would mark. */
let freeCard = "";
/** Hydrostatics' quiz is Free Preview: every Member past the checks could take it. */
const FREE_QUIZ = sampleContentId(sampleTopicId("CE", "HPGE", "Hydrostatics"), "quiz");
/** A question in it, written for each test, that the quiz screen's Submit would answer. */
let freeQuestion = "";
/** Simple Curves' Reviewer PDF is Published: the tester's CE pass would open it in the reader. */
const PUBLISHED_PDF = sampleContentId(SIMPLE_CURVES, "reviewer-pdf");

interface Entry {
  who: "member" | "before-device" | "before-consent" | "anyone";
  /** Calls the action with an input it would accept. */
  call: () => Promise<unknown>;
}
const anyone = (call: Entry["call"]): Entry => ({ who: "anyone", call });
const beforeConsent = (call: Entry["call"]): Entry => ({ who: "before-consent", call });
const beforeDevice = (call: Entry["call"]): Entry => ({ who: "before-device", call });
const member = (call: Entry["call"]): Entry => ({ who: "member", call });

/** A Target Exam form, as onboarding, the add form, Account and the switcher send it. */
function examForm(examDate?: string) {
  const data = new FormData();
  data.set("examCode", "CE");
  if (examDate) data.set("examDate", examDate);
  return data;
}

/** "Delete my account", confirmed as Account asks. */
function deletionForm() {
  const data = new FormData();
  data.set("confirmation", "DELETE");
  return data;
}

/** Both boxes ticked, with versions the consent screen could have shown. */
function consentForm() {
  const data = new FormData();
  for (const name of ["terms", "privacy"]) data.set(name, "agreed");
  data.set("termsVersion", "2.0");
  data.set("privacyVersion", "2.0");
  data.set("next", "/app");
  return data;
}

/** The Active Device screen's form: where to go once this device is active. */
function deviceForm() {
  const data = new FormData();
  data.set("next", "/app/account");
  return data;
}

function signInForm(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

/** This folder: every actions.ts under it holds Member App Server Actions. */
const APP_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Every exported Member App Server Action, by its module, relative to this folder. */
const REGISTRY: Record<string, Record<string, Entry>> = {
  "./(shell)/library/actions.ts": {
    markStudyCard: member(() =>
      study.markStudyCard({
        deckId: FREE_DECK,
        cardId: freeCard,
        verdict: "got",
        position: { cardId: null },
      }),
    ),
    saveStudyPosition: member(() =>
      study.saveStudyPosition({ deckId: FREE_DECK, cardId: freeCard }),
    ),
    saveReadingPosition: member(() =>
      study.saveReadingPosition({ reviewerPdfId: PUBLISHED_PDF, page: 1, zoom: 100 }),
    ),
    submitQuizAttempt: member(() =>
      study.submitQuizAttempt({
        attemptId: "6a1f0e1c-5b55-4a51-9d0e-0a1b2c3d4e5f",
        quizId: FREE_QUIZ,
        answers: [{ questionId: freeQuestion, choice: "A" }],
      }),
    ),
  },
  "./(shell)/account/actions.ts": {
    requestDataCopy: member(() => account.requestDataCopy()),
    requestDeletion: member(() => account.requestDeletion({ error: null }, deletionForm())),
  },
  "./(shell)/actions.ts": {
    addExam: member(() => targetExams.addExam({ error: null }, examForm("2099-04-18"))),
    changeExamDate: member(() =>
      targetExams.changeExamDate({ error: null, saved: false }, examForm("2099-04-18")),
    ),
    removeExam: member(() => targetExams.removeExam({ error: null }, examForm())),
    switchExam: member(() => targetExams.switchExam(examForm())),
    // An in-app notice (ticket 17): no notice of theirs has this id, so nothing changes.
    dismissMemberNotice: member(() =>
      targetExams.dismissMemberNotice("6a0c8f8e-3f43-4c4a-9d5e-0b2f6c1d7e01"),
    ),
  },
  "./actions.ts": {
    signOut: anyone(() => root.signOut()),
  },
  "./consent/actions.ts": {
    agreeAndContinue: beforeConsent(() => consent.agreeAndContinue({ error: null }, consentForm())),
  },
  "./device/actions.ts": {
    confirmThisDevice: beforeDevice(() => device.confirmThisDevice(deviceForm())),
    signInOnThisDevice: beforeDevice(() => device.signInOnThisDevice(deviceForm())),
  },
  "./sign-in/actions.ts": {
    signInAs: anyone(() => signIn.signInAs({ error: null, email: "" }, signInForm(STRANGER))),
    // Live mode only: sample mode answers 404.
    continueWithGoogle: anyone(() => signIn.continueWithGoogle(new FormData())),
  },
};

const ENTRIES = Object.entries(REGISTRY).flatMap(([module, actions]) =>
  Object.entries(actions).map(([name, entry]) => ({ module, name, ...entry })),
);
const GATED = ENTRIES.filter((entry) => entry.who !== "anyone");
const AFTER_CONSENT = ENTRIES.filter(
  (entry) => entry.who === "member" || entry.who === "before-device",
);
const MEMBER_ONLY = ENTRIES.filter((entry) => entry.who === "member");

/** The tester, a Member who has agreed to the current versions, with ME as a Target Exam. */
async function agreedTester() {
  const userId = sampleUserId(TESTER);
  await getOrCreateMember({ userId, email: TESTER, name: "Bea Tester" });
  await recordConsent(userId, { termsVersion: "2.0", privacyVersion: "2.0" });
  await addTargetExam(userId, { examCode: "ME", examDate: "2099-02-08" });
  jar.set("ayc_admin_sample", TESTER);
  return userId;
}

/** What the Member App's actions could change, to check a refusal changed none of it. */
const memberData = () => {
  const { members, memberConsents, memberTargetExams, selectedExams } = getSampleStore();
  const { memberActiveDevices, memberDeviceSwitches } = getSampleStore();
  const { cardMarks, studyDays, deckPositions, quizAttempts } = getSampleStore();
  const { reviewerPageViews, readerPositions, privacyRequests } = getSampleStore();
  return structuredClone({
    members,
    memberConsents,
    memberTargetExams,
    selectedExams,
    memberActiveDevices,
    memberDeviceSwitches,
    cardMarks,
    studyDays,
    deckPositions,
    quizAttempts,
    reviewerPageViews,
    readerPositions,
    privacyRequests,
  });
};

/** The "use server" modules under this folder, and what each exports. */
function serverActionModules(): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const file of readdirSync(APP_DIR, { recursive: true, encoding: "utf8" })) {
    if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
    const source = readFileSync(path.join(APP_DIR, file), "utf8");
    if (!/^\s*["']use server["'];?/.test(source)) continue;
    const names = [...source.matchAll(/^export (?:async function|const) (\w+)/gm)].map(
      (match) => match[1] ?? "",
    );
    found[`./${file.split(path.sep).join("/")}`] = names.sort();
  }
  return found;
}

beforeEach(async () => {
  jar.clear();
  mode.current = "sample";
  resetSampleStore();
  const added = await createCard(sampleActor("editor"), {
    topic: SIMPLE_CURVES,
    front: "Tangent distance",
    back: "$T = R \\tan(I/2)$",
  });
  if (!added.ok) throw new Error("The card wasn't written");
  freeCard = added.value.id;
  const question = await createQuestion(sampleActor("editor"), {
    topic: sampleTopicId("CE", "HPGE", "Hydrostatics"),
    question: "Pressure at a depth h?",
    choices: { A: "$\\rho g h$", B: "$\\rho h$", C: "$g h$", D: "$\\rho g$" },
    correct: "A",
    explanation: "Hydrostatic pressure.",
    figure: null,
  });
  if (!question.ok) throw new Error("The question wasn't written");
  freeQuestion = question.value.id;
});

describe("the Member App's Server Actions and the gate", () => {
  it("lists every Server Action under src/app/app, each with who may call it", () => {
    const listed = Object.fromEntries(
      Object.entries(REGISTRY).map(([module, actions]) => [module, Object.keys(actions).sort()]),
    );
    expect(serverActionModules()).toEqual(listed);
  });

  it.each(ENTRIES)("$name answers 404 in closed mode", async ({ call }) => {
    mode.current = "closed";
    jar.set("ayc_admin_sample", "tester@example.com");
    await expect(call()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getSampleStore().members).toEqual([]);
    expect(getSampleStore().memberConsents).toEqual([]);
  });

  it.each(ENTRIES.filter((entry) => entry.who === "anyone"))(
    "$name, open to anyone, makes no Member record",
    async ({ call }) => {
      await call().catch(() => {});
      expect(getSampleStore().members).toEqual([]);
    },
  );

  it.each(GATED)("$name sends a signed-out visitor to the sign-in screen", async ({ call }) => {
    await expect(call()).rejects.toThrow(/^NEXT_REDIRECT \/app\/sign-in/);
    expect(getSampleStore().memberConsents).toEqual([]);
  });

  it.each(GATED)(
    "$name refuses someone the gate doesn't let in, and makes no Member or consent record",
    async ({ call }) => {
      jar.set("ayc_admin_sample", STRANGER);
      await expect(call()).rejects.toThrow(/^NEXT_REDIRECT \/app\/not-open-yet$/);
      expect(getSampleStore().members).toEqual([]);
      expect(getSampleStore().memberConsents).toEqual([]);
    },
  );

  it.each(AFTER_CONSENT)(
    "$name sends a Member who hasn't agreed to the current Terms and Privacy Policy to the consent screen, and changes nothing",
    async ({ call }) => {
      jar.set("ayc_admin_sample", TESTER);
      await expect(call()).rejects.toThrow(/^NEXT_REDIRECT \/app\/consent\?next=/);
      expect(getSampleStore().memberConsents).toEqual([]);
      expect(getSampleStore().memberTargetExams).toEqual({});
      expect(getSampleStore().memberDeviceSwitches).toEqual([]);
    },
  );

  it.each(MEMBER_ONLY)(
    "$name sends an agreed Member with no device token (signed in through the Admin) to the Active Device screen, and changes nothing",
    async ({ call }) => {
      await agreedTester();
      const before = memberData();
      await expect(call()).rejects.toThrow(/^NEXT_REDIRECT \/app\/device\?next=/);
      expect(memberData()).toEqual(before);
    },
  );

  it.each(MEMBER_ONLY)(
    "$name refuses a replaced device's post, and changes nothing",
    async ({ call }) => {
      const userId = await agreedTester();
      await claimDevice(userId, {
        tokenHash: hashDeviceToken("the-other-device"),
        deviceLabel: "Chrome on Android",
      });
      jar.set(DEVICE_COOKIE, "this-device");
      const before = memberData();
      await expect(call()).rejects.toThrow(/^NEXT_REDIRECT \/app\/device\?next=/);
      expect(memberData()).toEqual(before);
    },
  );

  it.each(GATED)("$name gives nobody the gate refuses a Privacy Request", async ({ call }) => {
    jar.set("ayc_admin_sample", STRANGER);
    await call().catch(() => {});
    expect(getSampleStore().privacyRequests).toEqual([]);
  });

  it.each(AFTER_CONSENT)(
    "$name makes no Privacy Request for a Member who hasn't agreed to the current Terms",
    async ({ call }) => {
      jar.set("ayc_admin_sample", TESTER);
      await call().catch(() => {});
      expect(getSampleStore().privacyRequests).toEqual([]);
    },
  );

  it.each(GATED)("$name gives nobody the gate refuses a Target Exam", async ({ call }) => {
    jar.set("ayc_admin_sample", STRANGER);
    await call().catch(() => {});
    expect(getSampleStore().memberTargetExams).toEqual({});
    expect(getSampleStore().selectedExams).toEqual({});
  });

  it.each(ENTRIES)("$name gives nobody the gate refuses a device token", async ({ call }) => {
    jar.set("ayc_admin_sample", STRANGER);
    await call().catch(() => {});
    // Sign-out empties the cookie; nothing ever puts a token in it here.
    expect(jar.get(DEVICE_COOKIE) ?? "").toBe("");
    expect(getSampleStore().memberDeviceSwitches).toEqual([]);
  });
});
