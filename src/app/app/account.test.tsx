import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_COOKIE } from "@/lib/member-app/device-token";
import { listPrivacyRequests } from "@/services/admin.mock";
import {
  addTargetExam,
  getOrCreateMember,
  recordConsent,
  requestPrivacy,
} from "@/services/member.mock";
import { sampleUserId } from "@/services/mock/members";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { sampleActor } from "../../../test/admin-inputs";
import { editSampleCatalogue } from "../../../test/catalogue-seed";
import { AGREED_TO_CURRENT, onThisDevice, TEST_DEVICE_TOKEN } from "../../../test/member-inputs";

// Account and Support in the Member App (Phase 3, ticket 18; stories 110–113),
// on sample data: the pages as a browser would load them, and Account's
// Privacy Request actions as it would send them. The gate, consent and the
// Active Device for each are in member-app.test.tsx and actions.gate.test.ts;
// Account's "Your exams" is in target-exams.test.tsx.
//
// "Now" is 19 Nov 2026, 10:00 in Manila.
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
  usePathname: () => "/app/account",
}));

const BOOT = new Date("2026-11-19T02:00:00.000Z");
const OWNER = sampleActor("owner");
const BEA = "tester@example.com";
const BEA_ID = sampleUserId(BEA);
const LOU = "lapsed@example.com";
const LOU_ID = sampleUserId(LOU);

/** Signed in, on the browser that is the Member's Active Device (see agreedAs). */
const signedInAs = (email: string) => {
  jar.set("ayc_admin_sample", email);
  jar.set(DEVICE_COOKIE, TEST_DEVICE_TOKEN);
};

/**
 * A sample User who is a Member, has agreed to the current versions and has
 * ME as their Target Exam, using the Member App on the test browser.
 */
async function agreedAs(email: string, name: string) {
  const userId = sampleUserId(email);
  await getOrCreateMember({ userId, email, name });
  await recordConsent(userId, AGREED_TO_CURRENT);
  await addTargetExam(userId, { examCode: "ME", examDate: "2099-02-08" });
  await onThisDevice(userId);
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const account = async () => (await import("./(shell)/account/page")).default();
const support = async () => (await import("./(shell)/support/page")).default();
const actions = () => import("./(shell)/account/actions");
const stored = () => getSampleStore().privacyRequests;
const ownersList = async () => {
  const result = await listPrivacyRequests(OWNER);
  if (!result.ok) throw new Error("The list refused an Owner");
  return result.value;
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(BOOT);
  jar.clear();
  resetSampleStore();
  await agreedAs(BEA, "Bea Tester");
  signedInAs(BEA);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Account", () => {
  it("shows the Member's profile from Google, their exams, what they agreed to, and Sign out", async () => {
    render(await account());

    expect(screen.getByRole("heading", { level: 1, name: "Account" })).toBeInTheDocument();
    const profile = screen.getByRole("region", { name: "Profile" });
    expect(within(profile).getByText("Bea Tester")).toBeInTheDocument();
    expect(within(profile).getByText(`${BEA} · Google`)).toBeInTheDocument();
    expect(
      within(profile).getByText("Signed in on this device only · Chrome on Android"),
    ).toBeInTheDocument();
    expect(within(profile).getByRole("button", { name: "Sign out" })).toBeInTheDocument();

    expect(screen.getByRole("region", { name: "Your exams" })).toHaveTextContent(
      "Mechanical Engineering",
    );
    const privacy = screen.getByRole("region", { name: "Privacy" });
    expect(
      within(privacy).getByText("You agreed to Terms v2.2 and Privacy v2.1 on 19 Nov 2026."),
    ).toBeInTheDocument();
    expect(
      within(privacy).getByRole("button", { name: "Request a copy of my data" }),
    ).toBeInTheDocument();
    expect(within(privacy).getByRole("button", { name: "Delete my account" })).toBeInTheDocument();
  });

  it("shows a Member with no Google name their email as their name", async () => {
    await getOrCreateMember({ userId: LOU_ID, email: LOU, name: null });
    await recordConsent(LOU_ID, AGREED_TO_CURRENT);
    await addTargetExam(LOU_ID, { examCode: "ME", examDate: "2099-02-08" });
    await onThisDevice(LOU_ID);
    signedInAs(LOU);
    render(await account());

    const profile = screen.getByRole("region", { name: "Profile" });
    expect(within(profile).getByText(LOU)).toBeInTheDocument();
    expect(within(profile).getByText(`${LOU} · Google`)).toBeInTheDocument();
  });

  it("never shows a Member another Member's Privacy Requests", async () => {
    await agreedAs(LOU, "Lou Lapsed");
    await requestPrivacy(LOU_ID, "data-copy");
    await requestPrivacy(LOU_ID, "deletion");
    render(await account());

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request a copy of my data" })).toBeInTheDocument();
  });
});

describe("requestDataCopy", () => {
  it("asks for the signed-in Member's data, which Account then shows pending and Owners see", async () => {
    const { requestDataCopy } = await actions();
    await requestDataCopy();

    expect(stored()).toMatchObject([
      { userId: BEA_ID, type: "data-copy", status: "open", dueOn: "2026-11-26" },
    ]);
    render(await account());
    expect(screen.getByRole("status", { name: "Data copy" })).toHaveTextContent(
      `Data copy requested on 19 Nov 2026. AYC will email your data to ${BEA} within 7 days.`,
    );
    expect(
      screen.queryByRole("button", { name: "Request a copy of my data" }),
    ).not.toBeInTheDocument();
    expect(await ownersList()).toMatchObject([
      { type: "data-copy", dueOn: "2026-11-26", member: { email: BEA } },
    ]);
  });

  it("makes no second request while one is open", async () => {
    const { requestDataCopy } = await actions();
    await requestDataCopy();
    await requestDataCopy();
    expect(stored()).toHaveLength(1);
  });
});

describe("requestDeletion", () => {
  it.each([
    ["nothing typed", {}],
    ["a blank", { confirmation: "" }],
    ["lower case", { confirmation: "delete" }],
    ["something else", { confirmation: "yes" }],
  ])("refuses %s, asking for nothing", async (_what, fields) => {
    const { requestDeletion } = await actions();
    expect(await requestDeletion({ error: null }, form(fields))).toEqual({
      error: "Type DELETE, in capitals, to confirm.",
    });
    expect(stored()).toEqual([]);
  });

  it("asks for the signed-in Member's deletion, who stays signed in and sees it pending", async () => {
    const { requestDeletion } = await actions();
    expect(await requestDeletion({ error: null }, form({ confirmation: "DELETE" }))).toEqual({
      error: null,
    });

    expect(stored()).toMatchObject([
      { userId: BEA_ID, type: "deletion", status: "open", dueOn: "2026-12-19" },
    ]);
    expect(jar.get("ayc_admin_sample")).toBe(BEA);
    render(await account());
    expect(screen.getByRole("status", { name: "Account deletion" })).toHaveTextContent(
      "Deletion requested on 19 Nov 2026. Your account and its data are removed by 19 Dec 2026.",
    );
    expect(screen.queryByRole("button", { name: "Delete my account" })).not.toBeInTheDocument();
    expect(await ownersList()).toMatchObject([{ type: "deletion", member: { email: BEA } }]);
  });

  it("asks for the signed-in Member only, whatever User id the form names", async () => {
    await agreedAs(LOU, "Lou Lapsed");
    const { requestDeletion } = await actions();
    await requestDeletion({ error: null }, form({ confirmation: "DELETE", userId: LOU_ID }));

    expect(stored().map(({ userId }) => userId)).toEqual([BEA_ID]);
  });

  it("makes no second request while one is open", async () => {
    const { requestDeletion } = await actions();
    await requestDeletion({ error: null }, form({ confirmation: "DELETE" }));
    await requestDeletion({ error: null }, form({ confirmation: "DELETE" }));
    expect(stored()).toHaveLength(1);
  });
});

describe("Support", () => {
  it("shows the contact email from Settings, to email, and the common questions", async () => {
    editSampleCatalogue((seed) => {
      seed.settings.contactEmail = "help@example.com";
    });
    await agreedAs(BEA, "Bea Tester");
    render(await support());

    expect(screen.getByRole("heading", { level: 1, name: "Need help?" })).toBeInTheDocument();
    expect(screen.getByText("07 · SUPPORT")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Email Support" })).toHaveAttribute(
      "href",
      "mailto:help@example.com?subject=AceYourCourse%20support",
    );
    expect(screen.getByText("Opens your email app, addressed to help@example.com")).toBeVisible();

    const questions = screen.getByRole("region", { name: "Common questions" });
    expect(
      within(questions)
        .getAllByRole("group")
        .map((question) => question.querySelector("summary span")?.textContent),
    ).toEqual([
      "Why was I signed out on my other device?",
      "How do I change my exam date?",
      "Why is a Topic locked?",
      "Does my access renew by itself?",
      "How do I get a copy of my data, or delete my account?",
    ]);
  });
});
