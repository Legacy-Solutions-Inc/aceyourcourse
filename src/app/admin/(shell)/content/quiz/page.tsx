import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminScreen } from "@/components/admin/admin-screen";
import { QuizEditor } from "@/components/admin/content/quiz-editor";
import { requireStaff } from "@/lib/admin/guard";
import { paths } from "@/paths";
import { getQuizForAdmin } from "@/services/admin";

import { saveQuizFreePreview, saveQuizSettings, saveQuizVisibility } from "../actions";

export const metadata: Metadata = { title: "Quiz" };

interface QuizPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * A Topic's quiz, for any Staff User (Phase 3, ticket 09; BUILD-MAP §3.6),
 * opened from its Topics list with "Quiz" and read fresh on every request:
 * its settings, its Visible and Free Preview switches, and its questions. A
 * Topic that isn't there answers 404.
 */
export default async function QuizPage({ searchParams }: QuizPageProps) {
  const query = await searchParams;
  const topicId = typeof query.topic === "string" ? query.topic : "";
  const actor = await requireStaff(paths.admin.quiz(topicId));
  const quiz = await getQuizForAdmin(actor, topicId);
  if (!quiz) notFound();

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
        actions={{ saveQuizSettings, saveQuizVisibility, saveQuizFreePreview }}
      />
    </AdminScreen>
  );
}
