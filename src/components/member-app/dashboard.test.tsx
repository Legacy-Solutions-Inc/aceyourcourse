import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MemberProgress, TopicProgress, WeakTopic } from "@/lib/member-app/progress";
import type { TargetExam } from "@/services/member.types";

import { Dashboard, DashboardLoading } from "./dashboard";

// Home's dashboard (mockup `dashboard` L155–226 and `loading` L493–501,
// BUILD-MAP §3; stories 88–92): the countdown, the Study Streak, "Continue
// where you left off", progress by Subject and the weakest Topics, from the
// Member seam's progress read; the starter state before any study, and the
// skeleton while it loads. It's 17 Nov 2026, 11:42 in Manila.
const NOW = new Date("2026-11-17T03:42:00.000Z");

const CE: TargetExam = {
  examCode: "CE",
  board: "CELE",
  name: "Civil Engineering",
  examDate: "2026-11-21",
  dateSetBy: "official",
  selected: true,
  addedAt: "2026-11-01T00:00:00.000Z",
};

function topicProgress(id: string, name: string, parts: Partial<TopicProgress> = {}) {
  return {
    id,
    name,
    position: 1,
    percent: 0,
    cards: null,
    quiz: null,
    pages: null,
    weak: false,
    ...parts,
  } satisfies TopicProgress;
}

const SIMPLE_CURVES: WeakTopic = {
  ...topicProgress("t-simple", "Simple Curves", {
    percent: 40,
    weak: true,
    cards: { deckId: "d-simple", total: 48, got: 12, again: 7 },
    quiz: { quizId: "q-simple", bestScore: 40, passingScore: 70, attempts: 2 },
  }),
  subjectCode: "MSTC",
};
const SHEAR: WeakTopic = {
  ...topicProgress("t-shear", "Shear Strength", {
    percent: 50,
    weak: true,
    cards: { deckId: "d-shear", total: 20, got: 4, again: 5 },
    quiz: { quizId: "q-shear", bestScore: null, passingScore: 70, attempts: 0 },
  }),
  subjectCode: "HPGE",
};

const STREAK_DAYS = [
  "2026-11-11",
  "2026-11-12",
  "2026-11-13",
  "2026-11-14",
  "2026-11-15",
  "2026-11-16",
  "2026-11-17",
];

/** A Member six days into a streak, with studying in progress. */
const IN_PROGRESS: MemberProgress = {
  started: true,
  cards: { got: 312, total: 1040 },
  pages: { viewed: 4, total: 36 },
  quizAverage: 76,
  quizzesTaken: 14,
  lessons: { done: 0, total: 0 },
  subjects: [
    {
      code: "MSTC",
      name: "Mathematics, Surveying & Transportation Engineering",
      percent: 42,
      cards: { got: 148, total: 400 },
      pages: { viewed: 0, total: 0 },
      quizAverage: 81,
      quizzesTaken: 6,
      lessons: { done: 0, total: 0 },
      topics: [SIMPLE_CURVES],
    },
    {
      code: "HPGE",
      name: "Hydraulics & Geotechnical Engineering",
      percent: 27,
      cards: { got: 96, total: 340 },
      pages: { viewed: 0, total: 0 },
      quizAverage: null,
      quizzesTaken: 0,
      lessons: { done: 0, total: 0 },
      topics: [SHEAR],
    },
    {
      code: "PSAD",
      name: "Structural Analysis & Design",
      percent: null,
      cards: { got: 0, total: 0 },
      pages: { viewed: 0, total: 0 },
      quizAverage: null,
      quizzesTaken: 0,
      lessons: { done: 0, total: 0 },
      topics: [],
    },
  ],
  weakTopics: [SIMPLE_CURVES, SHEAR],
  resume: {
    deck: {
      deckId: "d-simple",
      subjectCode: "MSTC",
      topicName: "Simple Curves",
      card: 12,
      cardCount: 48,
      savedAt: "2026-11-17T02:00:00.000Z",
    },
    reviewerPdf: {
      reviewerPdfId: "p-simple",
      subjectCode: "MSTC",
      topicName: "Simple Curves",
      page: 4,
      pageCount: 36,
      savedAt: "2026-11-16T09:00:00.000Z",
    },
    lesson: null,
  },
  streak: {
    current: 6,
    best: 11,
    today: "2026-11-17",
    studiedToday: false,
    lastSevenDays: STREAK_DAYS.map((day, index) => ({ day, studied: index < 6 })),
    lastStudyDay: "2026-11-16",
  },
};

/** A Member who hasn't studied yet: the starter state. */
const NOT_STARTED: MemberProgress = {
  ...IN_PROGRESS,
  started: false,
  cards: { got: 0, total: 1040 },
  pages: { viewed: 0, total: 36 },
  quizAverage: null,
  quizzesTaken: 0,
  weakTopics: [],
  resume: { deck: null, reviewerPdf: null, lesson: null },
  streak: {
    current: 0,
    best: 0,
    today: "2026-11-17",
    studiedToday: false,
    lastSevenDays: STREAK_DAYS.map((day) => ({ day, studied: false })),
    lastStudyDay: null,
  },
};

const renderDashboard = (progress: MemberProgress) =>
  render(<Dashboard exam={CE} now={NOW} progress={progress} />);

describe("Dashboard", () => {
  it("shows the countdown for the selected Target Exam", () => {
    renderDashboard(IN_PROGRESS);

    expect(screen.getByRole("region", { name: "CELE board exam countdown" })).toHaveTextContent(
      "4days to go",
    );
  });

  describe("the Study Streak", () => {
    it("shows the current streak, the best, and the last 7 days ending today", () => {
      renderDashboard(IN_PROGRESS);

      const streak = screen.getByRole("region", { name: "Study streak" });
      expect(streak).toHaveTextContent("6days in a row");
      expect(streak).toHaveTextContent("Study anything today to make it 7. Your best is 11 days.");
      const days = within(within(streak).getByRole("list", { name: "Last 7 days" })).getAllByRole(
        "listitem",
      );
      expect(days.map((day) => day.textContent)).toEqual([
        "✓WED, studied",
        "✓THU, studied",
        "✓FRI, studied",
        "✓SAT, studied",
        "✓SUN, studied",
        "✓MON, studied",
        "TODAY, not yet",
      ]);
    });

    it("says today is done once it's a Study Day, and when the streak is the best yet", () => {
      renderDashboard({
        ...IN_PROGRESS,
        streak: { ...IN_PROGRESS.streak, current: 7, best: 7, studiedToday: true },
      });

      expect(screen.getByRole("region", { name: "Study streak" })).toHaveTextContent(
        "You studied today. Come back tomorrow to make it 8. That’s your best yet.",
      );
    });

    it("invites a Member with no streak to start one, without a 0", () => {
      renderDashboard(NOT_STARTED);

      const streak = screen.getByRole("region", { name: "Study streak" });
      expect(streak).toHaveTextContent("No streak yet");
      expect(streak).toHaveTextContent("Study anything today to start one.");
      expect(streak).not.toHaveTextContent(/\b0\b/);
    });
  });

  describe("Continue where you left off", () => {
    it("links the last deck at its card and the last Reviewer PDF at its page, the latest first", () => {
      renderDashboard(IN_PROGRESS);

      const resume = screen.getByRole("region", { name: "Continue where you left off" });
      const links = within(resume).getAllByRole("link");
      expect(links).toHaveLength(2);
      expect(links[0]).toHaveAttribute("href", "/app/library/deck/d-simple");
      expect(links[0]).toHaveTextContent(
        /FLASHCARDS · MSTC.*Simple Curves.*CARD 12 OF 48.*Continue/,
      );
      expect(links[1]).toHaveAttribute("href", "/app/library/reviewer-pdf/p-simple");
      expect(links[1]).toHaveTextContent(
        /REVIEWER · MSTC.*Simple Curves reviewer.*PAGE 4 OF 36.*Open/,
      );
    });

    it("shows only the place there is, and puts the Reviewer PDF first when it's the latest", () => {
      renderDashboard({
        ...IN_PROGRESS,
        resume: {
          deck: IN_PROGRESS.resume.deck && {
            ...IN_PROGRESS.resume.deck,
            savedAt: "2026-11-15T00:00:00.000Z",
          },
          reviewerPdf: IN_PROGRESS.resume.reviewerPdf,
          lesson: null,
        },
      });
      const links = within(
        screen.getByRole("region", { name: "Continue where you left off" }),
      ).getAllByRole("link");
      expect(links.map((link) => link.getAttribute("href"))).toEqual([
        "/app/library/reviewer-pdf/p-simple",
        "/app/library/deck/d-simple",
      ]);
    });

    it("includes the last Lesson watched, with where its video picks up, in order of when", () => {
      renderDashboard({
        ...IN_PROGRESS,
        resume: {
          ...IN_PROGRESS.resume,
          lesson: {
            courseId: "c-psad",
            lessonId: "l-ratio",
            subjectCode: "PSAD",
            title: "Balanced steel ratio",
            position: 760,
            seconds: 1450,
            savedAt: "2026-11-16T12:00:00.000Z",
          },
        },
      });
      const links = within(
        screen.getByRole("region", { name: "Continue where you left off" }),
      ).getAllByRole("link");
      expect(links).toHaveLength(3);
      // After the deck (02:00 today), before the Reviewer PDF (09:00 yesterday).
      expect(links[1]).toHaveAttribute("href", "/app/courses/c-psad/lessons/l-ratio");
      expect(links[1]).toHaveTextContent(
        /VIDEO LESSON · PSAD.*Balanced steel ratio.*12:40 OF 24:10.*Resume/,
      );
    });

    it("isn't shown with no place to continue", () => {
      renderDashboard({
        ...IN_PROGRESS,
        resume: { deck: null, reviewerPdf: null, lesson: null },
      });

      expect(screen.queryByRole("region", { name: "Continue where you left off" })).toBeNull();
    });
  });

  describe("progress by Subject", () => {
    it("shows each Subject's %, cards got and quiz average, each opening its Library tab", () => {
      renderDashboard(IN_PROGRESS);

      const subjects = screen.getByRole("region", { name: "Progress by subject" });
      expect(subjects).toHaveTextContent("312 / 1,040 CARDS GOT IT · 76% QUIZ AVG");
      const links = within(subjects).getAllByRole("link");
      expect(links.map((link) => [link.getAttribute("href"), link.textContent])).toEqual([
        [
          "/app/library?subject=MSTC",
          "42%MSTCMathematics, Surveying & Transportation Engineering148 / 400 cards got it · 81% quiz avg",
        ],
        [
          "/app/library?subject=HPGE",
          "27%HPGEHydraulics & Geotechnical Engineering96 / 340 cards got it · No quiz taken yet",
        ],
        ["/app/library?subject=PSAD", "—PSADStructural Analysis & DesignStill being prepared"],
      ]);
    });

    it("adds the Lessons done to the summary and to each Subject with Lessons", () => {
      const [mstc, hpge, psad] = IN_PROGRESS.subjects as [
        (typeof IN_PROGRESS.subjects)[number],
        (typeof IN_PROGRESS.subjects)[number],
        (typeof IN_PROGRESS.subjects)[number],
      ];
      renderDashboard({
        ...IN_PROGRESS,
        lessons: { done: 9, total: 32 },
        subjects: [
          { ...mstc, lessons: { done: 0, total: 5 } },
          hpge,
          // A Subject with only Lessons so far: not "Still being prepared".
          { ...psad, lessons: { done: 9, total: 27 } },
        ],
      });

      const subjects = screen.getByRole("region", { name: "Progress by subject" });
      expect(subjects).toHaveTextContent(
        "312 / 1,040 CARDS GOT IT · 76% QUIZ AVG · 9 / 32 LESSONS",
      );
      const links = within(subjects).getAllByRole("link");
      expect(links.map((link) => link.textContent)).toEqual([
        "42%MSTCMathematics, Surveying & Transportation Engineering148 / 400 cards got it · 81% quiz avg · 0 lessons",
        "27%HPGEHydraulics & Geotechnical Engineering96 / 340 cards got it · No quiz taken yet",
        "—PSADStructural Analysis & Design9 lessons",
      ]);
    });

    it("says nothing of Lessons while the Exam has none the Member can open", () => {
      renderDashboard(IN_PROGRESS);

      expect(screen.getByRole("region", { name: "Progress by subject" })).not.toHaveTextContent(
        /lesson/i,
      );
    });
  });

  describe("weak Topics", () => {
    it("lists them lowest first, linking to their deck and quiz", () => {
      renderDashboard(IN_PROGRESS);

      const weak = screen.getByRole("region", { name: "Weak topics to review" });
      const rows = within(weak).getAllByRole("listitem");
      expect(rows).toHaveLength(2);
      const [first, second] = rows as [HTMLElement, HTMLElement];
      expect(first).toHaveTextContent(
        /MSTC.*Simple Curves.*BEST SCORE 40% · PASSING 70% · 7 CARDS TO REVIEW AGAIN.*40%/,
      );
      expect(
        within(first).getByRole("link", { name: "Review cards in Simple Curves" }),
      ).toHaveAttribute("href", "/app/library/deck/d-simple");
      expect(
        within(first).getByRole("link", { name: "Retake quiz in Simple Curves" }),
      ).toHaveAttribute("href", "/app/library/quiz/q-simple");
      // Weak by its cards alone: its quiz isn't taken yet.
      expect(second).toHaveTextContent(
        /HPGE.*Shear Strength.*NO QUIZ YET · 5 CARDS TO REVIEW AGAIN/,
      );
      expect(
        within(second).getByRole("link", { name: "Take quiz in Shear Strength" }),
      ).toHaveAttribute("href", "/app/library/quiz/q-shear");
    });

    it("says there are none when no Topic is weak", () => {
      renderDashboard({ ...IN_PROGRESS, weakTopics: [] });

      const weak = screen.getByRole("region", { name: "Weak topics to review" });
      expect(within(weak).queryByRole("list")).toBeNull();
      expect(weak).toHaveTextContent("No weak Topics right now.");
    });
  });

  describe("the starter state", () => {
    it("points a Member who hasn't studied to the Library, instead of zeros everywhere", () => {
      renderDashboard(NOT_STARTED);

      const start = screen.getByRole("region", { name: "Start studying CE" });
      expect(within(start).getByRole("link", { name: "Open the Library" })).toHaveAttribute(
        "href",
        "/app/library",
      );
      for (const name of [
        "Continue where you left off",
        "Progress by subject",
        "Weak topics to review",
      ]) {
        expect(screen.queryByRole("region", { name })).toBeNull();
      }
      expect(document.body).not.toHaveTextContent(/NaN|0%/);
    });

    it("says an Exam's content is still being prepared when it has nothing to study yet", () => {
      renderDashboard({
        ...NOT_STARTED,
        cards: { got: 0, total: 0 },
        pages: { viewed: 0, total: 0 },
        subjects: NOT_STARTED.subjects.map((subject) => ({ ...subject, percent: null })),
      });

      expect(screen.getByRole("region", { name: "Start studying CE" })).toHaveTextContent(
        "CE’s flashcards, quizzes and Reviewer PDFs are still being prepared.",
      );
    });
  });
});

describe("DashboardLoading", () => {
  it("shows the skeleton and says the dashboard is loading", () => {
    render(<DashboardLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("LOADING YOUR DASHBOARD…");
  });
});
