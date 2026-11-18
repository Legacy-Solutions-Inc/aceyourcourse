import { z } from "zod";

import {
  invalidInput,
  quizFreePreviewInputSchema,
  type QuizSettingsForm,
  quizSettingsFormSchema,
  quizVisibilityInputSchema,
  roleRefusal,
} from "@/services/admin.schema";
import type {
  AdminError,
  AdminQuestion,
  AdminQuiz,
  AdminQuizSettings,
  AdminResult,
  CardImageFile,
  RecordStamp,
  StaffActivity,
  StaffActor,
} from "@/services/admin.types";
import { visibilityRefusal } from "@/services/content.rules";
import type { ContentVisibility, Question, Quiz, Topic } from "@/services/content.types";
import { nextStamp } from "@/services/mock/sample-store";
import type { ContentFiles } from "@/services/uploads";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's quiz screen (Phase 3, ticket 09; spec, Phase 3 → Content
// model; stories 126–128), shared by both arms: each arm gives a
// QuizEditorStore (how it reads one Topic's quiz and its questions, and saves
// a change to it all or nothing), and this module does the rest the same way
// for both. Any Staff User, Editor or Owner, may use it. The question editor
// (ticket 10) adds its writes here.
//
// Each write, in order:
//   1. checks the actor's Staff Role, and validates its input with zod,
//   2. saves under the content write lock, where the quiz is read again and
//      every rule runs on it as it is then: the settings form's conflict
//      check against the stamp it opened with, and Visible refused while the
//      quiz has no questions, with one Staff Activity record (entity "quiz")
//      and, for the settings, the quiz's new stamp.
// The settings form saves its three fields together, with the conflict
// check; Visible and Free Preview are single toggles, which always save, as
// a deck's do. Nothing cached reads quizzes, so no write returns a cache tag.
// ─────────────────────────────────────────────────────────────────────────────

/** One Topic, where it is, its quiz (or none), and the questions in it, in order. */
export interface TopicQuiz {
  exam: { code: string; name: string };
  subject: { code: string; name: string };
  topic: Topic;
  quiz: Quiz | null;
  /** The questions in the quiz, in order; removed ones left out. */
  questions: Question[];
  /** The quiz's settings' last save, or null when nobody has saved them. */
  stamp: RecordStamp | null;
  /** When the data was made: the stamp of settings nobody has saved. */
  seededAt: string;
}

/** Which quiz: a Topic's, a question's, or the quiz itself. */
export type QuizKey = { topic: string } | { question: string } | { quiz: string };

/** Everything a write changes, worked out on the quiz as it is under the lock. */
export interface QuizWrites {
  /** The quiz with its new settings. */
  quiz: Quiz;
  /** The quiz's settings' new stamp, when the write sets one. */
  stamp?: RecordStamp;
  activity: StaffActivity[];
}

/** A write's answer on the quiz as it is: refused, or its value and what it changes (null: nothing). */
export type QuizPlan<T> =
  { ok: false; error: AdminError } | { ok: true; value: T; writes: QuizWrites | null };

/** How an arm reads a Topic's quiz and saves a change to it. */
export interface QuizEditorStore {
  /** The quiz, with its Topic and questions, or null when the key names nothing. */
  read(key: QuizKey): Promise<TopicQuiz | null>;
  /** The private content bucket. */
  files: ContentFiles;
  /**
   * Holds off every other content write, reads the quiz again, and saves the
   * writes `plan` works out on it, all or nothing. Gives plan's answer.
   * Throws when the save fails.
   */
  save<T>(key: QuizKey, plan: (current: TopicQuiz | null) => QuizPlan<T>): Promise<QuizPlan<T>>;
}

/** A quiz's settings' record in the save stamps. */
export const quizRecordOf = (quizId: string) => `quiz:${quizId}`;

// ── Pure helpers ────────────────────────────────────────────────────────────

const NOT_FOUND: { ok: false; error: AdminError } = { ok: false, error: { kind: "not-found" } };
const refused = (error: AdminError): { ok: false; error: AdminError } => ({ ok: false, error });
const formError = (message: string): AdminError => ({
  kind: "invalid",
  fieldErrors: {},
  formError: message,
});

/** Pure: the quiz's settings' stamp: their last save, or the data's, when nobody has saved them. */
const stampOf = (quiz: TopicQuiz): RecordStamp =>
  quiz.stamp ?? { savedAt: quiz.seededAt, savedBy: null };

const settingsOf = (quiz: Quiz, stamp: RecordStamp): AdminQuizSettings => ({
  id: quiz.id,
  visibility: quiz.visibility,
  freePreview: quiz.freePreview,
  passingScore: quiz.passingScore,
  shuffle: quiz.shuffle,
  showAnswers: quiz.showAnswers,
  stamp,
});

const adminQuestionOf = (question: Question): AdminQuestion => ({
  id: question.id,
  position: question.position ?? 0,
  question: question.question,
  choices: { ...question.choices },
  correct: question.correct,
  explanation: question.explanation,
  figure: question.figure,
});

/** Pure: the quiz screen's read. */
export function adminQuizOf(quiz: TopicQuiz): AdminQuiz {
  return {
    exam: quiz.exam,
    subject: quiz.subject,
    topic: { id: quiz.topic.id, name: quiz.topic.name, position: quiz.topic.position },
    quiz: quiz.quiz ? settingsOf(quiz.quiz, stampOf(quiz)) : null,
    questions: quiz.questions.map(adminQuestionOf),
  };
}

/** The settings form's fields, as Staff Activity keeps them. */
const formFieldsOf = ({ passingScore, shuffle, showAnswers }: Quiz) => ({
  passingScore,
  shuffle,
  showAnswers,
});

function activity(
  actor: StaffActor,
  now: Date,
  quizId: string,
  action: string,
  before: unknown,
  after: unknown,
): StaffActivity {
  return {
    id: crypto.randomUUID(),
    at: now.toISOString(),
    actor: { email: actor.email, name: actor.name },
    entity: "quiz",
    entityId: quizId,
    action,
    before: structuredClone(before),
    after: structuredClone(after),
  };
}

const uuid = z.string().uuid();

// ── The seam's calls ────────────────────────────────────────────────────────

/** The quiz screen's calls, on an arm's store. */
export function quizEditorCalls(store: QuizEditorStore) {
  /** Step 1: the role check and the input. */
  function begin<Schema extends z.ZodTypeAny>(
    actor: StaffActor,
    schema: Schema,
    input: unknown,
  ): { ok: true; value: z.output<Schema> } | { ok: false; error: AdminError } {
    const refusal = roleRefusal(actor, "staff");
    if (refusal) return refused(refusal);
    const parsed = schema.safeParse(input);
    return parsed.success ? { ok: true, value: parsed.data } : refused(invalidInput(parsed.error));
  }

  /** Step 2: saves under the lock, and answers with what the plan gave. */
  async function saved<T>(
    key: QuizKey,
    plan: (current: TopicQuiz | null) => QuizPlan<T>,
  ): Promise<AdminResult<T>> {
    const planned = await store.save(key, plan);
    return planned.ok ? { ok: true, value: planned.value, tags: [] } : planned;
  }

  async function getQuizForAdmin(_actor: StaffActor, topicId: string): Promise<AdminQuiz | null> {
    if (!uuid.safeParse(topicId).success) return null;
    const quiz = await store.read({ topic: topicId });
    return quiz ? adminQuizOf(quiz) : null;
  }

  async function getQuestionFigureForAdmin(
    _actor: StaffActor,
    questionId: string,
  ): Promise<CardImageFile | null> {
    if (!uuid.safeParse(questionId).success) return null;
    const quiz = await store.read({ question: questionId });
    const figure = quiz?.questions.find((question) => question.id === questionId)?.figure;
    return figure ? store.files.read(figure) : null;
  }

  async function updateQuizSettings(
    actor: StaffActor,
    input: QuizSettingsForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminQuizSettings>> {
    const form = begin(actor, quizSettingsFormSchema, input);
    if (!form.ok) return form;
    const { id, passingScore, shuffle, showAnswers } = form.value;
    const now = new Date();
    return saved({ quiz: id }, (current): QuizPlan<AdminQuizSettings> => {
      if (!current?.quiz) return NOT_FOUND;
      const stamp = stampOf(current);
      if (expected && expected.savedAt !== stamp.savedAt) {
        return refused({ kind: "conflict", ...stamp });
      }
      const quiz: Quiz = { ...current.quiz, passingScore, shuffle, showAnswers };
      const before = formFieldsOf(current.quiz);
      const after = formFieldsOf(quiz);
      // Nothing changed: nothing to save or record, and the form's stamp stays good.
      if (JSON.stringify(before) === JSON.stringify(after)) {
        return { ok: true, value: settingsOf(current.quiz, stamp), writes: null };
      }
      const next = nextStamp(stamp, actor.name, now);
      return {
        ok: true,
        value: settingsOf(quiz, next),
        writes: {
          quiz,
          stamp: next,
          activity: [activity(actor, now, quiz.id, "settings", before, after)],
        },
      };
    });
  }

  /** A quiz's single toggle: it always saves, with no conflict check, and records a change. */
  async function setQuizToggle(
    actor: StaffActor,
    quizId: string,
    change: (
      quiz: Quiz,
      questions: number,
    ) => { error: string } | { quiz: Quiz; action: string; field: "visibility" | "freePreview" },
  ): Promise<AdminResult<AdminQuizSettings>> {
    const now = new Date();
    return saved({ quiz: quizId }, (current): QuizPlan<AdminQuizSettings> => {
      if (!current?.quiz) return NOT_FOUND;
      const changed = change(current.quiz, current.questions.length);
      if ("error" in changed) return refused(formError(changed.error));
      const { quiz, action, field } = changed;
      const value = settingsOf(quiz, stampOf(current));
      if (quiz[field] === current.quiz[field]) return { ok: true, value, writes: null };
      const before = { [field]: current.quiz[field] };
      const after = { [field]: quiz[field] };
      return {
        ok: true,
        value,
        writes: { quiz, activity: [activity(actor, now, quiz.id, action, before, after)] },
      };
    });
  }

  async function setQuizVisibility(
    actor: StaffActor,
    quizId: string,
    visible: boolean,
  ): Promise<AdminResult<AdminQuizSettings>> {
    const form = begin(actor, quizVisibilityInputSchema, { quiz: quizId, visible });
    if (!form.ok) return form;
    const visibility: ContentVisibility = form.value.visible ? "visible" : "hidden";
    return setQuizToggle(actor, form.value.quiz, (quiz, questions) => {
      const refusal = visibilityRefusal(visibility, questions, "question");
      if (refusal) return { error: refusal };
      return {
        quiz: { ...quiz, visibility },
        action: visibility === "visible" ? "show" : "hide",
        field: "visibility",
      };
    });
  }

  async function setQuizFreePreview(
    actor: StaffActor,
    quizId: string,
    freePreview: boolean,
  ): Promise<AdminResult<AdminQuizSettings>> {
    const form = begin(actor, quizFreePreviewInputSchema, { quiz: quizId, freePreview });
    if (!form.ok) return form;
    return setQuizToggle(actor, form.value.quiz, (quiz) => ({
      quiz: { ...quiz, freePreview: form.value.freePreview },
      action: "free-preview",
      field: "freePreview",
    }));
  }

  return {
    getQuizForAdmin,
    getQuestionFigureForAdmin,
    updateQuizSettings,
    setQuizVisibility,
    setQuizFreePreview,
  };
}
