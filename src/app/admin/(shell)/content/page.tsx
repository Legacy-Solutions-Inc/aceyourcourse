import type { Metadata } from "next";
import Link from "next/link";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import { ContentPicker } from "@/components/admin/content/content-picker";
import { TopicsEditor } from "@/components/admin/content/topics-editor";
import { requireStaff } from "@/lib/admin/guard";
import { codeParam } from "@/lib/admin/topics-view";
import { paths } from "@/paths";
import { listExamsForAdmin, listTopicsForAdmin } from "@/services/admin";

import { addTopic, moveTopicInSubject, removeTopic, saveTopicName } from "./actions";

export const metadata: Metadata = { title: adminScreen("content").title };

interface ContentPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Member App content, for any Staff User (Phase 3, ticket 05; spec, Phase 3
 * planning decisions → Topics editor; BUILD-MAP §3.6): an Exam → Subject
 * picker, then that Subject's Topics, read fresh on every request. It opens on
 * the first Exam and its first Subject; an Exam or Subject the address names
 * that isn't one opens the first instead. Later tickets add each Topic's
 * deck, quiz and Reviewer PDF here; the Reviewer PDFs' uploads have their own
 * screen (ticket 12), linked at the top.
 */
export default async function ContentPage({ searchParams }: ContentPageProps) {
  const actor = await requireStaff(paths.admin.content);
  const query = await searchParams;
  const exams = await listExamsForAdmin(actor);
  const exam = exams.find((candidate) => candidate.code === codeParam(query.exam)) ?? exams[0];
  const subject =
    exam?.subjects.find((candidate) => candidate.code === codeParam(query.subject)) ??
    exam?.subjects[0];
  const list = exam && subject ? await listTopicsForAdmin(actor, exam.code, subject.code) : null;

  return (
    <AdminScreen screen="content">
      <Link
        href={paths.admin.reviewerPdfs}
        className="w-fit text-[13px] font-semibold text-ayc-blue underline-offset-2 hover:underline"
      >
        Reviewer PDFs: upload, progress and delete →
      </Link>
      {exam ? (
        <ContentPicker exams={exams} examCode={exam.code} subjectCode={subject?.code ?? null} />
      ) : null}
      {list ? (
        <TopicsEditor
          list={list}
          actions={{ addTopic, saveTopicName, moveTopicInSubject, removeTopic }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">There are no Exams with Subjects yet.</p>
      )}
    </AdminScreen>
  );
}
