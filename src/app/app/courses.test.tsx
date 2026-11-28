import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_COOKIE } from "@/lib/member-app/device-token";
import { shortMemberId } from "@/lib/member-app/member-id";
import { addBetaTester, setCourseVisibility } from "@/services/admin.mock";
import { addTargetExam, getOrCreateMember, recordConsent } from "@/services/member.mock";
import { sampleCourseId, sampleLessonId } from "@/services/mock/courses";
import { sampleUserId } from "@/services/mock/members";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import { createFakeVideoService, type FakeVideoService } from "@/services/video.fake";

import { sampleActor } from "../../../test/admin-inputs";
import { AGREED_TO_CURRENT, onThisDevice, TEST_DEVICE_TOKEN } from "../../../test/member-inputs";

// The Courses screen, a Course's page and the Lesson screen (Phase 5, ticket
// 03; spec, Phase 5 planning decisions → Access and playback, The Courses
// screen, The VdoCipher key decides; stories 157, 159, 163–165), on sample
// data with the video fake: the pages as a browser would load them. The
// access decision's every outcome is in access.test.ts, and the seam's in
// member.courses.test.ts. It's 28 Nov 2026, 11:42 in Manila. The tester
// (Bea) holds CE All-Access; the lapsed tester's CE pass ended 3 days ago;
// the stranger, once added to the beta, has none.
const { jar, video } = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  video: { current: null as FakeVideoService | null },
}));

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
  usePathname: () => "/app/courses",
}));
// The video service this server has: the fake, or none (no key) when a test says so.
vi.mock("@/services/video", () => ({ videoService: () => video.current }));

const BOOT = new Date("2026-11-28T03:42:00.000Z");
const OWNER = sampleActor("owner");

const SURVEYING = "Surveying & Curves Lectures";
const PSAD = "PSAD Masterclass";
const SURVEYING_ID = sampleCourseId(SURVEYING);
const PSAD_ID = sampleCourseId(PSAD);
const HPGE_ID = sampleCourseId("HPGE Crash Course");
const LEVELING = sampleLessonId(SURVEYING, "Surveying basics", "Distance and leveling");
const TRAVERSE = sampleLessonId(SURVEYING, "Surveying basics", "Traverse computations");
const AREAS = sampleLessonId(SURVEYING, "Surveying basics", "Areas and volumes");
const SIMPLE_CURVES = sampleLessonId(SURVEYING, "Horizontal curves", "Simple curves");
const BEAMS = sampleLessonId(PSAD, "Reinforced concrete", "Beams in flexure");
const FLUIDS = sampleLessonId("HPGE Crash Course", "Hydraulics", "Fluid properties");

/**
 * Signed in as this sample User, a Member who has agreed and has CE as their
 * selected Target Exam, using the Member App on this browser.
 */
async function memberOnDevice(email: string, name: string) {
  const userId = sampleUserId(email);
  await getOrCreateMember({ userId, email, name });
  await recordConsent(userId, AGREED_TO_CURRENT);
  await addTargetExam(userId, { examCode: "CE", examDate: "2027-01-10" });
  await onThisDevice(userId);
  jar.set("ayc_admin_sample", email);
  jar.set(DEVICE_COOKIE, TEST_DEVICE_TOKEN);
  return userId;
}

const asTester = () => memberOnDevice("tester@example.com", "Bea Tester");
const asLapsed = () => memberOnDevice("lapsed@example.com", "Lou Lapsed");
/** The stranger once an Owner adds them to the beta: a tester with no pass. */
async function asNewTester() {
  await addBetaTester(OWNER, { email: "stranger@example.com" });
  return memberOnDevice("stranger@example.com", "Sam Stranger");
}

/** Gives a Member Course Ownership, as a Paid Order or a gift will (tickets 06 and 07). */
function owns(userId: string, courseId: string) {
  const store = getSampleStore();
  store.courseOwnerships = [
    ...store.courseOwnerships,
    { userId, courseId, since: new Date().toISOString(), orderId: null },
  ];
}

const coursesScreen = async () => (await import("./(shell)/courses/page")).default();
const coursePage = async (course: string) =>
  (await import("./(shell)/courses/[course]/page")).default({
    params: Promise.resolve({ course }),
  });
const lessonScreen = async (course: string, lesson: string) =>
  (await import("./(shell)/courses/[course]/lessons/[lesson]/page")).default({
    params: Promise.resolve({ course, lesson }),
  });

/** A Course's card on the Courses screen, by its title. */
const card = (title: string) => {
  const heading = screen.getByRole("heading", { level: 3, name: title });
  const found = heading.closest("article");
  if (!found) throw new Error(`No card for "${title}"`);
  return within(found as HTMLElement);
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(BOOT);
  jar.clear();
  resetSampleStore();
  video.current = createFakeVideoService();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the Courses screen", () => {
  it("shows Bea her CE Courses by Subject, each with its state and how to get it", async () => {
    await asTester();
    render(await coursesScreen());

    expect(screen.getByText("03 · COURSES · CE · CELE")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Your CE courses" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      expect.stringContaining("MSTC"),
      expect.stringContaining("HPGE"),
      expect.stringContaining("PSAD"),
    ]);

    const surveying = card(SURVEYING);
    expect(surveying.getByText("IN YOUR PLAN")).toBeInTheDocument();
    expect(surveying.getByText("2 MODULES · 5 LESSONS")).toBeInTheDocument();
    expect(surveying.getByRole("link", { name: "Start course" })).toHaveAttribute(
      "href",
      `/app/courses/${SURVEYING_ID}/lessons/${LEVELING}`,
    );
    expect(surveying.getByRole("link", { name: SURVEYING })).toHaveAttribute(
      "href",
      `/app/courses/${SURVEYING_ID}`,
    );

    const psad = card(PSAD);
    expect(psad.getByText(/LOCKED/)).toBeInTheDocument();
    expect(psad.getByRole("link", { name: "Unlock for ₱1,499" })).toHaveAttribute(
      "href",
      "/app/plans?exam=CE",
    );

    const hpge = card("HPGE Crash Course");
    expect(hpge.getByText("Not on sale right now")).toBeInTheDocument();
    expect(hpge.queryByRole("link", { name: /Not on sale/ })).toBeNull();
  });

  it("locks the included Course for a Member with no pass, with its Free Preview Lesson to watch free", async () => {
    await asNewTester();
    render(await coursesScreen());

    const surveying = card(SURVEYING);
    expect(surveying.getByText(/LOCKED/)).toBeInTheDocument();
    expect(surveying.getByRole("link", { name: "See plans" })).toHaveAttribute(
      "href",
      "/app/plans?exam=CE",
    );
    expect(surveying.getByText(/1 FREE LESSON/)).toBeInTheDocument();
    expect(surveying.getByRole("link", { name: "Watch free" })).toHaveAttribute(
      "href",
      `/app/courses/${SURVEYING_ID}/lessons/${SIMPLE_CURVES}`,
    );
  });

  it("says renew, progress kept, once the Member's pass ended", async () => {
    await asLapsed();
    render(await coursesScreen());

    const surveying = card(SURVEYING);
    expect(surveying.getByRole("link", { name: "Renew access" })).toHaveAttribute(
      "href",
      "/app/plans?exam=CE",
    );
    expect(surveying.getByText("PROGRESS KEPT")).toBeInTheDocument();
  });

  it("shows a Course the Member owns as OWNED, even once Staff hide it", async () => {
    const userId = await asNewTester();
    owns(userId, PSAD_ID);
    await setCourseVisibility(OWNER, PSAD_ID, false);
    render(await coursesScreen());

    expect(card(PSAD).getByText("OWNED")).toBeInTheDocument();
    expect(card(PSAD).getByRole("link", { name: "Start course" })).toBeInTheDocument();
  });

  it("says the Exam's Courses are on the way when it has none to show", async () => {
    await asTester();
    for (const id of [SURVEYING_ID, PSAD_ID, HPGE_ID]) await setCourseVisibility(OWNER, id, false);
    render(await coursesScreen());

    expect(
      screen.getByText(
        "Courses for CE are on the way. Your flashcards, quizzes and Reviewer PDFs are ready now.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("article")).toBeNull();
  });

  it("sends a signed-out visitor to sign in, coming back", async () => {
    await expect(coursesScreen()).rejects.toThrow(
      `NEXT_REDIRECT /app/sign-in?next=${encodeURIComponent("/app/courses")}`,
    );
  });
});

describe("a Course's page", () => {
  it("lists Bea's included Course's Modules and Lessons with their lengths, each one to watch", async () => {
    await asTester();
    render(await coursePage(SURVEYING_ID));

    expect(screen.getByRole("heading", { level: 1, name: SURVEYING })).toBeInTheDocument();
    const outline = screen.getByRole("list", { name: "Modules and lessons" });
    expect(within(outline).getByText("MODULE 1 · Surveying basics")).toBeInTheDocument();
    const traverse = within(outline).getByRole("link", { name: /Traverse computations/ });
    expect(traverse).toHaveAttribute("href", `/app/courses/${SURVEYING_ID}/lessons/${TRAVERSE}`);
    expect(traverse.textContent).toMatch(/\d+:\d{2}/);
    expect(within(outline).getAllByRole("link")).toHaveLength(5);
  });

  it("opens a locked Course's list too, where only its Free Preview Lesson plays", async () => {
    await asNewTester();
    render(await coursePage(SURVEYING_ID));

    const outline = screen.getByRole("list", { name: "Modules and lessons" });
    expect(
      within(outline)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([expect.stringContaining("Simple curves")]);
    expect(within(outline).getByText(/Traverse computations/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See plans" })).toBeInTheDocument();
  });

  it("says a Hidden Course is no longer available to a Member who doesn't own it", async () => {
    await asTester();
    await setCourseVisibility(OWNER, PSAD_ID, false);
    render(await coursePage(PSAD_ID));

    expect(screen.getByRole("heading", { name: "No longer available" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Modules and lessons" })).toBeNull();
  });

  it("answers 404 for an address that is no Course's", async () => {
    await asTester();
    await expect(coursePage("not-a-course")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("the Lesson screen", () => {
  it("plays Bea's included Lesson in the sample player, with her email and Member ID drifting across it", async () => {
    const userId = await asTester();
    render(await lessonScreen(SURVEYING_ID, TRAVERSE));

    expect(
      screen.getByText("SURVEYING & CURVES LECTURES · MODULE 1 · LESSON 2"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Traverse computations" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("figure", { name: "Sample video: Traverse computations" }),
    ).toBeVisible();
    const drawn = screen.getByTestId("sample-watermark").style.backgroundImage;
    expect(decodeURIComponent(drawn)).toContain(`tester@example.com · ${shortMemberId(userId)}`);
    expect(video.current?.passes).toEqual([
      { videoId: expect.any(String), watermark: `tester@example.com · ${shortMemberId(userId)}` },
    ]);
  });

  it("goes to the Lessons before and after, and lists the Course's Modules and Lessons beside", async () => {
    await asTester();
    render(await lessonScreen(SURVEYING_ID, TRAVERSE));

    expect(screen.getByRole("link", { name: "← Distance and leveling" })).toHaveAttribute(
      "href",
      `/app/courses/${SURVEYING_ID}/lessons/${LEVELING}`,
    );
    expect(screen.getByRole("link", { name: "Next lesson →" })).toHaveAttribute(
      "href",
      `/app/courses/${SURVEYING_ID}/lessons/${AREAS}`,
    );
    const panel = screen.getByRole("navigation", { name: SURVEYING });
    expect(within(panel).getByRole("link", { name: /Traverse computations/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const lessons = within(panel).getByRole("list", { name: "Modules and lessons" });
    expect(within(lessons).getAllByRole("link")).toHaveLength(5);
    expect(within(panel).getByRole("link", { name: SURVEYING })).toHaveAttribute(
      "href",
      `/app/courses/${SURVEYING_ID}`,
    );
  });

  it("shows the Lesson's notes with their line breaks", async () => {
    await asTester();
    render(await lessonScreen(SURVEYING_ID, LEVELING));

    expect(screen.getByText(/Taping corrections\.\s+Differential leveling\./)).toHaveClass(
      "whitespace-pre-line",
    );
    expect(screen.queryByRole("link", { name: /^←/ })).toBeNull();
  });

  it("plays the Free Preview Lesson for a Member with no pass", async () => {
    await asNewTester();
    render(await lessonScreen(SURVEYING_ID, SIMPLE_CURVES));
    expect(screen.getByRole("figure", { name: "Sample video: Simple curves" })).toBeVisible();
  });

  it("shows a locked Lesson opened by its address the unlock prompt, and asks for no pass", async () => {
    await asNewTester();
    render(await lessonScreen(SURVEYING_ID, TRAVERSE));

    expect(screen.getByRole("heading", { name: "Unlock with CE All-Access" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See plans" })).toBeInTheDocument();
    expect(screen.queryByRole("figure")).toBeNull();
    expect(video.current?.passes).toEqual([]);
  });

  it("keeps a separately sold Course's Lesson locked for an Access Pass holder", async () => {
    await asTester();
    render(await lessonScreen(PSAD_ID, BEAMS));

    expect(
      screen.getByRole("heading", { name: "Unlock the PSAD Masterclass" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Unlock for ₱1,499" })).toHaveAttribute(
      "href",
      "/app/plans?exam=CE",
    );
    expect(video.current?.passes).toEqual([]);
  });

  it("says a separately sold Course not on sale isn't on sale", async () => {
    await asTester();
    render(await lessonScreen(HPGE_ID, FLUIDS));
    expect(
      screen.getByRole("heading", { name: "The HPGE Crash Course isn’t on sale right now" }),
    ).toBeInTheDocument();
  });

  it("says renew, progress kept, once the Member's pass ended", async () => {
    await asLapsed();
    render(await lessonScreen(SURVEYING_ID, TRAVERSE));

    expect(
      screen.getByRole("heading", { name: /Your CE All-Access ended on/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Your progress is kept\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Renew access" })).toBeInTheDocument();
  });

  it("plays an owned Course's Lesson after Staff hide the Course", async () => {
    const userId = await asNewTester();
    owns(userId, PSAD_ID);
    await setCourseVisibility(OWNER, PSAD_ID, false);
    render(await lessonScreen(PSAD_ID, BEAMS));
    expect(screen.getByRole("figure", { name: "Sample video: Beams in flexure" })).toBeVisible();
  });

  it("says the video isn't available yet with no video service, and the rest of the screen works", async () => {
    video.current = null;
    await asTester();
    render(await lessonScreen(SURVEYING_ID, TRAVERSE));

    expect(screen.getByText("This video isn’t available yet")).toBeInTheDocument();
    expect(screen.queryByRole("figure")).toBeNull();
    expect(
      screen.getByRole("heading", { level: 1, name: "Traverse computations" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next lesson →" })).toBeInTheDocument();
  });

  it("answers 404 for a Lesson that isn't in the Course its address names", async () => {
    await asTester();
    await expect(lessonScreen(PSAD_ID, TRAVERSE)).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(lessonScreen(SURVEYING_ID, "nope")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
