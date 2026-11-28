import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_COOKIE } from "@/lib/member-app/device-token";
import { setPlanOnSale } from "@/services/admin.mock";
import { addTargetExam, getOrCreateMember, recordConsent } from "@/services/member.mock";
import { samplePlanId } from "@/services/mock/plans";
import { sampleUserId } from "@/services/mock/members";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { sampleActor } from "../../../test/admin-inputs";
import { AGREED_TO_CURRENT, onThisDevice, TEST_DEVICE_TOKEN } from "../../../test/member-inputs";
import { redirectsTo } from "../../../test/redirects";

// The Member's Plans page (Phase 4, ticket 02; spec, Phase 4 planning
// decisions → Who buys, and which Exams, The key decides, Renewal reminders;
// stories 134, 151c, 151e and 151m), on sample data: the page as a browser
// would load it. The pills, the fallback and the dates are worked out in
// plans-view.test.ts; the body in plans.test.tsx. It's 17 Nov 2026, 11:42 in
// Manila. Every Exam's starting Plans are on sale (CE: 1, 3 and 6 months;
// the others 1 month). The tester's CE pass ends in 90 days, on 15 Feb 2027.
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
  usePathname: () => "/app/plans",
}));

const BOOT = new Date("2026-11-17T03:42:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const OWNER = sampleActor("owner");
const TESTER = { email: "tester@example.com", name: "Bea Tester" };

/** Signed in as this sample User on this browser, not yet agreed to anything. */
async function signedIn({ email, name }: { email: string; name: string }) {
  const userId = sampleUserId(email);
  await getOrCreateMember({ userId, email, name });
  await onThisDevice(userId);
  jar.set("ayc_admin_sample", email);
  jar.set(DEVICE_COOKIE, TEST_DEVICE_TOKEN);
  return userId;
}

/** Signed in as a Member who has agreed, with CE (Exam Date 10 Jan 2027) as their Target Exam. */
async function memberOnDevice(who = TESTER, examDate = "2027-01-10") {
  const userId = await signedIn(who);
  await recordConsent(userId, AGREED_TO_CURRENT);
  await addTargetExam(userId, { examCode: "CE", examDate });
  return userId;
}

/** The tester's CE pass now ends `days` from now. */
function passEndsIn(days: number) {
  const store = getSampleStore();
  const userId = sampleUserId(TESTER.email);
  store.accessPasses = store.accessPasses.map((pass) =>
    pass.userId === userId && pass.examCode === "CE"
      ? { ...pass, endsAt: new Date(BOOT.getTime() + days * DAY).toISOString() }
      : pass,
  );
}

const plansPage = async (exam?: string) =>
  (await import("./(shell)/plans/page")).default({
    searchParams: Promise.resolve(exam === undefined ? {} : { exam }),
  });

const pills = () => screen.getByRole("navigation", { name: "Exams" });
const currentPill = () => within(pills()).getByRole("link", { current: "page" });
const planGroup = () => screen.getByRole("radiogroup", { name: /ALL-ACCESS/ });
/** Each Plan row's text, shortest first. */
const rowTexts = () =>
  within(planGroup())
    .getAllByRole("radio")
    .map((radio) => radio.closest("label")?.textContent ?? "");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(BOOT);
  jar.clear();
  resetSampleStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the Plans page", () => {
  it("opens on the Member's CE, with each CE Plan and the date their access would end", async () => {
    await memberOnDevice();
    render(await plansPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Choose your access" }),
    ).toBeInTheDocument();
    expect(screen.getByText("04 · PLANS")).toBeInTheDocument();
    expect(currentPill()).toHaveTextContent("CE");
    expect(planGroup()).toHaveAccessibleName("CE ALL-ACCESS · FLASHCARDS, QUIZZES, REVIEWERS");
    // The tester's 90 days left are kept: each Plan counts from 15 Feb 2027.
    expect(rowTexts()).toEqual([
      expect.stringMatching(/^1 month.*Until 17 Mar 2027.*₱499/),
      expect.stringMatching(/^3 months.*BEST VALUE.*Until 16 May 2027.*₱1,299/),
      expect.stringMatching(/^6 months.*Until 14 Aug 2027.*₱2,299/),
    ]);
  });

  it("counts a Member's 20 days left into every end, and says which Plans cover their exam", async () => {
    await memberOnDevice();
    passEndsIn(20); // 7 Dec 2026
    render(await plansPage());

    expect(rowTexts()).toEqual([
      expect.stringMatching(/Until 6 Jan 2027₱499/),
      expect.stringMatching(/Until 7 Mar 2027 · covers your exam on 10 Jan 2027/),
      expect.stringMatching(/Until 5 Jun 2027 · covers your exam on 10 Jan 2027/),
    ]);
  });

  it("gives a pill to every Exam with a Plan on sale, the Member's Target Exams first", async () => {
    const userId = await memberOnDevice();
    await addTargetExam(userId, { examCode: "MT", examDate: "2027-03-01" });
    render(await plansPage());

    expect(
      within(pills())
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([
      expect.stringMatching(/^CE/),
      expect.stringMatching(/^MT/),
      expect.stringMatching(/^ME/),
      expect.stringMatching(/^EE/),
      expect.stringMatching(/^CPA/),
    ]);
    // Adding MT selected it: the page opens on the Member's current Exam.
    expect(currentPill()).toHaveTextContent(/^MT/);
  });

  it("opens on the Exam ?exam= asks for", async () => {
    await memberOnDevice();
    render(await plansPage("me"));

    expect(currentPill()).toHaveTextContent(/^ME/);
    expect(rowTexts()).toEqual([expect.stringMatching(/^1 month.*Until 17 Dec 2026.*₱449/)]);
  });

  it.each([
    ["an unknown Exam", "ZZ"],
    ["an Exam with nothing on sale", "EE"],
  ])("falls back to the Member's current Exam for %s", async (_what, asked) => {
    await setPlanOnSale(OWNER, samplePlanId("EE", 30), false);
    await memberOnDevice();
    render(await plansPage(asked));

    expect(currentPill()).toHaveTextContent(/^CE/);
  });

  it("gives an Exam with no Plan on sale no pill", async () => {
    await setPlanOnSale(OWNER, samplePlanId("EE", 30), false);
    await memberOnDevice();
    render(await plansPage());

    expect(within(pills()).queryByRole("link", { name: /^EE/ })).not.toBeInTheDocument();
  });

  it("drops a Plan an Owner switches off", async () => {
    await setPlanOnSale(OWNER, samplePlanId("CE", 30), false);
    await memberOnDevice();
    render(await plansPage());

    expect(rowTexts()).toEqual([
      expect.stringMatching(/^3 months/),
      expect.stringMatching(/^6 months/),
    ]);
  });

  it("offers Pay with the picked Plan's price: sample mode has the payments fake", async () => {
    await memberOnDevice();
    render(await plansPage());

    // A server with no payments client reads "Buying opens soon" (payments.test.tsx).
    expect(screen.getByRole("button", { name: "Pay ₱1,299 with PayMongo" })).toBeEnabled();
  });

  it("has no Staff note for a Member", async () => {
    await memberOnDevice();
    render(await plansPage());

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("tells active Staff they already open all content", async () => {
    await memberOnDevice({ email: OWNER.email, name: OWNER.name });
    render(await plansPage());

    expect(screen.getByRole("note")).toHaveTextContent("As Staff you already open all content.");
    expect(planGroup()).toBeInTheDocument();
  });

  it("sends someone signed out to sign in, coming back to Plans for the Exam asked for", async () => {
    await expect(plansPage("CE")).rejects.toThrow(
      redirectsTo("/app/sign-in?next=%2Fapp%2Fplans%3Fexam%3DCE"),
    );
  });

  it("keeps someone the beta gate doesn't let in out, before anything is read", async () => {
    await signedIn({ email: "stranger@example.com", name: "Sam Stranger" });
    await expect(plansPage()).rejects.toThrow(redirectsTo("/app/not-open-yet"));
  });

  it("sends a Member who hasn't agreed to consent first, coming back to Plans", async () => {
    await signedIn(TESTER);
    await expect(plansPage("CE")).rejects.toThrow(
      redirectsTo("/app/consent?next=%2Fapp%2Fplans%3Fexam%3DCE"),
    );
  });

  // Legal v2.1 (Phase 4, ticket 13): the Terms now cover payments and
  // refunds, so a Member who agreed to v2.0 agrees again before they can pay.
  it("sends a Member who agreed to v2.0 to agree to v2.1 first, coming back to Plans", async () => {
    const userId = await signedIn(TESTER);
    await recordConsent(userId, { termsVersion: "2.0", privacyVersion: "2.0" });
    await addTargetExam(userId, { examCode: "CE", examDate: "2027-01-10" });

    await expect(plansPage("CE")).rejects.toThrow(
      redirectsTo("/app/consent?next=%2Fapp%2Fplans%3Fexam%3DCE"),
    );
  });

  it("opens for that Member once they agree to v2.1, and doesn't ask again", async () => {
    const userId = await signedIn(TESTER);
    await recordConsent(userId, { termsVersion: "2.0", privacyVersion: "2.0" });
    await addTargetExam(userId, { examCode: "CE", examDate: "2027-01-10" });
    await recordConsent(userId, { termsVersion: "2.1", privacyVersion: "2.1" });

    for (let visit = 0; visit < 2; visit += 1) {
      const { unmount } = render(await plansPage("CE"));
      expect(planGroup()).toBeInTheDocument();
      unmount();
    }
  });

  it("sends a Member with no Target Exam yet to Home to pick one", async () => {
    const userId = await signedIn(TESTER);
    await recordConsent(userId, AGREED_TO_CURRENT);
    await expect(plansPage()).rejects.toThrow(redirectsTo("/app"));
  });
});
