import { formatCount } from "@/lib/catalogue/figures";
import {
  type CardsGot,
  type MemberProgress,
  type ResumePlaces,
  type StreakDay,
  type StudyStreak,
  type SubjectProgress,
  type WeakTopic,
  wholePercent,
} from "@/lib/member-app/progress";
import { paths } from "@/paths";

// How Home's dashboard words a Member's progress (mockup `dashboard`,
// BUILD-MAP §3; stories 88–92). Pure: from the Member seam's progress read,
// which the calculator made (src/lib/member-app/progress.ts).

const plural = (n: number, one: string, many: string) =>
  `${formatCount(n)} ${n === 1 ? one : many}`;

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

/** Pure: a streak day's label under its box: its weekday, or "TODAY". */
export function streakDayLabel(day: StreakDay, today: string): string {
  if (day.day === today) return "TODAY";
  return WEEKDAYS[new Date(`${day.day}T00:00:00Z`).getUTCDay()] ?? "";
}

/** What the streak card says. */
export interface StreakWords {
  /** The big figure: the current streak, or null before the first Study Day. */
  figure: number | null;
  /** Beside the figure, or alone in its place. */
  headline: string;
  /** Under the days: what to do next, and the best streak. */
  note: string;
}

/** Pure: the streak card's words (mockup L174–181). */
export function streakWords({ current, best, studiedToday }: StudyStreak): StreakWords {
  if (best === 0) {
    return { figure: null, headline: "No streak yet", note: "Study anything today to start one." };
  }
  const bestNote =
    best > current ? ` Your best is ${plural(best, "day", "days")}.` : " That’s your best yet.";
  const headline = current === 1 ? "day in a row" : "days in a row";
  if (current === 0) {
    return { figure: 0, headline, note: `Study anything today to start a new one.${bestNote}` };
  }
  const next = current + 1;
  const todayNote = studiedToday
    ? `You studied today. Come back tomorrow to make it ${next}.`
    : `Study anything today to make it ${next}.`;
  return { figure: current, headline, note: `${todayNote}${bestNote}` };
}

/** Pure: "312 / 1,040 cards got it". */
export const cardsGotLine = ({ got, total }: CardsGot) =>
  `${formatCount(got)} / ${formatCount(total)} cards got it`;

/** Pure: "76% quiz avg", or that no quiz is taken yet. */
export const quizAverageLine = (quizAverage: number | null) =>
  quizAverage === null ? "No quiz taken yet" : `${quizAverage}% quiz avg`;

/** Pure: the line beside "Progress by subject": the Exam's cards got and quiz average. */
export function progressSummary({ cards, quizAverage }: MemberProgress): string | null {
  const parts = [
    cards.total > 0 ? cardsGotLine(cards).toUpperCase() : null,
    quizAverage === null ? null : `${quizAverage}% QUIZ AVG`,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Pure: under a Subject's name: its cards got, quiz average and pages read, for what it has. */
export function subjectDetail(subject: SubjectProgress): string {
  if (subject.percent === null) return "Still being prepared";
  const { pages } = subject;
  return [
    subject.cards.total > 0 ? cardsGotLine(subject.cards) : null,
    subject.topics.some((topic) => topic.quiz) ? quizAverageLine(subject.quizAverage) : null,
    pages.total > 0
      ? `${formatCount(pages.viewed)} / ${formatCount(pages.total)} pages read`
      : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

/** Pure: why a Topic is weak, as its row says: its Best Score against passing, and its cards to review. */
export function weakReason({ quiz, cards }: WeakTopic): string {
  return [
    quiz
      ? quiz.bestScore === null
        ? "NO QUIZ YET"
        : `BEST SCORE ${quiz.bestScore}% · PASSING ${quiz.passingScore}%`
      : null,
    cards && cards.again > 0 ? `${plural(cards.again, "CARD", "CARDS")} TO REVIEW AGAIN` : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

/** A "Continue where you left off" card. */
export interface ResumeCard {
  key: "deck" | "reviewer-pdf";
  kind: "FLASHCARDS" | "REVIEWER";
  subjectCode: string;
  title: string;
  /** "CARD 12 OF 48", "PAGE 4 OF 36". */
  meta: string;
  /** How far through it the place is, as a whole %. */
  percent: number;
  href: string;
  cta: string;
  savedAt: string;
}

/** Pure: the places to continue from, the latest first. */
export function resumeCards({ deck, reviewerPdf }: ResumePlaces): ResumeCard[] {
  const cards: ResumeCard[] = [];
  if (deck) {
    cards.push({
      key: "deck",
      kind: "FLASHCARDS",
      subjectCode: deck.subjectCode,
      title: deck.topicName,
      meta: `CARD ${deck.card} OF ${deck.cardCount}`,
      percent: wholePercent((deck.card / deck.cardCount) * 100),
      href: paths.memberApp.content("deck", deck.deckId),
      cta: "Continue",
      savedAt: deck.savedAt,
    });
  }
  if (reviewerPdf) {
    cards.push({
      key: "reviewer-pdf",
      kind: "REVIEWER",
      subjectCode: reviewerPdf.subjectCode,
      title: `${reviewerPdf.topicName} reviewer`,
      meta: `PAGE ${reviewerPdf.page} OF ${reviewerPdf.pageCount}`,
      percent: wholePercent((reviewerPdf.page / reviewerPdf.pageCount) * 100),
      href: paths.memberApp.content("reviewer-pdf", reviewerPdf.reviewerPdfId),
      cta: "Open",
      savedAt: reviewerPdf.savedAt,
    });
  }
  return cards.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Pure: whether any of the Exam's Topics has something to study yet. */
export const hasContent = (progress: MemberProgress) =>
  progress.subjects.some((subject) => subject.percent !== null);
