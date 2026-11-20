import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MemberProgress } from "@/lib/member-app/progress";
import type { AdminMemberDetail } from "@/services/admin.types";

import { MemberDetail } from "./member-detail";

// A Member's detail page (story 130; BUILD-MAP §3.10, detail): every section
// an Owner needs to answer a question or spot a shared account. The detail
// comes from the seam; force sign-out and the Access Pass panels have their
// own tests.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  unstable_rethrow: () => {},
}));

const NOW = new Date("2026-11-19T03:42:00.000Z");
const OWNER = { email: "angel@aceyourcourse.ph", name: "Angel Rose L. Lepaña" };

const PROGRESS = {
  started: true,
  cards: { got: 1, total: 2 },
  pages: { viewed: 2, total: 3 },
  quizAverage: 0,
  quizzesTaken: 1,
  subjects: [],
  weakTopics: [],
  resume: { deck: null, reviewerPdf: null },
  streak: {
    current: 1,
    best: 1,
    today: "2026-11-19",
    studiedToday: true,
    lastSevenDays: [],
    lastStudyDay: "2026-11-19",
  },
} as MemberProgress;

const DETAIL: AdminMemberDetail = {
  member: {
    userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
    email: "tester@example.com",
    name: "Bea Tester",
    joinedAt: "2026-11-17T03:42:00.000Z",
  },
  role: "member",
  betaTester: true,
  targetExams: [
    {
      examCode: "CE",
      board: "CELE",
      name: "Civil Engineering",
      examDate: "2027-04-24",
      dateSetBy: "member",
      selected: true,
      addedAt: "2026-11-17T03:43:00.000Z",
    },
  ],
  accessPasses: [
    {
      examCode: "CE",
      endsAt: "2027-02-15T03:42:00.000Z",
      grants: [
        {
          days: 90,
          startsAt: "2026-11-17T03:42:00.000Z",
          endsAt: "2027-02-15T03:42:00.000Z",
          reason: "Beta tester",
          grantedBy: OWNER,
          grantedAt: "2026-11-17T03:42:00.000Z",
        },
      ],
    },
    { examCode: "ME", endsAt: "2026-11-14T03:42:00.000Z", grants: [] },
  ],
  progress: [{ examCode: "CE", progress: PROGRESS }],
  activeDevice: { deviceLabel: "Safari on macOS", claimedAt: "2026-11-19T03:00:00.000Z" },
  deviceSwitches: [
    { deviceLabel: "Safari on macOS", switchedAt: "2026-11-19T03:00:00.000Z" },
    { deviceLabel: "Chrome on Android", switchedAt: "2026-11-17T03:45:00.000Z" },
  ],
  consents: [{ termsVersion: "2.0", privacyVersion: "2.0", agreedAt: "2026-11-17T03:44:00.000Z" }],
};

const EMPTY: AdminMemberDetail = {
  ...DETAIL,
  member: { ...DETAIL.member, name: null },
  betaTester: false,
  targetExams: [],
  accessPasses: [],
  progress: [],
  activeDevice: null,
  deviceSwitches: [],
  consents: [],
};

const section = (name: string) => screen.getByRole("region", { name });

function renderDetail(detail = DETAIL) {
  render(
    <MemberDetail
      detail={detail}
      now={NOW}
      exams={[{ code: "CE", name: "Civil Engineering" }]}
      forceSignOut={vi.fn()}
      passActions={{ grant: vi.fn(), extend: vi.fn(), end: vi.fn() }}
    />,
  );
}

describe("MemberDetail", () => {
  it("shows the profile: name, email, role, Beta Tester and when they joined", () => {
    renderDetail();

    expect(screen.getByRole("heading", { level: 2, name: "Bea Tester" })).toBeInTheDocument();
    const profile = section("Bea Tester");
    expect(profile).toHaveTextContent("BT");
    expect(profile).toHaveTextContent("tester@example.com · Google");
    expect(profile).toHaveTextContent("ROLEMember");
    expect(profile).toHaveTextContent("BETA TESTERYes");
    expect(profile).toHaveTextContent("JOINED17 NOV 2026");
  });

  it("shows the Active Device with force sign-out", () => {
    renderDetail();
    expect(section("ACTIVE DEVICE")).toHaveTextContent("Safari on macOS");
    expect(screen.getByRole("button", { name: "Sign out this device" })).toBeInTheDocument();
  });

  it("shows each Target Exam with its Exam Date and who set it", () => {
    renderDetail();
    const exams = within(section("TARGET EXAMS")).getAllByRole("listitem");
    expect(exams).toHaveLength(1);
    expect(exams[0]).toHaveTextContent("CE · Civil Engineering");
    expect(exams[0]).toHaveTextContent("EXAM DATE 24 Apr 2027 · SET BY THE MEMBER");
  });

  it("shows each Access Pass with its end in Manila, whether it's active, and its grants", () => {
    renderDetail();
    const passes = within(section("ACCESS PASSES")).getAllByRole("listitem", { name: /pass/ });
    expect(passes).toHaveLength(2);
    expect(passes[0]).toHaveTextContent("CE");
    expect(passes[0]).toHaveTextContent("UNTIL 15 FEB 2027");
    expect(passes[0]).toHaveTextContent("ACTIVE");
    expect(passes[0]).toHaveTextContent("+90 DAYS · 17 NOV 2026 · BY ANGEL ROSE L. LEPAÑA");
    expect(passes[0]).toHaveTextContent("“Beta tester”");
    expect(passes[1]).toHaveTextContent("ENDED 14 NOV 2026");
    expect(within(passes[1] ?? document.body).getByText("ENDED", { exact: true })).toHaveClass(
      "text-destructive",
    );
    expect(passes[1]).toHaveTextContent("No grants recorded");
  });

  it("shows the progress summary per Target Exam, from the progress calculator", () => {
    renderDetail();
    const progress = section("PROGRESS");
    expect(within(progress).getByRole("heading", { level: 3, name: "CE" })).toBeInTheDocument();
    expect(progress).toHaveTextContent("CARDS GOT IT1 / 2");
    expect(progress).toHaveTextContent("QUIZ AVERAGE0%1 QUIZ TAKEN");
    expect(progress).toHaveTextContent("PAGES READ2 / 3");
    expect(progress).toHaveTextContent("LAST ACTIVE19 Nov 2026");
    expect(progress).toHaveTextContent("STUDY STREAK1 DAY · BEST 1");
  });

  it("shows the device switch count and log, newest first", () => {
    renderDetail();
    const switches = section("DEVICE SWITCHES · 2");
    const entries = within(switches).getAllByRole("listitem");
    expect(entries.map((entry) => entry.textContent)).toEqual([
      "Safari on macOS19 NOV 2026, 11:00 AM",
      "Chrome on Android17 NOV 2026, 11:45 AM",
    ]);
  });

  it("shows the consent versions and when they were agreed to", () => {
    renderDetail();
    expect(section("CONSENT")).toHaveTextContent(
      "TERMS 2.0 · PRIVACY 2.0AGREED 17 NOV 2026, 11:44 AM",
    );
  });

  it("labels the purchase history as arriving with Payments", () => {
    renderDetail();
    expect(section("PURCHASE HISTORY")).toHaveTextContent(
      "Purchases arrive with Payments (Phase 4).",
    );
  });

  it("says what a Member who just signed in doesn't have yet", () => {
    renderDetail(EMPTY);

    expect(
      screen.getByRole("heading", { level: 2, name: "tester@example.com" }),
    ).toBeInTheDocument();
    expect(section("tester@example.com")).toHaveTextContent("BETA TESTERNo");
    expect(section("TARGET EXAMS")).toHaveTextContent("No Target Exam yet.");
    expect(section("ACCESS PASSES")).toHaveTextContent(
      "No Access Pass. They see Free Preview content only.",
    );
    expect(section("PROGRESS")).toHaveTextContent("No progress yet: they have no Target Exam.");
    expect(section("ACTIVE DEVICE")).toHaveTextContent("No Active Device. Nothing to sign out.");
    expect(section("DEVICE SWITCHES · 0")).toHaveTextContent("No device has been Active yet.");
    expect(section("CONSENT")).toHaveTextContent(
      "Hasn’t agreed to the Terms and Privacy Policy yet.",
    );
  });

  it("names Staff by their Staff Role", () => {
    renderDetail({ ...DETAIL, role: "owner" });
    expect(section("Bea Tester")).toHaveTextContent("ROLEOwner (Staff)");
  });
});
