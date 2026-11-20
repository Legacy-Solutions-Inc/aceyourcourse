import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminScreen } from "@/components/admin/admin-screen";
import { QuizEditor } from "@/components/admin/content/quiz-editor";
import { requireStaff } from "@/lib/admin/guard";
import { paths } from "@/paths";
import { getQuizForAdmin } from "@/services/admin";

import {
  addQuestion,
  createCardImageUpload,
  moveQuestionInQuiz,
  removeQuestion,
  saveQuestion,
  saveQuizFreePreview,
  saveQuizSettings,
  saveQuizVisibility,
} from "../actions";

export const metadata: Metadata = { title: "Quiz" };

interface QuizPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const param = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

/**
 * A Topic's quiz, for any Staff User (Phase 3, tickets 09 and 10; BUILD-MAP
 * §3.6), opened from its Topics list with "Quiz" and read fresh on every
 * request: its settings, its Visible and Free Preview switches, its questions
 * and the question editor. `question` opens one question in the form;
 * anything else (none, "new", or a question that's gone or was removed)
 * opens a new question's form. A Topic that isn't there answers 404.
 */
export default async function QuizPage({ searchParams }: QuizPageProps) {
  const query = await searchParams;
  const topicId = param(query.topic) ?? "";
  const question = param(query.question);
  const actor = await requireStaff(paths.admin.quiz(topicId, question));
  const quiz = await getQuizForAdmin(actor, topicId);
  if (!quiz) notFound();
  const selected = quiz.questions.some((candidate) => candidate.id === question)
    ? (question ?? null)
    : null;

  return (
    <AdminScreen screen="content">
      <Link
        href={paths.admin.contentTopics(quiz.exam.code, quiz.subject.code)}
        className="w-fit text-[13px] font-semibold text-ayc-blue underline-offset-2 hover:underline"
      >
        ← {quiz.subject.code} Topics
      </Link>
      <QuizEditor
        quiz={quiz}
        selected={selected}
        actions={{
          saveQuizSettings,
          saveQuizVisibility,
          saveQuizFreePreview,
          // A figure has a card image's rules, so it's uploaded as one.
          createFigureUpload: createCardImageUpload,
          addQuestion,
          saveQuestion,
          moveQuestionInQuiz,
          removeQuestion,
        }}
      />
    </AdminScreen>
  );
}
