import { z } from "zod";

import { DEFAULT_QUIZ_SETTINGS, quizFigurePath } from "@/lib/quizzes/quiz-rules";
import {
  type NewQuestionForm,
  newQuestionFormSchema,
  type QuestionForm,
  questionFormSchema,
  questionIdInputSchema,
  questionMoveInputSchema,
  quizFreePreviewInputSchema,
  type QuizSettingsForm,
  quizSettingsFormSchema,
  quizVisibilityInputSchema,
  type ReviewMove,
} from "@/services/admin.schema";
import type {
  AdminError,
  AdminQuestion,
  AdminQuiz,
  AdminQuizSettings,
  AdminResult,
  CardImageFile,
  DeletedQuestion,
  RecordStamp,
  StaffActivity,
  StaffActor,
} from "@/services/admin.types";
import {
  activityRecord,
  formError,
  NOT_FOUND,
  refused,
  renumbered,
  saveThenTidy,
  staffInput,
  type StoredImage,
  storeImageUpload,
  swapped,
} from "@/services/content-editor.core";
import { visibilityAfterRemoval, visibilityRefusal } from "@/services/content.rules";
import type { ContentVisibility, Question, Quiz, Topic } from "@/services/content.types";
import { nextStamp } from "@/services/mock/sample-store";
import type { ContentFiles } from "@/services/uploads";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's quiz screen (Phase 3, ticket 09; spec, Phase 3 → Content
// model; stories 126–128), shared by both arms: each arm gives a
// QuizEditorStore (how it reads one Topic's quiz and its questions, and saves
// a change to it all or nothing), and this module does the rest the same way
// for both. Any Staff User, Editor or Owner, may use it.
//
// Each write, in order (the steps it shares with the card editor are in
// content-editor.core.ts):
//   1. checks the actor's Staff Role, and validates its input with zod (a
//      question's text by src/lib/quizzes/question-fields.ts),
//   2. reads the quiz, answering not-found when the Topic, quiz or question
//      is gone (a removed question is gone to the editor), and for a
//      question's edit runs the conflict check against the stamp its form
//      opened with,
//   3. checks and stores a new figure: a finished "card-image" upload that
//      really is a JPEG, PNG or WebP of at most 5 MB, copied under its quiz
//      in the private content bucket,
//   4. saves under the content write lock, where the quiz is read again and
//      every rule runs on it as it is then: the conflict check again (the
//      settings form's, or a question's), Visible refused while the quiz has
//      no questions, and the last question's delete hiding a Visible quiz,
//      with one Staff Activity record per entity it changes ("quiz",
//      "question") and the new stamp of what it saved, and
//   5. once saved, deletes the files nothing uses any more: the upload, and
//      a replaced or removed figure. If nothing was saved, the figure it
//      stored and its upload are deleted instead.
// The settings form saves its three fields together, with the conflict
// check; Visible and Free Preview are single toggles, which always save, as
// a deck's do. The question editor (ticket 10) works as the card editor
// does, but a deleted question is never erased (spec, Phase 3 → Corrections
// never cost progress): it's kept, marked removed, with its figure, so every
// Member's old attempts still show it as removed, and their Best Scores,
// which the attempts saved, stay as they are. Nothing cached reads quizzes,
// so no write returns a cache tag.
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
  /** Each question's last save, by question id. A question nobody has saved through the editor has none. */
  questionStamps: Record<string, RecordStamp>;
  /** When the data was made: the stamp of settings nobody has saved. */
  seededAt: string;
}

/** Which quiz: a Topic's, a question's, or the quiz itself. */
export type QuizKey = { topic: string } | { question: string } | { quiz: string };

/** Everything a write changes, worked out on the quiz as it is under the lock. */
export interface QuizWrites {
  /** The quiz as it now is, when the write made it or changed its settings. */
  quiz?: { value: Quiz; isNew: boolean };
  /** The quiz's settings' new stamp, when the write sets one. */
  stamp?: RecordStamp;
  /** The questions it adds or changes. One taken out of the quiz is here too, marked removed. */
  questions: Question[];
  /** The stamps it sets, by question id. */
  questionStamps: Record<string, RecordStamp>;
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

/** A question's record in the save stamps (ticket 10). */
export const questionRecordOf = (questionId: string) => `question:${questionId}`;

// ── Pure helpers ────────────────────────────────────────────────────────────

const ALREADY_FIRST = "IT’S ALREADY THE FIRST QUESTION";
const ALREADY_LAST = "IT’S ALREADY THE LAST QUESTION";

/** Pure: the quiz's settings' stamp: their last save, or the data's, when nobody has saved them. */
const stampOf = (quiz: TopicQuiz): RecordStamp =>
  quiz.stamp ?? { savedAt: quiz.seededAt, savedBy: null };

/** Pure: a question's stamp: its last save, or the data's, when nobody has saved it. */
const questionStampOf = (quiz: TopicQuiz, questionId: string): RecordStamp =>
  quiz.questionStamps[questionId] ?? { savedAt: quiz.seededAt, savedBy: null };

const settingsOf = (quiz: Quiz, stamp: RecordStamp): AdminQuizSettings => ({
  id: quiz.id,
  visibility: quiz.visibility,
  freePreview: quiz.freePreview,
  passingScore: quiz.passingScore,
  shuffle: quiz.shuffle,
  showAnswers: quiz.showAnswers,
  stamp,
});

const adminQuestionOf = (question: Question, stamp: RecordStamp): AdminQuestion => ({
  id: question.id,
  position: question.position ?? 0,
  question: question.question,
  choices: { ...question.choices },
  correct: question.correct,
  explanation: question.explanation,
  figure: question.figure,
  stamp,
});

/** Pure: the quiz screen's read. */
export function adminQuizOf(quiz: TopicQuiz): AdminQuiz {
  return {
    exam: quiz.exam,
    subject: quiz.subject,
    topic: { id: quiz.topic.id, name: quiz.topic.name, position: quiz.topic.position },
    quiz: quiz.quiz ? settingsOf(quiz.quiz, stampOf(quiz)) : null,
    questions: quiz.questions.map((question) =>
      adminQuestionOf(question, questionStampOf(quiz, question.id)),
    ),
  };
}

/** The settings form's fields, as Staff Activity keeps them. */
const formFieldsOf = ({ passingScore, shuffle, showAnswers }: Quiz) => ({
  passingScore,
  shuffle,
  showAnswers,
});

/** A question's fields, as Staff Activity keeps them. */
const questionSnapshot = ({ question, choices, correct, explanation, figure }: Question) => ({
  question,
  choices,
  correct,
  explanation,
  figure,
});

/** A Staff Activity record of a change to the quiz itself. */
const quizActivity = (
  actor: StaffActor,
  now: Date,
  quizId: string,
  action: string,
  before: unknown,
  after: unknown,
) => activityRecord(actor, now, "quiz", quizId, action, before, after);

/** A Staff Activity record of a change to one question. */
const questionActivity = (
  actor: StaffActor,
  now: Date,
  questionId: string,
  action: string,
  before: unknown,
  after: unknown,
) => activityRecord(actor, now, "question", questionId, action, before, after);

const NO_WRITES: Omit<QuizWrites, "activity"> = { questions: [], questionStamps: {} };

const uuid = z.string().uuid();

// ── The seam's calls ────────────────────────────────────────────────────────

/** The quiz screen's calls, on an arm's store. */
export function quizEditorCalls(store: QuizEditorStore) {
  /** Step 3: a new figure's upload, checked and copied under its quiz. */
  const storeFigure = (upload: string, quizId: string) =>
    storeImageUpload(
      store.files,
      upload,
      (fileId, type) => quizFigurePath(quizId, fileId, type),
      "figure",
    );

  /** Steps 4 and 5: saves under the lock, then deletes the files nothing uses. */
  const saveAndTidy = <T>(
    key: QuizKey,
    plan: (current: TopicQuiz | null) => QuizPlan<T>,
    stored: StoredImage | null,
    stale: (value: T) => (string | null)[],
  ) => saveThenTidy(store.files, () => store.save(key, plan), stored, stale);

  /** Step 4 for a write with no files: saves under the lock, and answers with what the plan gave. */
  const saved = <T>(key: QuizKey, plan: (current: TopicQuiz | null) => QuizPlan<T>) =>
    saveAndTidy(key, plan, null, () => []);

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
    const form = staffInput(actor, quizSettingsFormSchema, input);
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
          ...NO_WRITES,
          quiz: { value: quiz, isNew: false },
          stamp: next,
          activity: [quizActivity(actor, now, quiz.id, "settings", before, after)],
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
        writes: {
          ...NO_WRITES,
          quiz: { value: quiz, isNew: false },
          activity: [quizActivity(actor, now, quiz.id, action, before, after)],
        },
      };
    });
  }

  async function setQuizVisibility(
    actor: StaffActor,
    quizId: string,
    visible: boolean,
  ): Promise<AdminResult<AdminQuizSettings>> {
    const form = staffInput(actor, quizVisibilityInputSchema, { quiz: quizId, visible });
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
    const form = staffInput(actor, quizFreePreviewInputSchema, { quiz: quizId, freePreview });
    if (!form.ok) return form;
    return setQuizToggle(actor, form.value.quiz, (quiz) => ({
      quiz: { ...quiz, freePreview: form.value.freePreview },
      action: "free-preview",
      field: "freePreview",
    }));
  }

  // ── The question editor (ticket 10) ──────────────────────────────────────

  async function createQuestion(
    actor: StaffActor,
    input: NewQuestionForm,
  ): Promise<AdminResult<AdminQuestion>> {
    const form = staffInput(actor, newQuestionFormSchema, input);
    if (!form.ok) return form;
    const { topic, figure: upload, ...fields } = form.value;
    const before = await store.read({ topic });
    if (!before) return NOT_FOUND;

    const newQuizId = before.quiz?.id ?? crypto.randomUUID();
    let stored: StoredImage | null = null;
    if (upload) {
      const figure = await storeFigure(upload, newQuizId);
      if (!figure.ok) return figure;
      stored = figure.stored;
    }

    const now = new Date();
    const id = crypto.randomUUID();
    return saveAndTidy(
      { topic },
      (current): QuizPlan<AdminQuestion> => {
        if (!current) return NOT_FOUND;
        // The Topic's first question gives it a quiz: Hidden, not Free Preview, the default settings.
        const quiz: Quiz = current.quiz ?? {
          id: newQuizId,
          topicId: current.topic.id,
          visibility: "hidden",
          freePreview: false,
          ...DEFAULT_QUIZ_SETTINGS,
        };
        const last = current.questions.at(-1)?.position ?? 0;
        const question: Question = {
          id,
          quizId: quiz.id,
          position: last + 1,
          ...fields,
          figure: stored?.path ?? null,
          removedAt: null,
        };
        const stamp = nextStamp({ savedAt: current.seededAt, savedBy: null }, actor.name, now);
        const added = { quiz: quiz.id, position: question.position, ...questionSnapshot(question) };
        return {
          ok: true,
          value: adminQuestionOf(question, stamp),
          writes: {
            ...(current.quiz ? {} : { quiz: { value: quiz, isNew: true } }),
            questions: [question],
            questionStamps: { [id]: stamp },
            activity: [
              ...(current.quiz ? [] : [quizActivity(actor, now, quiz.id, "add", null, quiz)]),
              questionActivity(actor, now, id, "add", null, added),
            ],
          },
        };
      },
      stored,
      () => [upload],
    );
  }

  async function updateQuestion(
    actor: StaffActor,
    input: QuestionForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminQuestion>> {
    const form = staffInput(actor, questionFormSchema, input);
    if (!form.ok) return form;
    const { id, figure: wanted, ...fields } = form.value;
    const before = await store.read({ question: id });
    const old = before?.questions.find((question) => question.id === id);
    if (!before || !old) return NOT_FOUND;
    const opened = questionStampOf(before, id);
    if (expected && expected.savedAt !== opened.savedAt) {
      return refused({ kind: "conflict", ...opened });
    }

    // The figure: none, the question's own (kept), or a new upload, stored now.
    let stored: StoredImage | null = null;
    if (wanted !== null && wanted !== old.figure) {
      const figure = await storeFigure(wanted, old.quizId);
      if (!figure.ok) return figure;
      stored = figure.stored;
    }
    const figure = wanted === old.figure ? old.figure : (stored?.path ?? null);

    const now = new Date();
    return saveAndTidy(
      { question: id },
      (current): QuizPlan<AdminQuestion> => {
        const question = current?.questions.find((candidate) => candidate.id === id);
        if (!current || !question) return NOT_FOUND;
        // Again under the lock: a save since the read is a conflict too.
        const stamp = questionStampOf(current, id);
        if (stamp.savedAt !== opened.savedAt) return refused({ kind: "conflict", ...stamp });
        const edited: Question = { ...question, ...fields, figure };
        const next = nextStamp(stamp, actor.name, now);
        const [was, is] = [questionSnapshot(question), questionSnapshot(edited)];
        return {
          ok: true,
          value: adminQuestionOf(edited, next),
          writes: {
            questions: [edited],
            questionStamps: { [id]: next },
            activity: [questionActivity(actor, now, id, "edit", was, is)],
          },
        };
      },
      stored,
      // The upload, and the old figure once it's been replaced or removed.
      () => [stored?.upload ?? null, old.figure !== figure ? old.figure : null],
    );
  }

  async function moveQuestion(
    actor: StaffActor,
    id: string,
    direction: ReviewMove,
  ): Promise<AdminResult<string[]>> {
    // Like ▲▼ everywhere, it always saves: there's no form to go stale.
    const form = staffInput(actor, questionMoveInputSchema, { id, direction });
    if (!form.ok) return form;
    const now = new Date();
    return saved({ question: id }, (current): QuizPlan<string[]> => {
      const order = current?.questions ?? [];
      const index = order.findIndex((question) => question.id === id);
      if (!current || index === -1) return NOT_FOUND;
      const { direction } = form.value;
      const moved = swapped(order, index, direction);
      if (!moved) return refused(formError(direction === "up" ? ALREADY_FIRST : ALREADY_LAST));
      const before = order.map((question) => question.id);
      const after = moved.map((question) => question.id);
      return {
        ok: true,
        value: after,
        writes: {
          ...NO_WRITES,
          questions: renumbered(moved),
          activity: [questionActivity(actor, now, id, "move", before, after)],
        },
      };
    });
  }

  async function deleteQuestion(
    actor: StaffActor,
    id: string,
  ): Promise<AdminResult<DeletedQuestion>> {
    const form = staffInput(actor, questionIdInputSchema, { id });
    if (!form.ok) return form;
    const now = new Date();
    // Its figure stays: the question is kept, and an old attempt still shows it.
    return saved({ question: id }, (current): QuizPlan<DeletedQuestion> => {
      const question = current?.questions.find((candidate) => candidate.id === id);
      if (!current?.quiz || !question) return NOT_FOUND;
      const rest = current.questions.filter((candidate) => candidate.id !== id);
      // The last question of a Visible quiz takes the quiz off the Member App with it.
      const after = visibilityAfterRemoval(current.quiz.visibility, rest.length);
      const quiz = { ...current.quiz, visibility: after.visibility };
      const removedAt = now.toISOString();
      const removed: Question = { ...question, position: null, removedAt };
      const hidden = { visibility: "hidden" };
      return {
        ok: true,
        value: { question: structuredClone(question), quizHidden: after.hidden },
        writes: {
          ...(after.hidden ? { quiz: { value: quiz, isNew: false } } : {}),
          questions: [removed, ...renumbered(rest)],
          questionStamps: {},
          activity: [
            // Taken out, never erased: only its place and its removed marker change.
            questionActivity(
              actor,
              now,
              id,
              "delete",
              { position: question.position, removedAt: null },
              { position: null, removedAt },
            ),
            ...(after.hidden
              ? [quizActivity(actor, now, quiz.id, "hide", { visibility: "visible" }, hidden)]
              : []),
          ],
        },
      };
    });
  }

  return {
    getQuizForAdmin,
    getQuestionFigureForAdmin,
    updateQuizSettings,
    setQuizVisibility,
    setQuizFreePreview,
    createQuestion,
    updateQuestion,
    moveQuestion,
    deleteQuestion,
  };
}
