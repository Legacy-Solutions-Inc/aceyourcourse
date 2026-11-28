import { addCalendarDays as addDays, manilaDate } from "@/lib/manila-time";
import type {
  CardMark,
  DeckPosition,
  QuizAttemptScore,
  ReaderPosition,
  ReviewerPageView,
} from "@/services/content.types";

// ─────────────────────────────────────────────────────────────────────────────
// The progress calculator (spec, Phase 3 → Progress calculator, Progress
// storage, Corrections never cost progress; CONTEXT.md → Studying; stories
// 90–93), pure. It reads one Member's current-state records (the latest Card
// Mark per card, each Quiz Attempt's score, the Reviewer PDF pages viewed,
// the deck and reader places, the Study Days) against an Exam's content, and
// gives every number the dashboard and the Library show:
//   - Topic %: the mean of the components the Topic has (the share of its
//     cards marked Got it, its quiz's Best Score, the share of its Reviewer
//     PDF's pages viewed). A component it lacks isn't a 0; a quiz the Member
//     hasn't taken is.
//   - Hidden decks and quizzes, Reviewer PDFs that aren't Published, and
//     content with nothing in it yet (no cards, questions or pages) count
//     nowhere.
//   - Lessons (Phase 5, ticket 04) stay out of every %: they show as counts
//     ("9 lessons", "9 / 32 LESSONS") over the Courses the Member can open,
//     and the last one watched shows in "Continue where you left off".
// Percentages are whole numbers, rounded down, so nothing reads 100% before
// it's done.
// ─────────────────────────────────────────────────────────────────────────────

/** A Topic's deck, as the calculator reads it: its cards' ids, in order. */
export interface ProgressDeck {
  id: string;
  /** Visible. */
  available: boolean;
  cardIds: readonly string[];
}

/** A Topic's quiz, as the calculator reads it. */
export interface ProgressQuiz {
  id: string;
  /** Visible. */
  available: boolean;
  /** Its passing score now, a whole percentage. */
  passingScore: number;
  /** How many questions it has now (removed ones aside). */
  questionCount: number;
}

/** A Topic's Reviewer PDF, as the calculator reads it. */
export interface ProgressReviewerPdf {
  id: string;
  /** Published. */
  available: boolean;
  /** The pages a Member can read: all of them once split, else 0. */
  pageCount: number;
}

export interface ProgressTopic {
  id: string;
  name: string;
  /** Its place in its Subject, from 1. */
  position: number;
  deck: ProgressDeck | null;
  quiz: ProgressQuiz | null;
  reviewerPdf: ProgressReviewerPdf | null;
}

/** One of an Exam's Subjects, with every Topic in order, Hidden and Draft content too. */
export interface ProgressSubject {
  code: string;
  name: string;
  topics: readonly ProgressTopic[];
}

/** One Member's study records, as the calculator reads them. */
export interface ProgressRecords {
  cardMarks: readonly Pick<CardMark, "cardId" | "verdict" | "markedAt">[];
  quizScores: readonly Pick<QuizAttemptScore, "quizId" | "score" | "submittedAt">[];
  pageViews: readonly Pick<ReviewerPageView, "reviewerPdfId" | "page">[];
  deckPositions: readonly Pick<DeckPosition, "deckId" | "cardId" | "savedAt">[];
  readerPositions: readonly Pick<ReaderPosition, "reviewerPdfId" | "page" | "savedAt">[];
  /** Their progress in Lessons, any Exam's (only the Courses given count). */
  lessonProgress: readonly LessonRecord[];
  /** Asia/Manila dates, YYYY-MM-DD. */
  studyDays: readonly string[];
}

/** A Topic's progress on its deck: how many of its cards the Member last marked Got it, or Review again. */
export interface CardsProgress {
  deckId: string;
  total: number;
  got: number;
  again: number;
}

/** A Topic's progress on its quiz. */
export interface QuizProgress {
  quizId: string;
  /** The highest score of the Member's attempts, or null before the first. */
  bestScore: number | null;
  passingScore: number;
  attempts: number;
}

/** A Topic's progress on its Reviewer PDF. */
export interface PagesProgress {
  reviewerPdfId: string;
  total: number;
  viewed: number;
}

/** One Topic's progress. Each component is null when the Topic has nothing of that kind to study. */
export interface TopicProgress {
  id: string;
  name: string;
  position: number;
  /** Whole % done, or null while the Topic has nothing to study. */
  percent: number | null;
  cards: CardsProgress | null;
  quiz: QuizProgress | null;
  pages: PagesProgress | null;
  /**
   * A Weak Topic (CONTEXT.md): its Best Score is below its quiz's passing
   * score, or 5 or more of its cards are marked Review again.
   */
  weak: boolean;
}

/** Cards marked Review again that make a Topic weak. */
export const WEAK_AGAIN_MARKS = 5;

/** Pure: a whole percentage, rounded down (past floating-point dust: 29/100 is 29). */
export const wholePercent = (exact: number) => Math.floor(exact + 1e-9);

/** Pure: each card's latest verdict, by card id. */
function latestVerdicts(cardMarks: ProgressRecords["cardMarks"]): Map<string, CardMark["verdict"]> {
  const latest = new Map<string, Pick<CardMark, "verdict" | "markedAt">>();
  for (const mark of cardMarks) {
    const kept = latest.get(mark.cardId);
    if (!kept || mark.markedAt > kept.markedAt) latest.set(mark.cardId, mark);
  }
  return new Map([...latest].map(([cardId, mark]) => [cardId, mark.verdict]));
}

function cardsProgress(
  deck: ProgressDeck | null,
  verdicts: Map<string, CardMark["verdict"]>,
): CardsProgress | null {
  if (!deck?.available || deck.cardIds.length === 0) return null;
  const marked = deck.cardIds.map((cardId) => verdicts.get(cardId));
  return {
    deckId: deck.id,
    total: deck.cardIds.length,
    got: marked.filter((verdict) => verdict === "got").length,
    again: marked.filter((verdict) => verdict === "again").length,
  };
}

function quizProgress(
  quiz: ProgressQuiz | null,
  scores: ProgressRecords["quizScores"],
): QuizProgress | null {
  if (!quiz?.available || quiz.questionCount === 0) return null;
  const taken = scores.filter((attempt) => attempt.quizId === quiz.id).map(({ score }) => score);
  return {
    quizId: quiz.id,
    bestScore: taken.length > 0 ? Math.max(...taken) : null,
    passingScore: quiz.passingScore,
    attempts: taken.length,
  };
}

function pagesProgress(
  pdf: ProgressReviewerPdf | null,
  pageViews: ProgressRecords["pageViews"],
): PagesProgress | null {
  if (!pdf?.available || pdf.pageCount === 0) return null;
  const viewed = new Set(
    pageViews
      .filter(
        (view) => view.reviewerPdfId === pdf.id && view.page >= 1 && view.page <= pdf.pageCount,
      )
      .map((view) => view.page),
  );
  return { reviewerPdfId: pdf.id, total: pdf.pageCount, viewed: viewed.size };
}

/** Pure: the exact % done of a Topic's components, or null with none. */
function exactPercent({ cards, quiz, pages }: Pick<TopicProgress, "cards" | "quiz" | "pages">) {
  const shares = [
    cards ? (cards.got / cards.total) * 100 : null,
    quiz ? (quiz.bestScore ?? 0) : null,
    pages ? (pages.viewed / pages.total) * 100 : null,
  ].filter((share): share is number => share !== null);
  return shares.length > 0 ? shares.reduce((sum, share) => sum + share, 0) / shares.length : null;
}

/** One Topic measured: its progress, and its exact %, which orders the Weak Topics. */
interface MeasuredTopic {
  progress: TopicProgress;
  exact: number | null;
}

function measureTopic(
  topic: ProgressTopic,
  records: ProgressRecords,
  verdicts: Map<string, CardMark["verdict"]>,
): MeasuredTopic {
  const components = {
    cards: cardsProgress(topic.deck, verdicts),
    quiz: quizProgress(topic.quiz, records.quizScores),
    pages: pagesProgress(topic.reviewerPdf, records.pageViews),
  };
  const exact = exactPercent(components);
  return {
    progress: {
      id: topic.id,
      name: topic.name,
      position: topic.position,
      percent: exact === null ? null : wholePercent(exact),
      ...components,
      weak: isWeak(components),
    },
    exact,
  };
}

/** Pure: one Topic's progress from the Member's records. */
export function topicProgress(topic: ProgressTopic, records: ProgressRecords): TopicProgress {
  return measureTopic(topic, records, latestVerdicts(records.cardMarks)).progress;
}

/** Pure: whether a Topic's components make it a Weak Topic. */
function isWeak({ cards, quiz }: Pick<TopicProgress, "cards" | "quiz">): boolean {
  const belowPassing = quiz?.bestScore != null && quiz.bestScore < quiz.passingScore;
  return belowPassing || (cards?.again ?? 0) >= WEAK_AGAIN_MARKS;
}

// ── An Exam's progress ──────────────────────────────────────────────────────

/** How many of a set of cards the Member last marked Got it. */
export interface CardsGot {
  got: number;
  total: number;
}

/** How many of a set of Reviewer PDF pages the Member viewed. */
export interface PagesRead {
  viewed: number;
  total: number;
}

/** One Subject's progress, with each of its Topics'. */
export interface SubjectProgress {
  code: string;
  name: string;
  /** The mean of its Topics' % over those with something to study, or null with none. */
  percent: number | null;
  cards: CardsGot;
  /** The Reviewer PDF pages viewed, of those Published. */
  pages: PagesRead;
  /** The mean of the Best Scores over its quizzes taken, or null before the first. */
  quizAverage: number | null;
  quizzesTaken: number;
  /** The Lessons done, of the Published ones in its Courses the Member can open. */
  lessons: LessonsDone;
  topics: TopicProgress[];
}

/** A Weak Topic, with its Subject. */
export interface WeakTopic extends TopicProgress {
  subjectCode: string;
}

/** The deck the Member left last, and the card they were on. */
export interface DeckResume {
  deckId: string;
  subjectCode: string;
  topicName: string;
  /** The card's place in the deck, from 1. */
  card: number;
  cardCount: number;
  /** ISO time the place was saved. */
  savedAt: string;
}

/** The Reviewer PDF the Member left last, and the page they were on. */
export interface ReaderResume {
  reviewerPdfId: string;
  subjectCode: string;
  topicName: string;
  page: number;
  pageCount: number;
  /** ISO time the place was saved. */
  savedAt: string;
}

/** The Lesson the Member watched last and hasn't done, and where its video picks up. */
export interface LessonResumePlace {
  courseId: string;
  lessonId: string;
  /** Its Course's Subject. */
  subjectCode: string;
  title: string;
  /** Where the video picks up, in seconds. */
  position: number;
  /** Its length, in seconds. */
  seconds: number;
  /** ISO time it was last watched. */
  savedAt: string;
}

/** "Continue where you left off": each null when there's no place in a Visible or Published one. */
export interface ResumePlaces {
  deck: DeckResume | null;
  reviewerPdf: ReaderResume | null;
  /** In a Course the Member can open now. */
  lesson: LessonResumePlace | null;
}

/**
 * A Member's progress in one Exam, and their Study Streak (account-wide):
 * what the dashboard shows, and the Member detail page can.
 */
export interface MemberProgress {
  /** Whether the Member has any progress in this Exam, or a place to continue. */
  started: boolean;
  cards: CardsGot;
  /** The Reviewer PDF pages viewed, of those Published. */
  pages: PagesRead;
  /** The mean of the Best Scores over the quizzes taken, or null before the first. */
  quizAverage: number | null;
  quizzesTaken: number;
  /** The Lessons done, of the Published ones in the Exam's Courses the Member can open. */
  lessons: LessonsDone;
  subjects: SubjectProgress[];
  /** The weakest Topics, at most 3, lowest % first. */
  weakTopics: WeakTopic[];
  resume: ResumePlaces;
  streak: StudyStreak;
}

/** How many Weak Topics the dashboard shows. */
export const WEAK_TOPICS_SHOWN = 3;

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/** Pure: the mean as a whole percentage, or null for none. */
const meanPercent = (values: readonly number[]) =>
  values.length > 0 ? wholePercent(sum(values) / values.length) : null;

/** Pure: the Best Scores of the quizzes taken among these Topics. */
const bestScores = (topics: readonly TopicProgress[]) =>
  topics.flatMap(({ quiz }) => (quiz?.bestScore == null ? [] : [quiz.bestScore]));

const cardsGot = (topics: readonly TopicProgress[]): CardsGot => ({
  got: sum(topics.map(({ cards }) => cards?.got ?? 0)),
  total: sum(topics.map(({ cards }) => cards?.total ?? 0)),
});

const pagesRead = (topics: readonly TopicProgress[]): PagesRead => ({
  viewed: sum(topics.map(({ pages }) => pages?.viewed ?? 0)),
  total: sum(topics.map(({ pages }) => pages?.total ?? 0)),
});

/** Pure: the latest of some saved places, by the time saved. */
const latest = <T extends { savedAt: string }>(places: readonly T[]): T | null =>
  places.reduce<T | null>(
    (last, place) => (!last || place.savedAt > last.savedAt ? place : last),
    null,
  );

function resumeOf(subjects: readonly ProgressSubject[], records: ProgressRecords): ResumePlaces {
  const placed = subjects.flatMap((subject) =>
    subject.topics.map((topic) => ({ subjectCode: subject.code, topic })),
  );
  const decks = records.deckPositions.flatMap((position): DeckResume[] => {
    const found = placed.find(({ topic }) => topic.deck?.id === position.deckId);
    const deck = found?.topic.deck;
    const card = deck?.available ? deck.cardIds.indexOf(position.cardId) + 1 : 0;
    if (!found || !deck || card === 0) return [];
    return [
      {
        deckId: deck.id,
        subjectCode: found.subjectCode,
        topicName: found.topic.name,
        card,
        cardCount: deck.cardIds.length,
        savedAt: position.savedAt,
      },
    ];
  });
  const pdfs = records.readerPositions.flatMap((position): ReaderResume[] => {
    const found = placed.find(({ topic }) => topic.reviewerPdf?.id === position.reviewerPdfId);
    const pdf = found?.topic.reviewerPdf;
    if (!found || !pdf?.available || position.page < 1 || position.page > pdf.pageCount) return [];
    return [
      {
        reviewerPdfId: pdf.id,
        subjectCode: found.subjectCode,
        topicName: found.topic.name,
        page: position.page,
        pageCount: pdf.pageCount,
        savedAt: position.savedAt,
      },
    ];
  });
  return { deck: latest(decks), reviewerPdf: latest(pdfs), lesson: null };
}

/**
 * Pure: a Member's progress in one Exam (its Subjects, in order, with every
 * Topic) from their records, and their Study Streak at `now`. `courses` are
 * the Exam's Courses the Member can open now, each with its Published
 * Lessons in order: the Lesson counts and the Lesson to continue come from
 * them alone, so progress in a Course they can't open (access ended) is kept
 * but not counted, and counts again once they can.
 */
export function memberProgress(
  subjects: readonly ProgressSubject[],
  records: ProgressRecords,
  now: Date,
  courses: readonly ProgressCourse[] = [],
): MemberProgress {
  const watched = lessonsWatched(courses, records.lessonProgress);
  const verdicts = latestVerdicts(records.cardMarks);
  const measured = subjects.map((subject) => ({
    subject,
    // In the Library's order, which also orders Weak Topics at the same %.
    topics: [...subject.topics]
      .sort((a, b) => a.position - b.position)
      .map((topic) => measureTopic(topic, records, verdicts)),
  }));

  const subjectProgress = measured.map(({ subject, topics }): SubjectProgress => {
    const progress = topics.map((topic) => topic.progress);
    const scored = topics.flatMap(({ exact }) => (exact === null ? [] : [exact]));
    const best = bestScores(progress);
    return {
      code: subject.code,
      name: subject.name,
      percent: meanPercent(scored),
      cards: cardsGot(progress),
      pages: pagesRead(progress),
      quizAverage: meanPercent(best),
      quizzesTaken: best.length,
      lessons: lessonsDone(watched.filter((lesson) => lesson.subjectCode === subject.code)),
      topics: progress,
    };
  });

  const weakTopics = measured
    .flatMap(({ subject, topics }) =>
      topics
        .filter(({ progress }) => progress.weak)
        .map(({ progress, exact }) => ({
          topic: { ...progress, subjectCode: subject.code },
          exact,
        })),
    )
    // A stable sort: Topics at the same % stay in the Library's order.
    .sort((a, b) => (a.exact ?? 0) - (b.exact ?? 0))
    .slice(0, WEAK_TOPICS_SHOWN)
    .map(({ topic }) => topic);

  const topics = subjectProgress.flatMap(({ topics: inSubject }) => inSubject);
  const best = bestScores(topics);
  const resume = { ...resumeOf(subjects, records), lesson: lessonToContinue(watched) };
  const studied = topics.some(
    ({ cards, quiz, pages: read }) =>
      (cards && cards.got + cards.again > 0) ||
      (quiz && quiz.attempts > 0) ||
      (read && read.viewed > 0),
  );

  return {
    started:
      studied ||
      watched.some(({ record }) => record !== null) ||
      resume.deck !== null ||
      resume.reviewerPdf !== null,
    cards: cardsGot(topics),
    pages: pagesRead(topics),
    quizAverage: meanPercent(best),
    quizzesTaken: best.length,
    lessons: lessonsDone(watched),
    subjects: subjectProgress,
    weakTopics,
    resume,
    streak: studyStreak(records.studyDays, now),
  };
}

// ── Lessons (Phase 5, ticket 04) ────────────────────────────────────────────

/** One Member's progress in one Lesson, as the calculator reads it. */
export interface LessonRecord {
  lessonId: string;
  /** Where the video picks up, in whole seconds. */
  position: number;
  /** The furthest point reached, in whole seconds. */
  furthest: number;
  /** ISO time it was done, or null while it isn't. Done stays done. */
  doneAt: string | null;
  /** ISO time it was last watched. */
  watchedAt: string;
}

/** A Course the Member can open, with its Published Lessons in order. */
export interface ProgressCourse {
  id: string;
  subjectCode: string;
  lessons: readonly { id: string; title: string; seconds: number }[];
}

/** How many Lessons are done, of how many. */
export interface LessonsDone {
  done: number;
  total: number;
}

/** The share of a Lesson's length that marks it done once the furthest point reaches it. */
export const LESSON_DONE_SHARE = 0.9;

/**
 * Pure: whether the furthest point reached marks a Lesson of this length
 * done: at 90% of its length or past it (in whole tenths, so 899 of 1,000
 * isn't and 900 is). A Lesson with no length never is.
 */
export const reachesDone = (furthest: number, seconds: number): boolean =>
  seconds > 0 && furthest * 10 >= seconds * LESSON_DONE_SHARE * 10;

/**
 * Pure: a Lesson's record after a position save at `at`: the position, the
 * furthest point reached, done once that reaches 90% of the length (skipping
 * ahead included, since "Mark complete" is one tap away anyway). Done stays
 * done, keeping when it was first done. The caller has checked the position
 * is within the length.
 */
export function lessonAfterSaving(
  before: LessonRecord | null,
  lessonId: string,
  position: number,
  seconds: number,
  at: string,
): LessonRecord {
  const furthest = Math.max(before?.furthest ?? 0, position);
  return {
    lessonId,
    position,
    furthest,
    doneAt: before?.doneAt ?? (reachesDone(furthest, seconds) ? at : null),
    watchedAt: at,
  };
}

/** Pure: a Lesson's record after "Mark complete" at `at`: done, where it picks up unchanged. */
export function lessonAfterCompleting(
  before: LessonRecord | null,
  lessonId: string,
  at: string,
): LessonRecord {
  return {
    lessonId,
    position: before?.position ?? 0,
    furthest: before?.furthest ?? 0,
    doneAt: before?.doneAt ?? at,
    watchedAt: at,
  };
}

/** Where a Lesson's video starts when it's opened. */
export type LessonResume =
  /** At the saved position: "You stopped here 2 days ago. The video picks up at 12:40." */
  | { state: "resume"; from: number; savedAt: string }
  /** From the beginning, once done: "You finished this lesson. Watch it again anytime." */
  | { state: "finished"; from: 0 }
  /** From the beginning, never watched (or saved at 0:00). */
  | { state: "start"; from: 0 };

/** Pure: where a Lesson starts for the Member: a done one from 0, else at the saved position. */
export function lessonResume(record: LessonRecord | null): LessonResume {
  if (record?.doneAt) return { state: "finished", from: 0 };
  if (record && record.position > 0) {
    return { state: "resume", from: record.position, savedAt: record.watchedAt };
  }
  return { state: "start", from: 0 };
}

/** Pure: the Study Day a Lesson save at `at` makes: its Asia/Manila date. */
export const lessonStudyDay = (at: Date): string => manilaDate(at);

/** A Course's Published Lesson, with the Member's record of it. */
interface WatchedLesson {
  courseId: string;
  subjectCode: string;
  lesson: ProgressCourse["lessons"][number];
  record: LessonRecord | null;
}

/** Pure: every Published Lesson of these Courses, in order, with the Member's record of it. */
function lessonsWatched(
  courses: readonly ProgressCourse[],
  records: readonly LessonRecord[],
): WatchedLesson[] {
  const byLesson = new Map(records.map((record) => [record.lessonId, record]));
  return courses.flatMap((course) =>
    course.lessons.map((lesson) => ({
      courseId: course.id,
      subjectCode: course.subjectCode,
      lesson,
      record: byLesson.get(lesson.id) ?? null,
    })),
  );
}

const lessonsDone = (watched: readonly WatchedLesson[]): LessonsDone => ({
  done: watched.filter(({ record }) => record?.doneAt).length,
  total: watched.length,
});

/** Pure: the Lessons watched and not done, the last one watched first. */
const inFlight = (watched: readonly WatchedLesson[]) =>
  watched
    .filter(({ record }) => record !== null && record.doneAt === null)
    .sort((a, b) => (b.record?.watchedAt ?? "").localeCompare(a.record?.watchedAt ?? ""));

function lessonToContinue(watched: readonly WatchedLesson[]): LessonResumePlace | null {
  const [last] = inFlight(watched);
  if (!last?.record) return null;
  return {
    courseId: last.courseId,
    lessonId: last.lesson.id,
    subjectCode: last.subjectCode,
    title: last.lesson.title,
    position: last.record.position,
    seconds: last.lesson.seconds,
    savedAt: last.record.watchedAt,
  };
}

/** A Course card's progress: "9 / 32", and the Lesson "Continue" opens, if any. */
export interface CourseLessons extends LessonsDone {
  continueLesson: { id: string; title: string } | null;
}

/**
 * Pure: a Course's Lessons done, and where "Continue" goes: the Lesson
 * watched last that isn't done, or else the first not done once some are;
 * none before any watching, or once every Lesson is done.
 */
export function courseLessons(
  course: ProgressCourse,
  records: readonly LessonRecord[],
): CourseLessons {
  const watched = lessonsWatched([course], records);
  const counts = lessonsDone(watched);
  const next =
    inFlight(watched)[0] ??
    (counts.done > 0 ? watched.find(({ record }) => !record?.doneAt) : undefined);
  return {
    ...counts,
    continueLesson: next ? { id: next.lesson.id, title: next.lesson.title } : null,
  };
}

// ── The Study Streak ────────────────────────────────────────────────────────

/** One of the last 7 days, and whether it was a Study Day. */
export interface StreakDay {
  /** The Asia/Manila date, YYYY-MM-DD. */
  day: string;
  studied: boolean;
}

/** A Member's Study Streak (CONTEXT.md): account-wide, never per Exam. */
export interface StudyStreak {
  /** Consecutive Study Days ending today, or yesterday while today isn't one yet. */
  current: number;
  /** The longest run of consecutive Study Days, ever. */
  best: number;
  /** Today in Asia/Manila, YYYY-MM-DD. */
  today: string;
  studiedToday: boolean;
  /** The last 7 days, oldest first, ending today. */
  lastSevenDays: StreakDay[];
  /** The latest Study Day, or null before the first. */
  lastStudyDay: string | null;
}

/**
 * Pure: the Study Streak from a Member's Study Days (Asia/Manila dates), at
 * `now`, whose Manila date is today. A run ending yesterday is still current
 * until today ends; a day with no study breaks it. A day after today (a
 * clock's error) never counts.
 */
export function studyStreak(studyDays: readonly string[], now: Date): StudyStreak {
  const today = manilaDate(now);
  const days = new Set(studyDays.filter((day) => day <= today));
  const sorted = [...days].sort();

  let best = 0;
  let run = 0;
  sorted.forEach((day, index) => {
    run = index > 0 && addDays(sorted[index - 1] ?? day, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
  });

  const studiedToday = days.has(today);
  let current = 0;
  for (let day = studiedToday ? today : addDays(today, -1); days.has(day); day = addDays(day, -1)) {
    current += 1;
  }

  return {
    current,
    best,
    today,
    studiedToday,
    lastSevenDays: [6, 5, 4, 3, 2, 1, 0].map((back) => {
      const day = addDays(today, -back);
      return { day, studied: days.has(day) };
    }),
    lastStudyDay: sorted.at(-1) ?? null,
  };
}
