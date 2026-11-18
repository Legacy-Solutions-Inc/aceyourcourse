import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AttemptReview, ScoreLines, ScoreTally } from "@/components/member-app/attempt-review";
import { ContentState } from "@/components/member-app/content-state";
import { DeckPlayer } from "@/components/member-app/deck-player";
import { QuizPlayer } from "@/components/member-app/quiz-player";
import {
  cardsKept,
  EmptyStudy,
  quizKept,
  RefusedStudy,
} from "@/components/member-app/study-states";
import { FocusScreen } from "@/components/member-app/focus-screen";
import { CONTENT_LABELS } from "@/components/member-app/library-view";
import { MemberScreen } from "@/components/member-app/member-screen";
import { formatDateTime } from "@/lib/manila-time";
import type { MemberAccess } from "@/lib/member-app/access";
import { checkContentAccess, readMemberAccess, shownRefusal } from "@/lib/member-app/access-check";
import { requireMemberWithExam } from "@/lib/member-app/guard";
import { memberWatermark } from "@/lib/member-app/member-id";
import { paths } from "@/paths";
import { getWebsiteSettings } from "@/services/catalogue";
import { openDeck, openQuiz, reviewQuizAttempt } from "@/services/member";
import { contentRefSchema } from "@/services/member.schema";
import type { ContentItem, Member, RefusedQuiz, TargetExam } from "@/services/member.types";

import { markStudyCard, saveStudyPosition, submitQuizAttempt } from "../../actions";

export const metadata: Metadata = { title: "Library" };

interface ContentPageProps {
  params: Promise<{ kind: string; id: string }>;
  /** A quiz's `attempt`: one of the Member's past attempts at it, to review. */
  searchParams: Promise<{ attempt?: string | string[] }>;
}

/** A quiz's crumb, as the breadcrumb and the back bar show it: "MSTC · QUIZ". */
const quizCrumb = (item: ContentItem) => `${item.subjectCode} · QUIZ`;

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
 * A deck opens in the flashcard player (ticket 08), and a quiz in the quiz
 * screen (ticket 11), or one of the Member's past attempts at it with
 * `?attempt=`: the Member seam runs the access decision before it reads a
 * card or a question, so a refused deck's cards and a refused quiz's
 * questions never reach the browser, which gets the unlock prompt, renew or
 * "no longer available" instead; nor does a correct choice before the Member
 * submits. A Reviewer PDF shows what the decision answered until its screen
 * replaces it (ticket 14).
 */
export default async function ContentPage({ params, searchParams }: ContentPageProps) {
  // The kind and id are the browser's: one that isn't an item's is not found.
  const ref = contentRefSchema.safeParse(await params);
  const { attempt } = await searchParams;
  const attemptId =
    ref.success && ref.data.kind === "quiz" && typeof attempt === "string" ? attempt : null;
  const from = !ref.success
    ? paths.memberApp.library
    : attemptId !== null
      ? paths.memberApp.quizAttempt(ref.data.id, attemptId)
      : paths.memberApp.content(ref.data.kind, ref.data.id);
  const { member, selected } = await requireMemberWithExam(from);
  if (!ref.success) notFound();
  if (ref.data.kind === "deck") return deckScreen({ id: ref.data.id, member, selected, from });
  if (ref.data.kind === "quiz") {
    const access = await readMemberAccess();
    if (!access) redirect(paths.memberApp.signIn(from));
    const screen = { id: ref.data.id, member, selected, from, access };
    return attemptId === null ? quizScreen(screen) : attemptScreen({ ...screen, attemptId });
  }

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
      <RefusedStudy
        {...heading}
        kind="deck"
        decision={shownRefusal(opening.decision, from)}
        kept={cardsKept(opening.marked)}
        examCode={item.examCode}
        contactEmail={contactEmail}
        back={back}
      />
    );
  } else if (opening.deck.cards.length === 0) {
    screen = <EmptyStudy {...heading} kind="deck" back={back} />;
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

interface QuizScreenProps {
  id: string;
  member: Member;
  selected: TargetExam;
  from: string;
  access: MemberAccess;
}

/** A refused quiz, or one of its attempts: why it won't open, with the Member's attempts and Best Score kept. */
async function refusedQuizScreen(opening: RefusedQuiz, selected: TargetExam, from: string) {
  const { item } = opening;
  const back = backFrom(item, selected);
  const crumb = quizCrumb(item);
  const { contactEmail } = await getWebsiteSettings();
  return (
    <FocusScreen back={back} crumb={crumb} title={item.topicName}>
      <RefusedStudy
        crumb={crumb}
        title={item.topicName}
        kind="quiz"
        decision={shownRefusal(opening.decision, from)}
        kept={quizKept(opening.attemptCount, opening.bestScore)}
        examCode={item.examCode}
        contactEmail={contactEmail}
        back={back}
      />
    </FocusScreen>
  );
}

/** A quiz, as a focus screen: the quiz screen, or why it won't open, or that it's still being prepared. */
async function quizScreen({ id, member, selected, from, access }: QuizScreenProps) {
  const [opening, { contactEmail }] = await Promise.all([
    openQuiz(member.userId, id, access),
    getWebsiteSettings(),
  ]);
  if (opening.status === "not-found") notFound();
  if (opening.status === "refused") return refusedQuizScreen(opening, selected, from);

  const { item, quiz } = opening;
  const back = backFrom(item, selected);
  const crumb = quizCrumb(item);
  return (
    <FocusScreen back={back} crumb={crumb} title={item.topicName}>
      {quiz.questions.length === 0 ? (
        <EmptyStudy crumb={crumb} title={item.topicName} kind="quiz" back={back} />
      ) : (
        <QuizPlayer
          quizId={item.id}
          title={item.topicName}
          crumb={`${item.subjectCode} · PRACTICE QUIZ`}
          quiz={quiz}
          watermark={memberWatermark(member.email, member.userId)}
          examCode={item.examCode}
          contactEmail={contactEmail}
          back={back}
          actions={{ submitQuiz: submitQuizAttempt }}
        />
      )}
    </FocusScreen>
  );
}

/** One of the Member's past attempts at a quiz (story 100): its score and its review, as the score screen showed it. */
async function attemptScreen({
  id,
  member,
  selected,
  from,
  access,
  attemptId,
}: QuizScreenProps & { attemptId: string }) {
  const opening = await reviewQuizAttempt(member.userId, { quizId: id, attemptId }, access);
  if (opening.status === "not-found") notFound();
  if (opening.status === "refused") return refusedQuizScreen(opening, selected, from);

  const { item, attempt, bestScore, review } = opening;
  const when = formatDateTime(attempt.submittedAt);
  return (
    <FocusScreen back={backFrom(item, selected)} crumb={quizCrumb(item)} title={item.topicName}>
      <section
        aria-labelledby="past-attempt"
        className="mx-auto flex w-full max-w-160 flex-col gap-4 border-[1.5px] bg-ayc-paper p-5 shadow-hard wide:my-4 wide:p-8"
      >
        <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">
          {item.subjectCode} · {item.topicName.toUpperCase()} · PRACTICE QUIZ
        </p>
        <h1
          id="past-attempt"
          className="text-[clamp(22px,2.6vw,30px)] leading-[1.1] font-extrabold tracking-[-0.02em]"
        >
          Your attempt of {when}
        </h1>
        <ScoreTally attempt={attempt} id="past-attempt-score" />
        <ScoreLines attempt={attempt} bestScore={bestScore} />
        <Link
          href={paths.memberApp.content("quiz", item.id)}
          className="flex min-h-12 items-center self-start border-[1.5px] bg-primary px-4.5 text-[15px] font-bold text-primary-foreground"
        >
          Back to the quiz
        </Link>
      </section>
      <div className="mx-auto w-full max-w-160">
        <AttemptReview review={review} watermark={memberWatermark(member.email, member.userId)} />
      </div>
    </FocusScreen>
  );
}
