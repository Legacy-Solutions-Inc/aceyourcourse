"use client";

import { type FormEvent, useId, useRef, useState } from "react";

import { callAdminAction } from "@/components/admin/call-admin-action";
import { FormulaText } from "@/components/formula/formula-text";
import type { AdminAction } from "@/lib/admin/action";
import { renderFormula } from "@/lib/formula/render";
import { type QuestionField, questionFieldProblems } from "@/lib/quizzes/question-fields";
import { QUESTION_TEXT_LIMITS, QUIZ_CHOICES, type QuizChoice } from "@/lib/quizzes/quiz-rules";
import { cn } from "@/lib/utils";
import type { AdminQuestion } from "@/services/admin.types";
import type { ContentUploadTicket } from "@/services/uploads.types";

import {
  FormulaTextField,
  ImageField,
  SaveFooter,
  useContentSave,
  useImageUpload,
} from "./content-form-parts";

export interface QuestionFormActions {
  /** A one-time upload URL for a figure, in the private content bucket. */
  createFigureUpload: AdminAction<ContentUploadTicket>;
  addQuestion: AdminAction<AdminQuestion>;
  saveQuestion: AdminAction<AdminQuestion>;
}

interface QuestionFormProps {
  topicId: string;
  /** The question being edited, or null for a new one. */
  question: AdminQuestion | null;
  /** Where the browser loads the question's saved figure from, when it has one. */
  figureSrc: string | null;
  actions: QuestionFormActions;
  /** After a save: the question, and whether the Editor asked for the next one. */
  onSaved: (question: AdminQuestion, next: boolean) => void;
}

type Choices = Record<QuizChoice, string>;

const EMPTY_CHOICES: Choices = { A: "", B: "", C: "", D: "" };
const GONE = "THAT QUESTION OR TOPIC IS GONE · RELOAD THE PAGE";
const LABEL = "font-mono text-[11px] font-bold tracking-[0.06em]";
const FIELDS: readonly (QuestionField | "figure")[] = [
  "question",
  ...QUIZ_CHOICES.map((choice) => `choices.${choice}` as const),
  "correct",
  "explanation",
  "figure",
];

/** The correct choice: four radios, A–D, with the message when none is picked. */
function CorrectChoice({
  value,
  error,
  onChange,
}: {
  value: QuizChoice | null;
  error?: string;
  onChange: (choice: QuizChoice) => void;
}) {
  const id = useId();
  return (
    <fieldset
      aria-describedby={error ? `${id}-error` : undefined}
      className="flex min-w-0 flex-col gap-1.5"
    >
      <legend className="mb-1.5 font-mono text-xs font-medium text-muted-foreground">
        CORRECT CHOICE
      </legend>
      <div className="flex flex-wrap gap-2">
        {QUIZ_CHOICES.map((choice) => (
          <label
            key={choice}
            className={cn(
              "flex min-h-10 min-w-12 cursor-pointer items-center justify-center gap-1.5 border-[1.5px] bg-white px-3 font-mono text-sm font-bold has-checked:border-ayc-success has-checked:text-ayc-success",
              error && "border-destructive",
            )}
          >
            <input
              type="radio"
              name={`${id}-correct`}
              value={choice}
              checked={value === choice}
              onChange={() => onChange(choice)}
              className="size-4 accent-[var(--color-ayc-success)]"
            />
            {choice}
          </label>
        ))}
      </div>
      {error ? (
        <p id={`${id}-error`} className="font-mono text-[11px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/**
 * The question as Members will see it, with the maths rendered: the question,
 * its figure and the four choices, then, as after scoring, the correct choice
 * marked and the explanation. Text that won't render shows as typed, and the
 * form lists why under it.
 */
function QuestionPreview({
  question,
  choices,
  correct,
  explanation,
  figureSrc,
}: {
  question: string;
  choices: Choices;
  correct: QuizChoice | null;
  explanation: string;
  figureSrc: string | null;
}) {
  const placeholder = (text: string) => (
    <span className="text-sm text-muted-foreground italic">{text}</span>
  );
  return (
    <div className="flex min-w-0 flex-col gap-2.5 border-[1.5px] bg-white p-3.5">
      <div className="min-w-0 text-sm font-semibold">
        {question.trim() ? <FormulaText text={question} /> : placeholder("The question shows here")}
      </div>
      {figureSrc ? (
        // A chosen file's own preview, or the Staff-only route to the private bucket.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={figureSrc}
          alt="Figure for the question"
          className="max-h-60 w-fit max-w-full border border-ayc-rule object-contain"
        />
      ) : null}
      <ol aria-label="Choices" className="flex flex-col gap-1">
        {QUIZ_CHOICES.map((choice) => {
          const isCorrect = choice === correct;
          return (
            <li
              key={choice}
              className={cn(
                "flex items-start gap-2 border px-2.5 py-1.5 text-sm",
                // Green on white keeps the label's contrast above 4.5:1.
                isCorrect ? "border-[1.5px] border-ayc-success" : "border-ayc-ruled",
              )}
            >
              <span className="font-mono text-xs font-bold">{choice}</span>
              <FormulaText text={choices[choice]} className="min-w-0 flex-1" />
              {isCorrect ? (
                <span className="font-mono text-[10px] font-bold text-ayc-success">✓ CORRECT</span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-col gap-0.5 text-[13px]">
        <span className={`${LABEL} text-muted-foreground`}>EXPLANATION · SHOWN AFTER SCORING</span>
        {explanation.trim() ? (
          <FormulaText text={explanation} />
        ) : (
          placeholder("The explanation shows here")
        )}
      </div>
    </div>
  );
}

/**
 * The question form (ticket 10; story 125), the card form's twin: the
 * question, four choices A–D and the explanation in the formula notation, the
 * correct choice, an optional figure, and a live preview with the maths
 * rendered. A formula that won't render is shown in the preview and refused
 * on save, as are an empty field and no correct choice. "Save" opens the
 * saved question; "Save & add next" clears the form for the next one. The
 * browser checks each field and the figure first, uploads a new figure
 * straight to the private content bucket, and the server checks it all
 * again, with the conflict check on an edit.
 */
export function QuestionForm({
  topicId,
  question,
  figureSrc,
  actions,
  onSaved,
}: QuestionFormProps) {
  const [text, setText] = useState(question?.question ?? "");
  const [choices, setChoices] = useState<Choices>(
    question ? { ...question.choices } : EMPTY_CHOICES,
  );
  const [correct, setCorrect] = useState<QuizChoice | null>(question?.correct ?? null);
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const form = useContentSave<AdminQuestion, QuestionField | "figure">({
    noun: "QUESTION",
    gone: GONE,
    fields: FIELDS,
    opened: question?.stamp,
  });
  const { errors, setErrors } = form;
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const { image, setImage, choose, upload, shownSrc } = useImageUpload(
    question?.figure ?? null,
    actions.createFigureUpload,
    (problem) =>
      setErrors(({ figure: _, ...rest }) => (problem ? { ...rest, figure: problem } : rest)),
  );

  const previewProblems = [
    ["The question", text],
    ...QUIZ_CHOICES.map((choice) => [`Choice ${choice}`, choices[choice]] as const),
    ["The explanation", explanation],
  ].flatMap(([name, value]) => {
    const rendered = renderFormula(value ?? "");
    return rendered.ok ? [] : [`${name} ${rendered.problem}`];
  });

  function setChoice(choice: QuizChoice, value: string) {
    setChoices((current) => ({ ...current, [choice]: value }));
  }

  function save(next: boolean) {
    form.save({
      next,
      problems: questionFieldProblems({ question: text, choices, correct, explanation }),
      send: async (expected) => {
        const uploaded = await upload();
        if (!uploaded.ok) return null;
        const fields = { question: text, choices, correct, explanation, figure: uploaded.path };
        return question
          ? callAdminAction(actions.saveQuestion, {
              input: { id: question.id, ...fields },
              expected,
            })
          : callAdminAction(actions.addQuestion, { input: { topic: topicId, ...fields } });
      },
      onSaved: (saved) => {
        if (next) {
          setText("");
          setChoices(EMPTY_CHOICES);
          setCorrect(null);
          setExplanation("");
          setImage({ kind: "none" });
          questionRef.current?.focus();
        } else {
          setImage(saved.figure ? { kind: "saved", path: saved.figure } : { kind: "none" });
        }
        onSaved(saved, next);
      },
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save(false);
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-label={question ? `Question ${question.position}` : "New question"}
      className="flex min-w-0 flex-col gap-3"
    >
      <h3 className={`${LABEL} text-ayc-blue`}>
        {question ? `QUESTION ${question.position}` : "NEW QUESTION"}
      </h3>
      <FormulaTextField
        name="question"
        label="QUESTION"
        hint="e.g. The degree of curve for $R = 200$ m is…"
        limit={QUESTION_TEXT_LIMITS.question}
        value={text}
        error={errors.question}
        onChange={setText}
        inputRef={questionRef}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {QUIZ_CHOICES.map((choice) => (
          <FormulaTextField
            key={choice}
            name={`choice-${choice}`}
            label={`CHOICE ${choice}`}
            hint={`Choice ${choice}`}
            limit={QUESTION_TEXT_LIMITS.choice}
            rows={2}
            value={choices[choice]}
            error={errors[`choices.${choice}`]}
            onChange={(value) => setChoice(choice, value)}
          />
        ))}
      </div>
      <CorrectChoice value={correct} error={errors.correct} onChange={setCorrect} />
      <FormulaTextField
        name="explanation"
        label="EXPLANATION"
        hint="Why the correct choice is right, e.g. $T = R \tan(I/2)$"
        limit={QUESTION_TEXT_LIMITS.explanation}
        value={explanation}
        error={errors.explanation}
        onChange={setExplanation}
      />
      <ImageField
        id={`${topicId}-question-figure`}
        legend="FIGURE · OPTIONAL"
        noun="figure"
        hint="Members see it under the question."
        image={image}
        error={errors.figure}
        onChoose={choose}
        onRemove={() => setImage({ kind: "none" })}
      />

      <section aria-labelledby={`${topicId}-question-preview`} className="flex flex-col gap-2">
        <h4 id={`${topicId}-question-preview`} className={`${LABEL} text-muted-foreground`}>
          PREVIEW · AS MEMBERS SEE IT
        </h4>
        <QuestionPreview
          question={text}
          choices={choices}
          correct={correct}
          explanation={explanation}
          figureSrc={shownSrc(figureSrc)}
        />
        <div aria-live="polite">
          {previewProblems.map((problem) => (
            <p key={problem} className="font-mono text-[11px] font-medium text-destructive">
              {problem}
            </p>
          ))}
        </div>
      </section>

      <SaveFooter what="this question" form={form} onNext={() => save(true)} />
    </form>
  );
}
