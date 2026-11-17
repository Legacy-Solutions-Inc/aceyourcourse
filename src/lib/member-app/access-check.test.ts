import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_COOKIE } from "@/lib/member-app/device-token";
import { addBetaTester, removeStaff } from "@/services/admin.mock";
import { getOrCreateMember } from "@/services/member.mock";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";
import { sampleUserId } from "@/services/mock/members";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { sampleActor } from "../../../test/admin-inputs";
import { onThisDevice, TEST_DEVICE_TOKEN } from "../../../test/member-inputs";

import { checkContentAccess } from "./access-check";

// The access decision on the server (spec, Phase 3 → Access decision seam),
// on sample data: who is signed in, the gate, the staff list, this request's
// device token and the Member's own passes, read for each check. The pure
// rule's every outcome and its order are in access.test.ts; this checks the
// inputs are gathered from the right places. It's 17 Nov 2026, 11:42 in
// Manila. The tester's CE pass ends 90 days after; the lapsed tester's ended
// 3 days before; the stranger isn't a Beta Tester and has no pass.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));

const BOOT = new Date("2026-11-17T03:42:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const OWNER = sampleActor("owner");
const EDITOR = sampleActor("editor");

const SIMPLE_CURVES = sampleTopicId("CE", "MSTC", "Simple Curves");
const SPIRAL_CURVES = sampleTopicId("CE", "MSTC", "Spiral Curves");
/** Simple Curves' deck is Free Preview; its quiz isn't. Spiral Curves' quiz is Hidden. */
const FREE_DECK = sampleContentId(SIMPLE_CURVES, "deck");
const LOCKED_QUIZ = sampleContentId(SIMPLE_CURVES, "quiz");
const HIDDEN_QUIZ = sampleContentId(SPIRAL_CURVES, "quiz");

/** Signed in as this sample User, a Member using the Member App on this browser (their Active Device). */
async function onDevice(email: string, name: string) {
  const userId = sampleUserId(email);
  await getOrCreateMember({ userId, email, name });
  await onThisDevice(userId);
  jar.set("ayc_admin_sample", email);
  jar.set(DEVICE_COOKIE, TEST_DEVICE_TOKEN);
  return userId;
}

const decisionOf = async (kind: "deck" | "quiz", id: string) => {
  const access = await checkContentAccess(kind, id);
  return access.status === "decided" ? access.decision : access;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(BOOT);
  jar.clear();
  resetSampleStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkContentAccess", () => {
  it("opens the tester's CE content with their pass, and gives the item as it is", async () => {
    await onDevice("tester@example.com", "Bea Tester");

    expect(await checkContentAccess("quiz", LOCKED_QUIZ)).toEqual({
      status: "decided",
      item: expect.objectContaining({ kind: "quiz", examCode: "CE", topicName: "Simple Curves" }),
      decision: { outcome: "allowed", via: "pass" },
    });
  });

  it("tells the tester a Hidden quiz is no longer available", async () => {
    await onDevice("tester@example.com", "Bea Tester");
    expect(await decisionOf("quiz", HIDDEN_QUIZ)).toEqual({ outcome: "unavailable" });
  });

  it("expires the tester's pass from the instant it ends", async () => {
    await onDevice("tester@example.com", "Bea Tester");
    const ends = BOOT.getTime() + 90 * DAY;

    vi.setSystemTime(ends - 1);
    expect(await decisionOf("quiz", LOCKED_QUIZ)).toEqual({ outcome: "allowed", via: "pass" });
    vi.setSystemTime(ends);
    expect(await decisionOf("quiz", LOCKED_QUIZ)).toEqual({
      outcome: "expired",
      passEndedAt: new Date(ends).toISOString(),
    });
  });

  it("says the lapsed tester's pass expired, rather than locked, and still opens Free Preview", async () => {
    await onDevice("lapsed@example.com", "Lou Lapsed");

    expect(await decisionOf("quiz", LOCKED_QUIZ)).toEqual({
      outcome: "expired",
      passEndedAt: new Date(BOOT.getTime() - 3 * DAY).toISOString(),
    });
    expect(await decisionOf("deck", FREE_DECK)).toEqual({
      outcome: "allowed",
      via: "free-preview",
    });
  });

  it("keeps the gate closed for someone who isn't a Beta Tester", async () => {
    await onDevice("stranger@example.com", "Sam Stranger");
    expect(await decisionOf("deck", FREE_DECK)).toEqual({ outcome: "not-open-yet" });
  });

  it("gives a new tester with no pass Free Preview, and locks the rest", async () => {
    await addBetaTester(OWNER, { email: "stranger@example.com" });
    await onDevice("stranger@example.com", "Sam Stranger");

    expect(await decisionOf("deck", FREE_DECK)).toEqual({
      outcome: "allowed",
      via: "free-preview",
    });
    expect(await decisionOf("quiz", LOCKED_QUIZ)).toEqual({ outcome: "locked" });
  });

  it("locks CE content for a Member whose pass is for another Exam", async () => {
    await addBetaTester(OWNER, { email: "stranger@example.com" });
    const userId = await onDevice("stranger@example.com", "Sam Stranger");
    getSampleStore().accessPasses.push({
      userId,
      examCode: "ME",
      endsAt: new Date(BOOT.getTime() + 30 * DAY).toISOString(),
    });

    expect(await decisionOf("quiz", LOCKED_QUIZ)).toEqual({ outcome: "locked" });
  });

  it("opens Visible content for active Staff with no pass, but never Hidden content", async () => {
    await onDevice(OWNER.email, OWNER.name);

    expect(await decisionOf("quiz", LOCKED_QUIZ)).toEqual({ outcome: "allowed", via: "staff" });
    expect(await decisionOf("quiz", HIDDEN_QUIZ)).toEqual({ outcome: "unavailable" });
  });

  it("treats a removed Staff User as a Member from their next request", async () => {
    await addBetaTester(OWNER, { email: EDITOR.email });
    await onDevice(EDITOR.email, EDITOR.name);
    expect(await decisionOf("quiz", LOCKED_QUIZ)).toEqual({ outcome: "allowed", via: "staff" });

    expect(await removeStaff(OWNER, EDITOR.email)).toMatchObject({ ok: true });
    expect(await decisionOf("quiz", LOCKED_QUIZ)).toEqual({ outcome: "locked" });
  });

  it("sends a request with no device token to claim this device", async () => {
    await onDevice("tester@example.com", "Bea Tester");
    jar.delete(DEVICE_COOKIE);
    expect(await decisionOf("deck", FREE_DECK)).toEqual({ outcome: "no-token" });
  });

  it("ends the session on a device another one replaced", async () => {
    await onDevice("tester@example.com", "Bea Tester");
    jar.set(DEVICE_COOKIE, "a-token-from-before-the-switch");
    expect(await decisionOf("quiz", LOCKED_QUIZ)).toEqual({ outcome: "device-replaced" });
  });

  it("says when nobody is signed in", async () => {
    expect(await checkContentAccess("deck", FREE_DECK)).toEqual({ status: "signed-out" });
  });

  it.each([
    ["an unknown id", "deck", "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b"],
    ["an id that isn't one", "deck", "../../etc"],
    ["a kind that isn't one", "video", FREE_DECK],
  ])("finds nothing for %s", async (_case, kind, id) => {
    await onDevice("tester@example.com", "Bea Tester");
    expect(await checkContentAccess(kind as "deck", id)).toEqual({ status: "not-found" });
  });
});
