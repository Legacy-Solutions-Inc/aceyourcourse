"use client";

import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { QuizActionState } from "@/app/app/(shell)/library/actions";
import { FormulaText } from "@/components/formula/formula-text";
import { WatermarkOverlay } from "@/components/watermark-overlay";
import { formatDateTime } from "@/lib/manila-time";
import type { ShownRefusal } from "@/lib/member-app/access";
import { QUIZ_CHOICES, type QuizChoice } from "@/lib/quizzes/quiz-rules";
import {
  answer,
  currentQuestion,
  goTo,
  move,
  type QuizSession,
  startQuiz,
  submission,
  unanswered,
} from "@/lib/quizzes/quiz-session";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type {
  AttemptSummary,
  QuizQuestion,
  QuizSubmitInput,
  ScoredAttempt,
  StudyQuiz,
} from "@/services/member.types";

import { AttemptReview, QuizFigure, ScoreLines, ScoreTally } from "./attempt-review";
import { ContentState } from "./content-state";
import { keptNote } from "./study-states";

/** The Server Action the quiz screen calls (src/app/app/(shell)/library/actions.ts). */
export interface QuizPlayerActions {
  submitQuiz: (input: QuizSubmitInput) => Promise<QuizActionState>;
}

export interface QuizPlayerProps {
  quizId: string;
  /** The Topic's name. */
  title: string;
  /** The mono label over the title, such as "MSTC · PRACTICE QUIZ". */
  crumb: string;
  /** The quiz as the page read it last: its questions never hold the correct choice. */
  quiz: StudyQuiz;
  /** The Member's email and short Member ID, tiled over every question. */
  watermark: string;
  examCode: string;
  /** Where Members ask AYC for access during the beta. */
  contactEmail: string;
  back: { href: string; label: string };
  actions: QuizPlayerActions;
}

/** The page is read again this long before its figure URLs stop working, for fresh ones. */
const REFRESH_EARLY = 60 * 1000;

const BUTTON = "min-h-12 cursor-pointer border-[1.5px] px-4.5 text-[15px] font-bold";
const PRIMARY = `${BUTTON} bg-primary text-primary-foreground disabled:cursor-default disabled:opacity-50`;
const MONO_LABEL = "font-mono text-[11px] font-bold tracking-[0.06em]";

type Screen =
  | { name: "start" }
  | { name: "taking"; session: QuizSession; questions: ReadonlyMap<string, QuizQuestion> }
  | { name: "scored"; scored: ScoredAttempt; previous: readonly AttemptSummary[] }
  | { name: "refused"; decision: ShownRefusal }
  /** The answers no longer match the quiz: it changed while the Member took it. */
  | { name: "changed" }
  /** The quiz is gone: deleted while the Member took it. */
  | { name: "gone" };

/**
 * The quiz screen (stories 98–100, 106 and 133k; mockups `quizStart`, `quiz`
 * and `score`): the start screen with the Member's Best Score and past
 * attempts; then one question at a time, with Back and Next and no time
 * limit, the questions shuffled afresh for each attempt when the quiz says
 * so; the questions left unanswered flagged before Submit; and the score
 * screen with its review. The server marks the answers: nothing here knows a
 * correct choice. Each attempt has its own id, so a Submit sent again after
 * a dropped connection saves it once. The Member's email and short Member ID
 * are tiled over each question, and nothing on the screen can be selected. A
 * refused Submit (the quiz hidden, the pass ended) shows why, in its place.
 */
export function QuizPlayer({
  quizId,
  title,
  crumb,
  quiz,
  watermark,
  examCode,
  contactEmail,
  back,
  actions,
}: QuizPlayerProps) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>({ name: "start" });
  const [flagging, setFlagging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Each question as the page read it last: a fresh read brings fresh figure URLs.
  const latest = useMemo(() => new Map(quiz.questions.map((q) => [q.id, q])), [quiz.questions]);

  const taking = screen.name === "taking";
  // Fresh figure URLs before these stop working, while an attempt is on: the
  // page reads the quiz again, and the attempt carries on as it started.
  useEffect(() => {
    if (!taking || !quiz.imagesExpireAt) return;
    const wait = Math.max(Date.parse(quiz.imagesExpireAt) - Date.now() - REFRESH_EARLY, 0);
    const timer = setTimeout(() => router.refresh(), wait);
    return () => clearTimeout(timer);
  }, [taking, quiz.imagesExpireAt, router]);

  function begin() {
    // The attempt keeps the questions as they are now; the server marks it
    // against the quiz as it is when it's submitted.
    const session = startQuiz({
      questionIds: quiz.questions.map((q) => q.id),
      shuffle: quiz.shuffle,
      attemptId: crypto.randomUUID(),
    });
    setFlagging(false);
    setScreen({ name: "taking", session, questions: latest });
  }

  /** Back to the start screen, reading the quiz again: a retake uses its questions as they are now. */
  function restart() {
    router.refresh();
    setScreen({ name: "start" });
  }

  function update(change: (session: QuizSession) => QuizSession) {
    setFlagging(false);
    setScreen((now) => (now.name === "taking" ? { ...now, session: change(now.session) } : now));
  }

  async function send(session: QuizSession) {
    setSubmitting(true);
    try {
      const state = await actions.submitQuiz(submission(session, quizId));
      if (state.status === "scored") {
        setScreen({ name: "scored", scored: state.scored, previous: quiz.attempts });
      } else if (state.status === "refused") {
        setScreen({ name: "refused", decision: state.decision });
      } else {
        setScreen(state.status === "mismatch" ? { name: "changed" } : { name: "gone" });
      }
    } catch (error) {
      // A redirect (a replaced device, a closed gate) isn't a failure: Next follows it.
      unstable_rethrow(error);
      toast("Couldn’t submit your answers. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function finish(session: QuizSession) {
    if (unanswered(session).length > 0) setFlagging(true);
    else void send(session);
  }

  return (
    <section
      aria-label={`${title} quiz`}
      className="flex flex-col gap-4 select-none [-webkit-touch-callout:none] wide:gap-5"
    >
      {screen.name === "start" ? (
        <QuizStart
          quizId={quizId}
          title={title}
          crumb={crumb}
          quiz={quiz}
          back={back}
          onStart={begin}
        />
      ) : screen.name === "taking" ? (
        <QuestionScreen
          title={title}
          session={screen.session}
          question={questionShown(screen, latest)}
          watermark={watermark}
          flagging={flagging}
          submitting={submitting}
          onAnswer={(choice) => update((session) => answer(session, choice))}
          onMove={(step) => update((session) => move(session, step))}
          onGoTo={(index) => update((session) => goTo(session, index))}
          onFinish={() => finish(screen.session)}
          onSubmitAnyway={() => void send(screen.session)}
        />
      ) : screen.name === "scored" ? (
        <ScoreScreen
          title={title}
          scored={screen.scored}
          watermark={watermark}
          previous={screen.previous}
          back={back}
          onRetake={restart}
        />
      ) : screen.name === "refused" ? (
        <>
          <h1 className="text-[clamp(22px,2.6vw,30px)] leading-[1.1] font-extrabold tracking-[-0.02em]">
            {title}
          </h1>
          <ContentState
            decision={screen.decision}
            kind="quiz"
            // What was saved shows when the quiz is opened again.
            keptNote={keptNote(screen.decision, null)}
            examCode={examCode}
            contactEmail={contactEmail}
            back={back}
          />
        </>
      ) : (
        <section
          aria-labelledby="quiz-not-saved"
          className="flex max-w-xl flex-col gap-3 border-[1.5px] border-dashed border-ayc-slate bg-ayc-paper p-5"
        >
          <h1 id="quiz-not-saved" className="text-[22px] leading-[1.15] font-extrabold">
            {title}
          </h1>
          {screen.name === "changed" ? (
            <>
              <p className="text-[15px] leading-normal">
                This quiz changed while you were taking it. Start again to see it as it is now.
              </p>
              <button type="button" onClick={restart} className={cn(PRIMARY, "self-start")}>
                Start again
              </button>
            </>
          ) : (
            <>
              <p className="text-[15px] leading-normal">
                This quiz isn’t here any more. Your attempt wasn’t saved.
              </p>
              <Link href={back.href} className={cn(PRIMARY, "flex items-center self-start")}>
                {back.label}
              </Link>
            </>
          )}
        </section>
      )}
    </section>
  );
}

/**
 * The current question as the attempt started with it, its figure from the
 * page's latest read (fresh URLs), so a read for figures never changes it.
 */
function questionShown(
  taking: Extract<Screen, { name: "taking" }>,
  latest: ReadonlyMap<string, QuizQuestion>,
): QuizQuestion | null {
  const id = currentQuestion(taking.session);
  const asStarted = taking.questions.get(id);
  if (!asStarted) return null;
  return { ...asStarted, figureUrl: latest.get(id)?.figureUrl ?? asStarted.figureUrl };
}

interface QuizStartProps {
  quizId: string;
  title: string;
  crumb: string;
  quiz: StudyQuiz;
  back: { href: string; label: string };
  onStart: () => void;
}

/** The start screen (mockup `quizStart`): what the quiz is, the Member's Best Score and past attempts, and Start. */
function QuizStart({ quizId, title, crumb, quiz, back, onStart }: QuizStartProps) {
  const facts: [string, string][] = [
    ["QUESTIONS", String(quiz.questions.length)],
    ["PASSING SCORE", `${quiz.passingScore}%`],
    ["YOUR BEST", quiz.bestScore === null ? "—" : `${quiz.bestScore}%`],
  ];
  return (
    <div className="mx-auto flex w-full max-w-160 flex-col gap-5 border-[1.5px] bg-ayc-paper p-5 shadow-hard wide:my-4 wide:p-8">
      <div className="flex flex-col gap-1">
        <p className={cn(MONO_LABEL, "text-ayc-blue")}>{crumb}</p>
        <h1 className="text-[clamp(26px,3vw,36px)] leading-[1.1] font-extrabold tracking-[-0.03em]">
          {title}
        </h1>
      </div>
      <ul aria-label="About this quiz" className="grid grid-cols-3 border-[1.5px] bg-white">
        {facts.map(([label, value]) => (
          <li key={label} className="flex flex-col gap-1 border-r-[1.5px] p-3 last:border-r-0">
            <span className={cn(MONO_LABEL, "text-muted-foreground")}>{label}</span>
            <span className="text-2xl font-black tracking-[-0.02em]">{value}</span>
          </li>
        ))}
      </ul>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] leading-normal">
        <li>One question at a time. You can go back before you submit.</li>
        <li>No time limit. Your best score counts toward your progress.</li>
        {quiz.shuffle ? <li>The questions come in a new order each time.</li> : null}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onStart}
          disabled={quiz.questions.length === 0}
          className={PRIMARY}
        >
          Start quiz
        </button>
        <Link href={back.href} className={cn(BUTTON, "flex items-center")}>
          {back.label}
        </Link>
      </div>
      {quiz.attempts.length > 0 ? (
        <AttemptList quizId={quizId} attempts={quiz.attempts} />
      ) : (
        <p className="font-mono text-xs text-muted-foreground">No attempts yet.</p>
      )}
    </div>
  );
}

/** The Member's attempts, newest first, each with its review (story 100). */
function AttemptList({
  quizId,
  attempts,
}: {
  quizId: string;
  attempts: readonly AttemptSummary[];
}) {
  return (
    <section aria-labelledby="your-attempts" className="flex flex-col gap-2">
      <h2 id="your-attempts" className={cn(MONO_LABEL, "text-ayc-blue")}>
        YOUR ATTEMPTS
      </h2>
      <ul aria-label="Your attempts" className="flex flex-col border-[1.5px] bg-white">
        {attempts.map((attempt) => {
          const when = formatDateTime(attempt.submittedAt);
          return (
            <li
              key={attempt.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-ayc-ruled px-3 py-2 text-sm last:border-b-0"
            >
              <span>
                {when} · <span className="font-bold">{attempt.score}%</span> ·{" "}
                {attempt.passed ? "PASSED" : "NOT PASSED"}
              </span>
              <Link
                href={paths.memberApp.quizAttempt(quizId, attempt.id)}
                aria-label={`Review your attempt of ${when}`}
                className="flex min-h-11 items-center px-2 font-semibold text-ayc-blue underline underline-offset-2"
              >
                Review
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface QuestionScreenProps {
  title: string;
  session: QuizSession;
  question: QuizQuestion | null;
  watermark: string;
  flagging: boolean;
  submitting: boolean;
  onAnswer: (choice: QuizChoice) => void;
  onMove: (step: -1 | 1) => void;
  onGoTo: (index: number) => void;
  onFinish: () => void;
  onSubmitAnyway: () => void;
}

/** One question (mockup `quiz`): its text and figure, four choices, Back and Next, and Finish at the end. */
function QuestionScreen({
  title,
  session,
  question,
  watermark,
  flagging,
  submitting,
  onAnswer,
  onMove,
  onGoTo,
  onFinish,
  onSubmitAnyway,
}: QuestionScreenProps) {
  const total = session.order.length;
  const number = session.index + 1;
  const last = number === total;
  const picked = session.answers[currentQuestion(session)] ?? null;
  const missing = unanswered(session);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h1 className="text-[clamp(22px,2.6vw,30px)] leading-[1.1] font-extrabold tracking-[-0.02em]">
          {title} · Practice quiz
        </h1>
        <span className="font-mono text-[13px] font-bold">
          QUESTION {number} / {total}
        </span>
      </div>
      <div aria-hidden="true" className="flex h-1.5 gap-[3px]">
        {session.order.map((id, index) => (
          <span
            key={id}
            className={cn(
              "flex-1",
              index === session.index
                ? "bg-ayc-orange"
                : session.answers[id]
                  ? "bg-ayc-blue"
                  : "bg-ayc-sand",
            )}
          />
        ))}
      </div>
      {question ? (
        <div className="relative mx-auto flex w-full max-w-160 min-w-0 flex-col gap-3 border-[1.5px] bg-white p-5 shadow-[8px_8px_0_-1.5px_var(--ayc-sand),8px_8px_0_0_var(--ayc-navy)] wide:p-6">
          <h2 id="quiz-question" className="text-lg leading-snug font-bold">
            <span className="sr-only">Question {number}: </span>
            <FormulaText text={question.question} />
          </h2>
          {question.figureUrl ? (
            <QuizFigure src={question.figureUrl} number={number} className="max-h-56 self-center" />
          ) : null}
          <div role="radiogroup" aria-labelledby="quiz-question" className="flex flex-col gap-2">
            {QUIZ_CHOICES.map((letter) => (
              <label
                key={letter}
                className="relative flex min-h-12 cursor-pointer items-center gap-3 border-[1.5px] bg-white px-3 py-2 text-[15px] has-checked:bg-ayc-blue has-checked:text-ayc-cream has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ayc-orange"
              >
                {/* Unseen, over the whole choice: tapping anywhere on it picks it. */}
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={letter}
                  checked={picked === letter}
                  onChange={() => onAnswer(letter)}
                  className="absolute inset-0 z-10 cursor-pointer appearance-none opacity-0"
                />
                <span className="flex size-8 shrink-0 items-center justify-center border-[1.5px] font-mono text-sm font-bold">
                  {letter}
                </span>
                <FormulaText text={question.choices[letter]} />
              </label>
            ))}
          </div>
          <WatermarkOverlay text={watermark} />
        </div>
      ) : null}
      {flagging && missing.length > 0 ? (
        <section
          aria-label="Unanswered questions"
          className="mx-auto flex w-full max-w-160 flex-col gap-3 border-[1.5px] border-destructive bg-ayc-paper p-4"
        >
          <p role="status" className={cn(MONO_LABEL, "text-destructive")}>
            {missing.length} {missing.length === 1 ? "QUESTION" : "QUESTIONS"} UNANSWERED ·
            UNANSWERED QUESTIONS COUNT AS WRONG
          </p>
          <div className="flex flex-wrap gap-2">
            {missing.map((place) => (
              <button
                key={place}
                type="button"
                onClick={() => onGoTo(place - 1)}
                className={cn(BUTTON, "min-h-11 px-3 text-sm")}
              >
                Go to question {place}
              </button>
            ))}
            <button
              type="button"
              onClick={onSubmitAnyway}
              disabled={submitting}
              className={cn(PRIMARY, "min-h-11 px-3 text-sm")}
            >
              Submit anyway
            </button>
          </div>
        </section>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2.5">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={session.index === 0}
          aria-label="Previous question"
          className={cn(BUTTON, "disabled:cursor-default disabled:opacity-40")}
        >
          <span aria-hidden="true">← Previous</span>
        </button>
        {last ? (
          <button
            type="button"
            onClick={onFinish}
            disabled={submitting}
            aria-busy={submitting}
            className={PRIMARY}
          >
            Finish quiz
          </button>
        ) : (
          <button type="button" onClick={() => onMove(1)} className={PRIMARY}>
            Next question <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
      <p className="text-center font-mono text-xs text-muted-foreground">
        No time limit. You can go back before you submit.
      </p>
    </>
  );
}

interface ScoreScreenProps {
  title: string;
  scored: ScoredAttempt;
  watermark: string;
  /** The Member's attempts before this one, newest first. */
  previous: readonly AttemptSummary[];
  back: { href: string; label: string };
  onRetake: () => void;
}

/** The score screen (mockup `score`): the score, pass or fail, the Best Score, then the review. */
function ScoreScreen({ title, scored, watermark, previous, back, onRetake }: ScoreScreenProps) {
  const { attempt, bestScore, review } = scored;
  return (
    <>
      <h1 className="text-[clamp(22px,2.6vw,30px)] leading-[1.1] font-extrabold tracking-[-0.02em]">
        {title} · Practice quiz
      </h1>
      <section
        aria-labelledby="quiz-score"
        className="mx-auto flex w-full max-w-160 flex-col gap-4 border-[1.5px] bg-ayc-paper p-5 shadow-[6px_6px_0_var(--ayc-blue)] wide:my-4 wide:p-8"
      >
        <p className={cn(MONO_LABEL, "text-ayc-blue")}>QUIZ COMPLETE · {title.toUpperCase()}</p>
        <ScoreTally attempt={attempt} id="quiz-score" />
        <ScoreLines attempt={attempt} bestScore={bestScore} />
        {previous.length > 0 ? (
          <p className="text-sm">
            Previous attempts: {previous.map((past) => `${past.score}%`).join(" · ")}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRetake} className={PRIMARY}>
            Retake quiz
          </button>
          <Link href={back.href} className={cn(BUTTON, "flex items-center")}>
            {back.label}
          </Link>
        </div>
      </section>
      <div className="mx-auto w-full max-w-160">
        <AttemptReview review={review} watermark={watermark} />
      </div>
    </>
  );
}
