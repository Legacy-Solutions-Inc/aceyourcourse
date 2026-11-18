"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminSwitch } from "@/components/admin/admin-switch";
import { ConflictNotice } from "@/components/admin/conflict-notice";
import { EditorSaveRow } from "@/components/admin/editor-save-row";
import { TextField, ToggleRow } from "@/components/admin/products/product-fields";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { useInstantSave } from "@/components/admin/use-instant-save";
import { FormulaText } from "@/components/formula/formula-text";
import type { AdminAction } from "@/lib/admin/action";
import {
  quizSettingsFormValues,
  type QuizSettingsValues,
  quizStateLine,
} from "@/lib/admin/quiz-settings-form";
import { QUIZ_CHOICES } from "@/lib/quizzes/quiz-rules";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type {
  AdminError,
  AdminQuestion,
  AdminQuiz,
  AdminQuizSettings,
} from "@/services/admin.types";

import { ContentSwitch } from "./content-switch";

export interface QuizEditorActions {
  saveQuizSettings: AdminAction<AdminQuizSettings>;
  saveQuizVisibility: AdminAction<AdminQuizSettings>;
  saveQuizFreePreview: AdminAction<AdminQuizSettings>;
}

interface QuizEditorProps {
  /** The Topic's quiz, read on the server for this render. */
  quiz: AdminQuiz;
  actions: QuizEditorActions;
}

export const ADD_A_QUESTION_FIRST =
  "ADD A QUESTION FIRST · A QUIZ NEEDS AT LEAST ONE QUESTION TO BE VISIBLE";

const LABEL = "font-mono text-[11px] font-bold tracking-[0.06em]";
const SAVED = "✓ SAVED · MEMBERS’ NEXT ATTEMPT USES THESE";
const INVALID = "FIX THE FIELDS MARKED IN RED";

/** Pure: what a refused toggle says, as a toast. */
const settingRefusal = (error: AdminError) =>
  error.kind === "invalid" && error.formError
    ? error.formError
    : error.kind === "not-found"
      ? "That quiz is gone. Reload the page."
      : "The quiz wasn’t changed. Reload the page and try again.";

/** The settings form: passing score, shuffle and "show answers after", saved together with the conflict check. */
function SettingsForm({
  settings,
  action,
}: {
  settings: AdminQuizSettings;
  action: QuizEditorActions["saveQuizSettings"];
}) {
  const [stamp, setStamp] = useState(settings.stamp);
  const form = useAdminForm<QuizSettingsValues, AdminQuizSettings>({
    action,
    initialValues: quizSettingsFormValues(settings),
    savedAt: stamp.savedAt,
    valuesFrom: quizSettingsFormValues,
    onSaved: (saved) => setStamp(saved.stamp),
    title: "The quiz settings",
    invalidMessage: INVALID,
  });
  const { values, change, fieldError } = form;

  return (
    <form
      aria-labelledby="quiz-settings"
      className="flex min-w-0 flex-col gap-3.5 border-[1.5px] bg-ayc-paper p-4"
      {...form.formProps}
    >
      <h3 id="quiz-settings" className={`${LABEL} text-ayc-blue`}>
        SETTINGS
      </h3>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(0,1fr)] sm:items-start">
        <TextField
          label="PASSING SCORE (%)"
          value={values.passingScore}
          inputMode="numeric"
          onChange={(score) => change("passingScore", score)}
          error={fieldError("passingScore")}
          aside={<span className="font-mono text-[11px] text-muted-foreground">1–100</span>}
        />
        <ToggleRow label="Shuffle questions" hint="A new order on every attempt.">
          {(ids) => (
            <AdminSwitch
              {...ids}
              checked={values.shuffle}
              onCheckedChange={(shuffle) => change("shuffle", shuffle)}
            />
          )}
        </ToggleRow>
        <ToggleRow
          label="Show answers after"
          hint="Each missed question’s answer and explanation, once scored."
        >
          {(ids) => (
            <AdminSwitch
              {...ids}
              checked={values.showAnswers}
              onCheckedChange={(showAnswers) => change("showAnswers", showAnswers)}
            />
          )}
        </ToggleRow>
      </div>
      {form.conflict ? <ConflictNotice {...form.conflict} what="this quiz’s settings" /> : null}
      <EditorSaveRow saveLabel="Save settings" savedMessage={SAVED} form={form} />
    </form>
  );
}

/** One question as Members will see it, with its correct choice marked. */
function QuestionItem({ question }: { question: AdminQuestion }) {
  return (
    <li className="flex flex-col gap-2.5 border-b border-ayc-ruled py-3.5 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className="font-mono text-xs font-bold text-ayc-blue">
          {String(question.position).padStart(2, "0")}
        </span>
        <FormulaText text={question.question} className="min-w-0 flex-1 text-sm font-semibold" />
      </div>
      {question.figure ? (
        // A Staff-only route serves it from the private bucket; it's never public.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={paths.admin.questionFigure(question.id)}
          alt={`Figure for question ${question.position}`}
          className="max-h-60 w-fit max-w-full border border-ayc-rule object-contain"
        />
      ) : null}
      <ol aria-label={`Choices for question ${question.position}`} className="flex flex-col gap-1">
        {QUIZ_CHOICES.map((choice) => {
          const correct = choice === question.correct;
          return (
            <li
              key={choice}
              className={cn(
                "flex items-start gap-2 border px-2.5 py-1.5 text-sm",
                // Green on the paper background, which keeps the label's contrast above 4.5:1.
                correct ? "border-[1.5px] border-ayc-success" : "border-ayc-ruled",
              )}
            >
              <span className="font-mono text-xs font-bold">{choice}</span>
              <FormulaText text={question.choices[choice]} className="min-w-0 flex-1" />
              {correct ? (
                <span className="font-mono text-[10px] font-bold text-ayc-success">✓ CORRECT</span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-col gap-0.5 text-[13px]">
        <span className={`${LABEL} text-muted-foreground`}>EXPLANATION</span>
        <FormulaText text={question.explanation} />
      </div>
    </li>
  );
}

/**
 * A Topic's quiz in Member App content (BUILD-MAP §3.6; stories 126–128):
 * the quiz's state (Visible or Hidden, Free Preview, how many questions),
 * its settings (passing score, shuffle, "show answers after"), and its
 * questions in order, as Members will see them. "Visible to members" can't
 * be turned on while the quiz has no questions. A Topic with no quiz yet
 * points to the quiz import. The server enforces every rule and records each
 * change in Staff Activity; this screen only shows what it answered. The
 * question editor (ticket 10) adds editing here.
 */
export function QuizEditor({ quiz: screen, actions }: QuizEditorProps) {
  const { exam, subject, topic, quiz, questions } = screen;
  const visibility = useInstantSave(actions.saveQuizVisibility, {
    what: `${topic.name} quiz`,
    kept: "The switch is back as it was.",
    refused: settingRefusal,
  });
  const freePreview = useInstantSave(actions.saveQuizFreePreview, {
    what: `${topic.name} quiz`,
    kept: "The switch is back as it was.",
    refused: settingRefusal,
  });
  const visible = quiz?.visibility === "visible";

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section
        aria-labelledby="quiz-title"
        className="flex min-w-0 flex-col gap-3 border-[1.5px] bg-ayc-paper p-4.5"
      >
        <div className="flex flex-col gap-0.5">
          <h2 id="quiz-title" className="text-lg font-bold">
            {topic.name} quiz
          </h2>
          <p className={`${LABEL} text-ayc-blue`}>
            {quizStateLine({ exam: exam.code, subject: subject.code }, questions.length, quiz)}
          </p>
        </div>
        {quiz ? (
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <ContentSwitch
              label="Visible to members"
              description={
                visible
                  ? "Members see this quiz in the Library."
                  : "Hidden: Members don’t see this quiz."
              }
              checked={visible}
              disabledReason={!visible && questions.length === 0 ? ADD_A_QUESTION_FIRST : null}
              pending={visibility.pending}
              onChange={(checked) => visibility.save({ quiz: quiz.id, visible: checked })}
            />
            <ContentSwitch
              label="Free Preview"
              description="Members with no Access Pass can take it while it’s Visible."
              checked={quiz.freePreview}
              disabledReason={null}
              pending={freePreview.pending}
              onChange={(checked) => freePreview.save({ quiz: quiz.id, freePreview: checked })}
            />
          </div>
        ) : (
          <p className="border border-dashed border-ayc-rule p-3.5 text-sm">
            {topic.name} has no quiz yet.{" "}
            <Link
              href={paths.admin.quizImport(exam.code, subject.code)}
              className="font-semibold text-ayc-blue underline-offset-2 hover:underline"
            >
              Import {subject.code}’s questions from a spreadsheet
            </Link>
            ; the quiz arrives Hidden.
          </p>
        )}
      </section>

      {quiz ? (
        <SettingsForm key={quiz.id} settings={quiz} action={actions.saveQuizSettings} />
      ) : null}

      {quiz ? (
        <section
          aria-labelledby="quiz-questions"
          className="flex min-w-0 flex-col gap-1 border-[1.5px] bg-ayc-paper p-4"
        >
          <h3 id="quiz-questions" className={`${LABEL} text-ayc-blue`}>
            QUESTIONS · {questions.length}
          </h3>
          {questions.length > 0 ? (
            <ol aria-label={`Questions in ${topic.name}`} className="flex flex-col">
              {questions.map((question) => (
                <QuestionItem key={question.id} question={question} />
              ))}
            </ol>
          ) : (
            <p className="border border-dashed border-ayc-rule p-3.5 text-sm text-muted-foreground">
              No questions yet.{" "}
              <Link
                href={paths.admin.quizImport(exam.code, subject.code)}
                className="font-semibold text-ayc-blue underline-offset-2 hover:underline"
              >
                Import them from a spreadsheet
              </Link>
              .
            </p>
          )}
          <p className="font-mono text-[10px] font-bold tracking-[0.04em] text-muted-foreground">
            ONE POINT PER QUESTION · MEMBERS NEVER SEE THE ANSWERS BEFORE THEY SUBMIT
          </p>
        </section>
      ) : null}
    </div>
  );
}
