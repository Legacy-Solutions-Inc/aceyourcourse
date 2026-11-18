import { FormulaText } from "@/components/formula/formula-text";
import { WatermarkOverlay } from "@/components/watermark-overlay";
import type {
  AttemptReview as Review,
  RemovedQuestion,
  RevealedQuestion,
  ReviewedQuestion,
} from "@/lib/quizzes/grading";
import type { QuizChoice } from "@/lib/quizzes/quiz-rules";
import { cn } from "@/lib/utils";
import type { AttemptSummary } from "@/services/member.types";

/** What a question taken out of the quiz since the attempt says in its place (spec, Corrections never cost progress). */
export const REMOVED_SINCE = "This question has since been removed";

type Item = Review["questions"][number];

const isRevealed = (item: ReviewedQuestion | RevealedQuestion): item is RevealedQuestion =>
  "answer" in item;

/** A question's figure, from its signed URL in the private bucket. */
export function QuizFigure({
  src,
  number,
  className,
}: {
  src: string;
  /** The question's place in the attempt, from 1. */
  number: number;
  className?: string;
}) {
  return (
    // A signed URL from the private bucket: not for next/image's optimiser.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Figure for question ${number}`}
      className={cn("pointer-events-none max-w-full object-contain", className)}
    />
  );
}

/** An attempt's score as a heading: "8 / 10", the right answers large (mockup `score`). */
export function ScoreTally({ attempt, id }: { attempt: AttemptSummary; id: string }) {
  return (
    <h2 id={id} className="flex flex-wrap items-baseline gap-x-3">
      <span className="text-[clamp(56px,7vw,80px)] leading-[0.9] font-black tracking-[-0.04em]">
        {attempt.correctCount}
      </span>{" "}
      <span className="text-xl font-bold">/ {attempt.questionCount}</span>
    </h2>
  );
}

/** One choice as the review names it: its letter and text, such as "B · 11.46°". */
function ChoiceLine({
  label,
  letter,
  choices,
}: {
  label: string;
  letter: QuizChoice | null;
  choices: Record<QuizChoice, string>;
}) {
  return (
    <p className="text-[15px] leading-normal">
      <span className="font-bold">{label}:</span>{" "}
      {letter === null ? (
        "none"
      ) : (
        <>
          {letter} · <FormulaText text={choices[letter]} />
        </>
      )}
    </p>
  );
}

function CorrectedNote() {
  return (
    <p className="font-mono text-[11px] font-bold tracking-[0.04em] text-muted-foreground">
      CORRECTED SINCE YOU ANSWERED · YOUR SCORE STAYS AS IT WAS
    </p>
  );
}

/** A missed question in full: the question, the Member's answer and, when the quiz shows them, the answer and why. */
function MissedQuestion({ item }: { item: ReviewedQuestion | RevealedQuestion | RemovedQuestion }) {
  if (item.status === "removed") {
    return (
      <li className="border-[1.5px] border-dashed border-ayc-slate bg-ayc-paper p-4 text-[15px]">
        <span className="font-mono text-xs font-bold tracking-[0.06em]">Q{item.number}</span> ·{" "}
        {REMOVED_SINCE}
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-2 border-[1.5px] bg-white p-4 shadow-hard-sm">
      <p className="font-mono text-xs font-bold tracking-[0.06em] text-destructive">
        Q{item.number} · {item.chosen === null ? "UNANSWERED" : "INCORRECT"}
      </p>
      <FormulaText text={item.question} className="text-base font-bold" />
      {item.figureUrl ? (
        <QuizFigure src={item.figureUrl} number={item.number} className="max-h-48 self-start" />
      ) : null}
      <ChoiceLine label="Your answer" letter={item.chosen} choices={item.choices} />
      {isRevealed(item) ? (
        <>
          <ChoiceLine label="Correct" letter={item.answer} choices={item.choices} />
          <p className="border-t border-ayc-ruled pt-2 text-sm leading-normal text-muted-foreground">
            <FormulaText text={item.explanation} />
          </p>
          {item.correctedSince ? <CorrectedNote /> : null}
        </>
      ) : null}
    </li>
  );
}

const missedOf = (questions: readonly Item[]) => questions.filter((item) => !item.isCorrect);

/**
 * An attempt's review (story 99; mockup `score`): each missed question with
 * the Member's answer and, when the quiz shows answers after, the correct
 * answer and the explanation; then every answer, right or wrong. With
 * answers off it says which were missed and never the correct answer, which
 * the review it's given doesn't hold. A question removed since says so, and
 * nothing more. The score screen and a past attempt's page both show it,
 * with the Member's watermark over it and nothing in it selectable.
 */
export function AttemptReview({ review, watermark }: { review: Review; watermark: string }) {
  const missed = missedOf(review.questions);
  return (
    <div className="relative flex flex-col gap-5 select-none [-webkit-touch-callout:none]">
      <section aria-labelledby="missed-questions" className="flex flex-col gap-3">
        <h3
          id="missed-questions"
          className="font-mono text-xs font-bold tracking-[0.06em] text-ayc-blue"
        >
          MISSED · {missed.length}
        </h3>
        {review.showAnswers ? null : (
          <p className="text-[15px] leading-normal">
            This quiz doesn’t show the correct answers. Review the Topic and try again.
          </p>
        )}
        {missed.length === 0 ? (
          <p className="text-[15px] leading-normal">Nothing missed: every answer was right.</p>
        ) : (
          <ul aria-label="Missed questions" className="flex flex-col gap-3">
            {missed.map((item) => (
              <MissedQuestion key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="all-answers" className="flex flex-col gap-2">
        <h3
          id="all-answers"
          className="font-mono text-xs font-bold tracking-[0.06em] text-ayc-blue"
        >
          ALL ANSWERS · {review.questions.length}
        </h3>
        <ul aria-label="All answers" className="flex flex-col border-[1.5px] bg-white">
          {review.questions.map((item) => (
            <li
              key={item.id}
              className="flex items-baseline gap-3 border-b border-ayc-ruled px-3 py-2.5 text-sm last:border-b-0"
            >
              <span className="w-8 shrink-0 font-mono text-xs font-bold">Q{item.number}</span>
              {item.status === "removed" ? (
                <span className="text-muted-foreground">{REMOVED_SINCE}</span>
              ) : (
                <>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-xs font-bold",
                      item.isCorrect ? "text-ayc-success" : "text-destructive",
                    )}
                  >
                    {item.isCorrect ? "✓ RIGHT" : "✗ WRONG"}
                  </span>
                  <FormulaText text={item.question} className="min-w-0" />
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
      <WatermarkOverlay text={watermark} />
    </div>
  );
}

/** An attempt's score against the Best Score, and whether it passed (mockup `score`). */
export function ScoreLines({ attempt, bestScore }: { attempt: AttemptSummary; bestScore: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      <p className="border-[1.5px] bg-ayc-orange px-3 py-1.5 font-mono text-xs font-bold tracking-[0.04em] text-ayc-navy">
        {attempt.score}% · {attempt.score >= bestScore ? "BEST SO FAR" : `BEST IS ${bestScore}%`}
      </p>
      <p
        className={cn(
          "border-[1.5px] px-3 py-1.5 font-mono text-xs font-bold tracking-[0.04em]",
          attempt.passed ? "bg-ayc-blue text-ayc-cream" : "bg-white",
        )}
      >
        {attempt.passed ? "✓ PASSED" : "NOT PASSED"} · PASSING SCORE {attempt.passingScore}%
      </p>
    </div>
  );
}
