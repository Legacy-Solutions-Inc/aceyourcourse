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
import { paths } from "@/paths";
import type {
  AdminError,
  AdminQuiz,
  AdminQuizSettings,
  DeletedQuestion,
} from "@/services/admin.types";

import { ContentRow } from "./content-row";
import { ContentSwitch } from "./content-switch";
import { QuestionForm, type QuestionFormActions } from "./question-form";
import { useContentScreen } from "./use-content-screen";

export interface QuizEditorActions extends QuestionFormActions {
  saveQuizSettings: AdminAction<AdminQuizSettings>;
  saveQuizVisibility: AdminAction<AdminQuizSettings>;
  saveQuizFreePreview: AdminAction<AdminQuizSettings>;
  moveQuestionInQuiz: AdminAction<string[]>;
  removeQuestion: AdminAction<DeletedQuestion>;
}

interface QuizEditorProps {
  /** The Topic's quiz, read on the server for this render. */
  quiz: AdminQuiz;
  /** The question open in the form, or null for a new question. */
  selected: string | null;
  actions: QuizEditorActions;
}

export const ADD_A_QUESTION_FIRST =
  "ADD A QUESTION FIRST · A QUIZ NEEDS AT LEAST ONE QUESTION TO BE VISIBLE";
export const NOW_HIDDEN = "The quiz is now Hidden because it has no questions.";

/** What deleting a question does for Members, said before it's deleted. */
const DELETE_WARNING =
  "It leaves the quiz for new attempts. Members’ past attempts keep it, marked as removed, and their Best Scores stay as they are.";

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

/**
 * A Topic's quiz in Member App content (BUILD-MAP §3.6; stories 126–128):
 * the quiz's state (Visible or Hidden, Free Preview, how many questions),
 * its settings (passing score, shuffle, "show answers after"), and its
 * questions in order with Edit, ▲▼ and Delete, beside the question form
 * (ticket 10), as the deck screen has its cards. "Visible to members" can't
 * be turned on while the quiz has no questions, and deleting the last
 * question of a Visible quiz hides it, which the screen says. A Topic with
 * no quiz yet gets one with its first question, or from the quiz import. The
 * server enforces every rule and records each change in Staff Activity; this
 * screen only shows what it answered.
 */
export function QuizEditor({ quiz: screen, selected, actions }: QuizEditorProps) {
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
  const question = questions.find((candidate) => candidate.id === selected) ?? null;

  const after = useContentScreen({
    noun: "QUESTION",
    nowHidden: NOW_HIDDEN,
    pathOf: (item) => paths.admin.quiz(topic.id, item),
    openId: question?.id ?? null,
  });
  const deleted = ({ question: gone, quizHidden }: DeletedQuestion) =>
    after.deleted(gone, quizHidden);

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
            {topic.name} has no quiz yet. Write its first question below, or{" "}
            <Link
              href={paths.admin.quizImport(exam.code, subject.code)}
              className="font-semibold text-ayc-blue underline-offset-2 hover:underline"
            >
              import {subject.code}’s questions from a spreadsheet
            </Link>
            ; the quiz arrives Hidden.
          </p>
        )}
        <p role="status" className="text-sm font-semibold">
          {after.notice}
        </p>
      </section>

      {quiz ? (
        <SettingsForm key={quiz.id} settings={quiz} action={actions.saveQuizSettings} />
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section
          aria-labelledby="quiz-questions"
          className="flex min-w-0 flex-col gap-2 border-[1.5px] bg-ayc-paper p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="quiz-questions" className={`${LABEL} text-ayc-blue`}>
              QUESTIONS · {questions.length}
            </h3>
            <Link
              href={paths.admin.quiz(topic.id, "new")}
              className="inline-flex min-h-9 items-center border-[1.5px] bg-primary px-3 text-[13px] font-bold text-primary-foreground"
            >
              + Add question
            </Link>
          </div>
          {questions.length > 0 ? (
            <ol aria-label={`Questions in ${topic.name}`} className="flex flex-col">
              {questions.map((row, index) => (
                <ContentRow
                  key={`${row.id}:${row.position}`}
                  id={row.id}
                  noun="question"
                  position={row.position}
                  text={row.question}
                  href={paths.admin.quiz(topic.id, row.id)}
                  first={index === 0}
                  last={index === questions.length - 1}
                  current={row.id === question?.id}
                  move={actions.moveQuestionInQuiz}
                  remove={actions.removeQuestion}
                  deleteWarning={DELETE_WARNING}
                  onDeleted={deleted}
                >
                  <FormulaText text={row.question} />
                </ContentRow>
              ))}
            </ol>
          ) : (
            <p className="border border-dashed border-ayc-rule p-3.5 text-sm text-muted-foreground">
              No questions yet. Write the first one in the form, or{" "}
              <Link
                href={paths.admin.quizImport(exam.code, subject.code)}
                className="font-semibold text-ayc-blue underline-offset-2 hover:underline"
              >
                import them from a spreadsheet
              </Link>
              .
            </p>
          )}
          <p className="font-mono text-[10px] font-bold tracking-[0.04em] text-muted-foreground">
            ONE POINT PER QUESTION · MEMBERS NEVER SEE THE ANSWERS BEFORE THEY SUBMIT
          </p>
        </section>

        <section className="min-w-0 border-[1.5px] bg-ayc-paper p-4" aria-label="Question form">
          <QuestionForm
            key={question ? question.id : "new"}
            topicId={topic.id}
            question={question}
            figureSrc={question?.figure ? paths.admin.questionFigure(question.id) : null}
            actions={actions}
            onSaved={(saved, next) => after.saved(saved.id, next)}
          />
        </section>
      </div>
    </div>
  );
}
