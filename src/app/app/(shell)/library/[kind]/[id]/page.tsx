import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AttemptReview, ScoreLines, ScoreTally } from "@/components/member-app/attempt-review";
import { DeckPlayer } from "@/components/member-app/deck-player";
import { QuizPlayer } from "@/components/member-app/quiz-player";
import { RenewalBanners } from "@/components/member-app/renewal-banners";
import { ReviewerReader } from "@/components/member-app/reviewer-reader";
import {
  cardsKept,
  EmptyStudy,
  examKept,
  pagesKept,
  quizKept,
  RefusedStudy,
} from "@/components/member-app/study-states";
import { FocusScreen } from "@/components/member-app/focus-screen";
import { formatDateTime } from "@/lib/manila-time";
import type { MemberAccess, ShownRefusal } from "@/lib/member-app/access";
import { readMemberAccess, shownRefusal } from "@/lib/member-app/access-check";
import { requireMemberWithExam } from "@/lib/member-app/guard";
import { memberWatermark } from "@/lib/member-app/member-id";
import { readRenewalBanners } from "@/lib/member-app/renewal-read";
import { readUnlockRoutes } from "@/lib/member-app/unlock-read";
import { paths } from "@/paths";
import {
  getProgress,
  openDeck,
  openQuiz,
  openReviewerPdf,
  reviewQuizAttempt,
} from "@/services/member";
import { contentRefSchema } from "@/services/member.schema";
import type { ContentItem, Member, RefusedQuiz, TargetExam } from "@/services/member.types";

import {
  markStudyCard,
  saveReadingPosition,
  saveStudyPosition,
  submitQuizAttempt,
} from "../../actions";
import { dismissRenewalBanner } from "../../../actions";

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

/** The item's Exam's renewal banner while its Access Pass ends within 7 days (Phase 4, ticket 12). */
async function renewalsFor(member: Member, examCode: string) {
  const banners = await readRenewalBanners(member.userId, examCode);
  return <RenewalBanners banners={banners} dismiss={dismissRenewalBanner} />;
}

/**
 * What a refused item says the Member kept: once their pass ended, their
 * progress in the item's whole Exam (Phase 4, ticket 12; mockup `expired`),
 * otherwise their progress on the item itself.
 */
async function keptOf(
  decision: ShownRefusal,
  member: Member,
  examCode: string,
  onItem: string | null,
): Promise<string | null> {
  return decision.outcome === "expired"
    ? examKept(await getProgress(member.userId, examCode))
    : onItem;
}

/**
 * Opening a deck, quiz or Reviewer PDF from the Library. The gate, consent,
 * the Active Device and onboarding come first, so someone they don't let in
 * learns nothing about the item; should the access decision still say so,
 * their screens take over. An address that names no item is a 404.
 *
 * A deck opens in the flashcard player (ticket 08), a quiz in the quiz
 * screen (ticket 11), or one of the Member's past attempts at it with
 * `?attempt=`, and a Reviewer PDF in the reader (ticket 14): the Member seam
 * runs the access decision before it reads a card, a question or a page, so
 * a refused deck's cards, a refused quiz's questions and a refused Reviewer
 * PDF's pages never reach the browser, which gets the unlock prompt, renew
 * or "no longer available" instead (the first two lead to the Exam's Plans
 * while one is on sale, ticket 02); nor does a correct choice before the
 * Member submits. The reader's pages come one at a time from the protected
 * page endpoint, stamped for the Member (src/app/app/reviewer-pdfs). Once
 * the Member's pass ended, a refusal keeps their progress in the whole Exam
 * and leads to "Renew access" (Phase 4, ticket 12). Each
 * screen has the item's Exam's renewal banner above it while its Access
 * Pass ends within 7 days (Phase 4, ticket 12).
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
  const access = await readMemberAccess();
  if (!access) redirect(paths.memberApp.signIn(from));
  const screen = { id: ref.data.id, member, selected, from, access };
  if (ref.data.kind === "reviewer-pdf") return reviewerScreen(screen);
  return attemptId === null ? quizScreen(screen) : attemptScreen({ ...screen, attemptId });
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
  const [opening, unlockOf] = await Promise.all([
    openDeck(member.userId, id, access),
    readUnlockRoutes(),
  ]);
  if (opening.status === "not-found") notFound();

  const { item } = opening;
  const back = backFrom(item, selected);
  const crumb = `${item.subjectCode} · FLASHCARDS`;
  const heading = { crumb, title: item.topicName };

  let screen: React.ReactNode;
  if (opening.status === "refused") {
    const decision = shownRefusal(opening.decision, from);
    screen = (
      <RefusedStudy
        {...heading}
        decision={decision}
        kept={await keptOf(decision, member, item.examCode, cardsKept(opening.marked))}
        examCode={item.examCode}
        unlock={unlockOf(item.examCode)}
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
        unlock={unlockOf(item.examCode)}
        back={back}
        actions={{ markCard: markStudyCard, savePosition: saveStudyPosition }}
      />
    );
  }

  return (
    <FocusScreen back={back} crumb={crumb} title={item.topicName}>
      {await renewalsFor(member, item.examCode)}
      {screen}
    </FocusScreen>
  );
}

/** What the quiz, attempt and Reviewer PDF screens need: the item's id, who's opening it, and their side of the access decision. */
interface StudyScreenProps {
  id: string;
  member: Member;
  selected: TargetExam;
  from: string;
  access: MemberAccess;
}

/** A refused quiz, or one of its attempts: why it won't open, with the Member's attempts and Best Score kept. */
async function refusedQuizScreen(
  opening: RefusedQuiz,
  { member, selected, from }: Pick<StudyScreenProps, "member" | "selected" | "from">,
) {
  const { item } = opening;
  const back = backFrom(item, selected);
  const crumb = quizCrumb(item);
  const unlockOf = await readUnlockRoutes();
  const decision = shownRefusal(opening.decision, from);
  const onQuiz = quizKept(opening.attemptCount, opening.bestScore);
  return (
    <FocusScreen back={back} crumb={crumb} title={item.topicName}>
      {await renewalsFor(member, item.examCode)}
      <RefusedStudy
        crumb={crumb}
        title={item.topicName}
        decision={decision}
        kept={await keptOf(decision, member, item.examCode, onQuiz)}
        examCode={item.examCode}
        unlock={unlockOf(item.examCode)}
        back={back}
      />
    </FocusScreen>
  );
}

/** A quiz, as a focus screen: the quiz screen, or why it won't open, or that it's still being prepared. */
async function quizScreen({ id, member, selected, from, access }: StudyScreenProps) {
  const [opening, unlockOf] = await Promise.all([
    openQuiz(member.userId, id, access),
    readUnlockRoutes(),
  ]);
  if (opening.status === "not-found") notFound();
  if (opening.status === "refused") {
    return refusedQuizScreen(opening, { member, selected, from });
  }

  const { item, quiz } = opening;
  const back = backFrom(item, selected);
  const crumb = quizCrumb(item);
  return (
    <FocusScreen back={back} crumb={crumb} title={item.topicName}>
      {await renewalsFor(member, item.examCode)}
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
          unlock={unlockOf(item.examCode)}
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
}: StudyScreenProps & { attemptId: string }) {
  const opening = await reviewQuizAttempt(member.userId, { quizId: id, attemptId }, access);
  if (opening.status === "not-found") notFound();
  if (opening.status === "refused") {
    return refusedQuizScreen(opening, { member, selected, from });
  }

  const { item, attempt, bestScore, review } = opening;
  const when = formatDateTime(attempt.submittedAt);
  return (
    <FocusScreen back={backFrom(item, selected)} crumb={quizCrumb(item)} title={item.topicName}>
      {await renewalsFor(member, item.examCode)}
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

/** A Reviewer PDF, as a focus screen: the reader, or why it won't open, or that it's still being prepared. */
async function reviewerScreen({ id, member, selected, from, access }: StudyScreenProps) {
  const [opening, unlockOf] = await Promise.all([
    openReviewerPdf(member.userId, id, access),
    readUnlockRoutes(),
  ]);
  if (opening.status === "not-found") notFound();

  const { item } = opening;
  const back = backFrom(item, selected);
  const crumb = `${item.subjectCode} · REVIEWER PDF`;
  const heading = { crumb, title: item.topicName };

  let screen: React.ReactNode;
  if (opening.status === "refused") {
    const decision = shownRefusal(opening.decision, from);
    screen = (
      <RefusedStudy
        {...heading}
        decision={decision}
        kept={await keptOf(decision, member, item.examCode, pagesKept(opening.viewed))}
        examCode={item.examCode}
        unlock={unlockOf(item.examCode)}
        back={back}
      />
    );
  } else if (opening.reviewerPdf.pageCount === 0) {
    screen = <EmptyStudy {...heading} kind="reviewer-pdf" back={back} />;
  } else {
    screen = (
      <ReviewerReader
        reviewerPdfId={item.id}
        title={item.topicName}
        label={`${item.subjectCode} Reviewer · ${item.topicName}`}
        pageCount={opening.reviewerPdf.pageCount}
        resumeAt={opening.reviewerPdf.resumeAt}
        examCode={item.examCode}
        unlock={unlockOf(item.examCode)}
        back={back}
        actions={{ savePosition: saveReadingPosition }}
      />
    );
  }

  return (
    <FocusScreen back={back} crumb={crumb} title={item.topicName}>
      {await renewalsFor(member, item.examCode)}
      {screen}
    </FocusScreen>
  );
}
