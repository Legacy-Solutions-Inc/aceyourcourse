import Link from "next/link";

import {
  type MemberProgress,
  type StreakDay,
  type StudyStreak,
  type SubjectProgress,
  WEAK_AGAIN_MARKS,
  type WeakTopic,
} from "@/lib/member-app/progress";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { TargetExam } from "@/services/member.types";

import {
  hasContent,
  progressSummary,
  resumeCards,
  streakDayLabel,
  streakWords,
  subjectDetail,
  weakReason,
} from "./dashboard-view";
import { ExamCountdown } from "./exam-countdown";
import { ShareStreak } from "./shell-streak";

const SECTION_HEADING = "text-[clamp(20px,2.4vw,26px)] font-extrabold tracking-[-0.02em]";
const CARD_HOVER =
  "transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-none";

interface DashboardProps {
  /** The Member's selected Target Exam: the dashboard is per Exam. */
  exam: TargetExam;
  /** The time the page was made, for the countdown. */
  now: Date;
  /** The Member's progress in that Exam, and their Study Streak. */
  progress: MemberProgress;
}

/**
 * Home's dashboard (mockup `dashboard` L155–226, BUILD-MAP §3; stories
 * 88–92): the countdown and the Study Streak, then "Continue where you left
 * off", progress by Subject and the weakest Topics. Before any study in this
 * Exam it shows a starter card instead of zeros. Lessons come with Video
 * Courses (Phase 5), so nothing here mentions them yet.
 */
export function Dashboard({ exam, now, progress }: DashboardProps) {
  const { current, studiedToday } = progress.streak;
  const read = { current, studiedToday, readAt: now.getTime() };
  return (
    <>
      {/* The sidebar's streak button says the same streak as the card. */}
      <ShareStreak read={read} />
      <div className="flex flex-wrap gap-4.5">
        <ExamCountdown exam={exam} now={now} className="max-w-none flex-[1.2_1_300px]" />
        <StreakCard streak={progress.streak} />
      </div>
      {progress.started ? (
        <>
          <ContinueSection progress={progress} />
          <SubjectsSection progress={progress} />
          <WeakTopicsSection topics={progress.weakTopics} />
        </>
      ) : (
        <StarterSection exam={exam} progress={progress} />
      )}
    </>
  );
}

/** A streak day: studied, today while it isn't yet, or a day missed. */
type DayState = "studied" | "today" | "missed";

const dayState = (day: StreakDay, today: string): DayState =>
  day.studied ? "studied" : day.day === today ? "today" : "missed";

/** How each kind of streak day looks (mockup L178), and what a screen reader hears. */
const DAY_LOOKS: Record<DayState, { box: string; mark: string; said: string }> = {
  studied: { box: "bg-ayc-orange", mark: "✓", said: "studied" },
  today: { box: "border-dashed", mark: "", said: "not yet" },
  missed: { box: "border-ayc-rule", mark: "", said: "not studied" },
};

/** The streak card (mockup L174–181): the current streak, the last 7 days, and the best. */
function StreakCard({ streak }: { streak: StudyStreak }) {
  const { figure, headline, note } = streakWords(streak);
  return (
    <section
      aria-labelledby="streak-heading"
      className="flex min-w-0 flex-[1_1_260px] flex-col gap-3 border-[1.5px] bg-ayc-paper p-5"
    >
      <div className="flex items-baseline justify-between gap-2 font-mono text-[11px] font-bold tracking-[0.06em]">
        <h2 id="streak-heading" className="text-ayc-warning uppercase">
          Study streak
        </h2>
        <span className="text-muted-foreground">LAST 7 DAYS</span>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2.5">
        {figure === null ? null : (
          <span className="text-[clamp(48px,6vw,64px)] leading-[0.9] font-black tracking-[-0.04em]">
            {figure}
          </span>
        )}
        <span className={figure === null ? "text-[28px] font-extrabold" : "text-lg font-bold"}>
          {headline}
        </span>
      </p>
      <ol aria-label="Last 7 days" className="grid grid-cols-7 gap-1.5">
        {streak.lastSevenDays.map((day) => {
          const look = DAY_LOOKS[dayState(day, streak.today)];
          return (
            <li key={day.day} className="flex flex-col items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  "flex aspect-square w-full items-center justify-center border-[1.5px] font-mono text-[13px] font-bold",
                  look.box,
                )}
              >
                {look.mark}
              </span>
              <span className="font-mono text-[9px] font-medium text-muted-foreground">
                {streakDayLabel(day, streak.today)}
                <span className="sr-only">, {look.said}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-auto text-sm leading-[1.45]">{note}</p>
    </section>
  );
}

/** "Continue where you left off" (mockup L183–201): the last deck and Reviewer PDF, the latest first. */
function ContinueSection({ progress }: { progress: MemberProgress }) {
  const [hero, ...rest] = resumeCards(progress.resume);
  if (!hero) return null;
  return (
    <section aria-labelledby="continue-heading" className="flex flex-col gap-3">
      <h2 id="continue-heading" className={SECTION_HEADING}>
        Continue where you left off
      </h2>
      <div className="flex flex-wrap gap-3.5">
        <Link
          href={hero.href}
          className={cn(
            "flex flex-[2_1_360px] flex-col gap-3 border-[1.5px] bg-ayc-blue p-5 text-ayc-cream shadow-hard-md",
            CARD_HOVER,
          )}
        >
          <span className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-on-navy-soft">
            {hero.kind} · {hero.subjectCode}
          </span>
          <span className="text-[clamp(24px,3vw,34px)] leading-[1.05] font-extrabold tracking-[-0.025em]">
            {hero.title}
          </span>
          <span className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-2 flex-1 bg-ayc-cream/25">
              <span className="block h-full bg-ayc-orange" style={{ width: `${hero.percent}%` }} />
            </span>
            <span className="font-mono text-xs font-bold">{hero.meta}</span>
          </span>
          <span className="flex min-h-11 items-center self-start border-[1.5px] border-ayc-navy bg-ayc-orange px-4.5 text-[15px] font-extrabold text-ayc-navy">
            {hero.cta}
            <span aria-hidden="true">&nbsp;→</span>
          </span>
        </Link>
        {rest.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className={cn(
              "flex flex-[1_1_220px] flex-col gap-2 border-[1.5px] bg-ayc-paper p-4 shadow-hard",
              CARD_HOVER,
            )}
          >
            <span className="font-mono text-[11px] font-bold tracking-[0.05em] text-ayc-blue">
              {card.kind} · {card.subjectCode}
            </span>
            <span className="text-lg leading-tight font-bold">{card.title}</span>
            <span className="font-mono text-xs">{card.meta}</span>
            <span className="mt-auto text-sm font-bold text-ayc-warning">
              {card.cta}
              <span aria-hidden="true">&nbsp;→</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** A Subject's ring: its % as a filled arc, or a dash while it has nothing to study. */
function Ring({ percent }: { percent: number | null }) {
  return (
    <span
      className="flex size-21 flex-none items-center justify-center rounded-full border-[1.5px]"
      style={{
        background: `conic-gradient(var(--ayc-blue) ${(percent ?? 0) * 3.6}deg, var(--ayc-sand) 0)`,
      }}
    >
      <span className="flex size-15 items-center justify-center rounded-full border-[1.5px] bg-ayc-paper text-lg font-extrabold tracking-[-0.02em]">
        {percent === null ? "—" : `${percent}%`}
      </span>
    </span>
  );
}

/** "Progress by subject" (mockup L203–212): each Subject's %, opening its Library tab. */
function SubjectsSection({ progress }: { progress: MemberProgress }) {
  const summary = progressSummary(progress);
  return (
    <section aria-labelledby="subjects-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1.5">
        <h2 id="subjects-heading" className={SECTION_HEADING}>
          Progress by subject
        </h2>
        {summary ? (
          <p className="font-mono text-xs font-medium text-muted-foreground">{summary}</p>
        ) : null}
      </div>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))] gap-3.5">
        {progress.subjects.map((subject) => (
          <SubjectCard key={subject.code} subject={subject} />
        ))}
      </ul>
    </section>
  );
}

function SubjectCard({ subject }: { subject: SubjectProgress }) {
  return (
    <li className="flex">
      <Link
        href={paths.memberApp.librarySubject(subject.code)}
        className={cn(
          "flex flex-1 items-center gap-4 border-[1.5px] bg-ayc-paper px-4.5 py-4 shadow-hard",
          CARD_HOVER,
        )}
      >
        <Ring percent={subject.percent} />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-[13px] font-bold">{subject.code}</span>
          <span className="text-sm leading-tight font-semibold">{subject.name}</span>
          <span className="font-mono text-[11px] leading-snug text-muted-foreground">
            {subjectDetail(subject)}
          </span>
        </span>
      </Link>
    </li>
  );
}

const ROW_BUTTON =
  "flex min-h-11 items-center border-[1.5px] px-3.5 text-sm font-bold transition-colors motion-reduce:transition-none";

/** "Weak topics to review" (mockup L214–224): the 3 weakest, lowest first, or that there are none. */
function WeakTopicsSection({ topics }: { topics: readonly WeakTopic[] }) {
  return (
    <section aria-labelledby="weak-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1.5">
        <h2 id="weak-heading" className={SECTION_HEADING}>
          Weak topics to review
        </h2>
        <p className="font-mono text-xs font-medium text-muted-foreground">
          BASED ON YOUR QUIZ SCORES AND CARD MARKS
        </p>
      </div>
      {topics.length > 0 ? (
        <ul className="flex flex-col border-[1.5px] bg-ayc-paper">
          {topics.map((topic) => (
            <li
              key={topic.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-ayc-rule px-4 py-3.5 last:border-b-0"
            >
              <span className="bg-primary px-1.5 py-1.5 font-mono text-xs leading-none font-bold text-primary-foreground">
                {topic.subjectCode}
              </span>
              <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
                <span className="text-base font-bold">{topic.name}</span>
                <span className="font-mono text-[11px] font-medium text-muted-foreground">
                  {weakReason(topic)}
                </span>
              </span>
              <span className="font-mono text-[15px] font-bold whitespace-nowrap text-destructive">
                {topic.percent}%<span className="text-[11px]"> DONE</span>
              </span>
              <span className="flex gap-2">
                {topic.cards ? (
                  <Link
                    href={paths.memberApp.content("deck", topic.cards.deckId)}
                    className={cn(ROW_BUTTON, "hover:bg-ayc-sand")}
                  >
                    Review cards<span className="sr-only"> in {topic.name}</span>
                  </Link>
                ) : null}
                {topic.quiz ? (
                  <Link
                    href={paths.memberApp.content("quiz", topic.quiz.quizId)}
                    className={cn(
                      ROW_BUTTON,
                      "bg-primary text-primary-foreground hover:bg-ayc-blue",
                    )}
                  >
                    {topic.quiz.attempts > 0 ? "Retake quiz" : "Take quiz"}
                    <span className="sr-only"> in {topic.name}</span>
                  </Link>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-[1.5px] border-dashed border-ayc-slate p-4 text-[15px] leading-normal">
          No weak Topics right now. A Topic shows up here when its Best Score is below the passing
          score, or {WEAK_AGAIN_MARKS} or more of its cards are marked Review again.
        </p>
      )}
    </section>
  );
}

/** Before any study in this Exam: where to start, instead of zeros everywhere. */
function StarterSection({ exam, progress }: { exam: TargetExam; progress: MemberProgress }) {
  return (
    <section
      aria-labelledby="start-heading"
      className="flex max-w-xl flex-col gap-2.5 border-[1.5px] border-ayc-blue bg-ayc-paper p-5"
    >
      <h2 id="start-heading" className="text-xl font-extrabold tracking-[-0.02em]">
        Start studying {exam.examCode}
      </h2>
      <p className="text-[15px] leading-normal">
        {hasContent(progress)
          ? "Your progress, your weak Topics and where you left off show up here as you study: mark a card, take a quiz or read a Reviewer PDF page."
          : `${exam.examCode}’s flashcards, quizzes and Reviewer PDFs are still being prepared. They show up in the Library automatically.`}
      </p>
      <Link
        href={paths.memberApp.library}
        className="flex min-h-11 items-center self-start border-[1.5px] bg-primary px-4 text-sm font-bold text-primary-foreground"
      >
        Open the Library<span aria-hidden="true">&nbsp;→</span>
      </Link>
    </section>
  );
}

/** The dashboard while it loads (mockup `loading` L493–501): skeleton blocks, and what's loading. */
export function DashboardLoading() {
  const pulse =
    "animate-pulse border-[1.5px] border-ayc-star-off bg-ayc-sand motion-reduce:animate-none";
  return (
    <>
      <div aria-hidden="true" className="flex flex-wrap gap-4.5">
        <span className={cn(pulse, "h-55 flex-[1.2_1_300px]")} />
        <span className="grid flex-[1_1_280px] grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
          <span className={cn(pulse, "h-30")} />
          <span className={cn(pulse, "h-30")} />
          <span className={cn(pulse, "h-30")} />
        </span>
      </div>
      <div
        aria-hidden="true"
        className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-3.5"
      >
        <span className={cn(pulse, "h-30")} />
        <span className={cn(pulse, "h-30")} />
        <span className={cn(pulse, "h-30")} />
      </div>
      <p
        role="status"
        className="text-center font-mono text-xs font-medium tracking-[0.06em] text-muted-foreground"
      >
        LOADING YOUR DASHBOARD…
      </p>
    </>
  );
}
