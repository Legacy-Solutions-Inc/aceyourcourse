import type { Metadata } from "next";

import { Library } from "@/components/member-app/library";
import { pickSubject, topicView } from "@/components/member-app/library-view";
import { MemberScreen } from "@/components/member-app/member-screen";
import { RenewalBanners } from "@/components/member-app/renewal-banners";
import { accessDecision } from "@/lib/member-app/access";
import { readMemberAccess } from "@/lib/member-app/access-check";
import { requireMemberWithExam } from "@/lib/member-app/guard";
import { readRenewalBanners } from "@/lib/member-app/renewal-read";
import { readUnlockRoutes } from "@/lib/member-app/unlock-read";
import { paths } from "@/paths";
import { getLibrary, getTopicPercents } from "@/services/member";

import { dismissRenewalBanner } from "../actions";

export const metadata: Metadata = { title: "Library" };

interface LibraryPageProps {
  searchParams: Promise<{ subject?: string | string[] }>;
}

/**
 * The Library (02; mockup `library`; stories 93, 94 and 103): the selected
 * Target Exam's Subjects and Topics, each with the Member's own % done, and
 * each item open, Free Preview or locked by the access decision, which is
 * asked for every item on the server. Hidden and unpublished content never
 * reaches the page. A lock leads to the Exam's Plans while one is on sale
 * (ticket 02). Above them, the Exam's renewal banner while its Access Pass
 * ends within 7 days (Phase 4, ticket 12). The gate, consent, the Active
 * Device and onboarding come first.
 */
export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const { subject: asked } = await searchParams;
  const { member: signedIn, selected } = await requireMemberWithExam(paths.memberApp.library);
  const [member, subjects, percents, unlockOf, renewals] = await Promise.all([
    readMemberAccess(),
    getLibrary(selected.examCode),
    getTopicPercents(signedIn.userId, selected.examCode),
    readUnlockRoutes(),
    readRenewalBanners(signedIn.userId, selected.examCode),
  ]);
  // requireMemberWithExam just let a signed-in Member in.
  if (!member) throw new Error("The Library lost its signed-in Member.");

  const subject = pickSubject(subjects, typeof asked === "string" ? asked : undefined);
  const topics = (subject?.topics ?? []).map((topic) =>
    topicView(
      topic,
      (item) =>
        accessDecision({
          ...member,
          // The Library lists only Visible and Published items, of this Exam.
          content: { examCode: selected.examCode, available: true, freePreview: item.freePreview },
        }),
      percents[topic.id] ?? null,
    ),
  );

  return (
    <MemberScreen
      eyebrow={`02 · LIBRARY · ${selected.examCode} · ${selected.board}`}
      title="Subjects and topics"
    >
      <RenewalBanners banners={renewals} dismiss={dismissRenewalBanner} />
      <Library
        exam={{ code: selected.examCode, board: selected.board }}
        subjects={subjects.map(({ code, name }) => ({ code, name }))}
        subject={subject ? { code: subject.code, name: subject.name } : null}
        topics={topics}
        unlock={unlockOf(selected.examCode)}
      />
    </MemberScreen>
  );
}
