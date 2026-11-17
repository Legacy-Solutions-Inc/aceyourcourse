import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ContentState } from "@/components/member-app/content-state";
import { CONTENT_LABELS } from "@/components/member-app/library-view";
import { MemberScreen } from "@/components/member-app/member-screen";
import { checkContentAccess } from "@/lib/member-app/access-check";
import { requireMemberWithExam } from "@/lib/member-app/guard";
import { paths } from "@/paths";
import { getWebsiteSettings } from "@/services/catalogue";
import { contentRefSchema } from "@/services/member.schema";

export const metadata: Metadata = { title: "Library" };

interface ContentPageProps {
  params: Promise<{ kind: string; id: string }>;
}

/**
 * Opening a deck, quiz or Reviewer PDF from the Library: a placeholder until
 * the study screens (tickets 08, 11 and 14) replace it, which already runs
 * the access decision on the server and shows what it answered. The gate,
 * consent, the Active Device and onboarding come first, so someone they
 * don't let in learns nothing about the item; should the decision still say
 * so, their screens take over. An address that names no item is a 404. Back
 * goes to the item's Subject in the Library, or to the Library when the item
 * is another Exam's than the one the Library shows.
 */
export default async function ContentPage({ params }: ContentPageProps) {
  // The kind and id are the browser's: one that isn't an item's is not found.
  const ref = contentRefSchema.safeParse(await params);
  const from = ref.success
    ? paths.memberApp.content(ref.data.kind, ref.data.id)
    : paths.memberApp.library;
  const { selected } = await requireMemberWithExam(from);
  if (!ref.success) notFound();

  const access = await checkContentAccess(ref.data.kind, ref.data.id);
  if (access.status === "signed-out") redirect(paths.memberApp.signIn(from));
  if (access.status === "not-found") notFound();

  const { item, decision } = access;
  if (decision.outcome === "not-open-yet") redirect(paths.memberApp.notOpenYet);
  if (decision.outcome === "no-token" || decision.outcome === "device-replaced") {
    redirect(paths.memberApp.device(from));
  }
  const { contactEmail } = await getWebsiteSettings();

  return (
    <MemberScreen
      eyebrow={`LIBRARY · ${item.subjectCode} · ${CONTENT_LABELS[item.kind].toUpperCase()}`}
      title={item.topicName}
    >
      <ContentState
        decision={decision}
        kind={item.kind}
        examCode={item.examCode}
        contactEmail={contactEmail}
        back={
          item.examCode === selected.examCode
            ? {
                href: paths.memberApp.librarySubject(item.subjectCode),
                label: `Back to ${item.subjectCode} topics`,
              }
            : { href: paths.memberApp.library, label: "Back to the Library" }
        }
      />
    </MemberScreen>
  );
}
