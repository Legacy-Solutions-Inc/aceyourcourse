import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ContentState } from "@/components/member-app/content-state";
import { DeckPlayer } from "@/components/member-app/deck-player";
import { EmptyDeck, RefusedDeck } from "@/components/member-app/deck-states";
import { FocusScreen } from "@/components/member-app/focus-screen";
import { CONTENT_LABELS } from "@/components/member-app/library-view";
import { MemberScreen } from "@/components/member-app/member-screen";
import { checkContentAccess, readMemberAccess, shownRefusal } from "@/lib/member-app/access-check";
import { requireMemberWithExam } from "@/lib/member-app/guard";
import { memberWatermark } from "@/lib/member-app/member-id";
import { paths } from "@/paths";
import { getWebsiteSettings } from "@/services/catalogue";
import { openDeck } from "@/services/member";
import { contentRefSchema } from "@/services/member.schema";
import type { ContentItem, Member, TargetExam } from "@/services/member.types";

import { markStudyCard, saveStudyPosition } from "../../actions";

export const metadata: Metadata = { title: "Library" };

interface ContentPageProps {
  params: Promise<{ kind: string; id: string }>;
}

/** Back goes to the item's Subject in the Library, or to the Library for another Exam's item. */
function backFrom(item: ContentItem, selected: TargetExam) {
  return item.examCode === selected.examCode
    ? {
        href: paths.memberApp.librarySubject(item.subjectCode),
        label: `Back to ${item.subjectCode} topics`,
      }
    : { href: paths.memberApp.library, label: "Back to the Library" };
}

/**
 * Opening a deck, quiz or Reviewer PDF from the Library. The gate, consent,
 * the Active Device and onboarding come first, so someone they don't let in
 * learns nothing about the item; should the access decision still say so,
 * their screens take over. An address that names no item is a 404.
 *
 * A deck opens in the flashcard player (ticket 08): the Member seam runs the
 * access decision before it reads a card, so a refused deck's cards never
 * reach the browser, which gets the unlock prompt, renew or "no longer
 * available" instead. A quiz or Reviewer PDF shows what the decision
 * answered until its screen replaces it (tickets 11 and 14).
 */
export default async function ContentPage({ params }: ContentPageProps) {
  // The kind and id are the browser's: one that isn't an item's is not found.
  const ref = contentRefSchema.safeParse(await params);
  const from = ref.success
    ? paths.memberApp.content(ref.data.kind, ref.data.id)
    : paths.memberApp.library;
  const { member, selected } = await requireMemberWithExam(from);
  if (!ref.success) notFound();
  if (ref.data.kind === "deck") return deckScreen({ id: ref.data.id, member, selected, from });

  const access = await checkContentAccess(ref.data.kind, ref.data.id);
  if (access.status === "signed-out") redirect(paths.memberApp.signIn(from));
  if (access.status === "not-found") notFound();

  const { item } = access;
  const decision =
    access.decision.outcome === "allowed" ? access.decision : shownRefusal(access.decision, from);
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
        back={backFrom(item, selected)}
      />
    </MemberScreen>
  );
}

interface DeckScreenProps {
  id: string;
  member: Member;
  selected: TargetExam;
  from: string;
}

/** A deck, as a focus screen: the player, or why it won't open, or that it's still being prepared. */
async function deckScreen({ id, member, selected, from }: DeckScreenProps) {
  const access = await readMemberAccess();
  if (!access) redirect(paths.memberApp.signIn(from));
  const [opening, { contactEmail }] = await Promise.all([
    openDeck(member.userId, id, access),
    getWebsiteSettings(),
  ]);
  if (opening.status === "not-found") notFound();

  const { item } = opening;
  const back = backFrom(item, selected);
  const crumb = `${item.subjectCode} · FLASHCARDS`;
  const heading = { crumb, title: item.topicName };

  let screen: React.ReactNode;
  if (opening.status === "refused") {
    screen = (
      <RefusedDeck
        {...heading}
        decision={shownRefusal(opening.decision, from)}
        marked={opening.marked}
        examCode={item.examCode}
        contactEmail={contactEmail}
        back={back}
      />
    );
  } else if (opening.deck.cards.length === 0) {
    screen = <EmptyDeck {...heading} back={back} />;
  } else {
    screen = (
      <DeckPlayer
        deckId={item.id}
        title={item.topicName}
        label={`${item.subjectCode} · ${item.topicName.toUpperCase()}`}
        cards={opening.deck.cards}
        marks={opening.deck.marks}
        resumeAt={opening.deck.resumeAt}
        imagesExpireAt={opening.deck.imagesExpireAt}
        watermark={memberWatermark(member.email, member.userId)}
        examCode={item.examCode}
        contactEmail={contactEmail}
        back={back}
        actions={{ markCard: markStudyCard, savePosition: saveStudyPosition }}
      />
    );
  }

  return (
    <FocusScreen back={back} crumb={crumb} title={item.topicName}>
      {screen}
    </FocusScreen>
  );
}
