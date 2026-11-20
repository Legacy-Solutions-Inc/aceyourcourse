import type { AccessDecision } from "@/lib/member-app/access";
import { paths } from "@/paths";
import type { ContentKind } from "@/services/content.types";
import type { LibrarySubject, LibraryTopic } from "@/services/member.types";

// The Library's view (mockup `library`, BUILD-MAP §3; stories 93, 94 and
// 103): pure, from the Library read and each item's access decision.

/** What a Library item shows: open, open as Free Preview, or locked (no pass, or an ended one). */
export type LibraryItemState = "open" | "free-preview" | "locked" | "expired";

/** Pure: whether an item shows locked: no pass, or one that has ended. */
export const isLocked = (state: LibraryItemState) => state === "locked" || state === "expired";

/** What each kind of content is called in the Library and on its screen. */
export const CONTENT_LABELS: Record<ContentKind, string> = {
  deck: "Flashcards",
  quiz: "Quiz",
  "reviewer-pdf": "Reviewer PDF",
};

export interface LibraryItemView {
  kind: ContentKind;
  id: string;
  label: string;
  state: LibraryItemState;
  href: string;
}

export interface LibraryTopicView {
  id: string;
  /** "01", "02"…: its place in its Subject. */
  number: string;
  name: string;
  /** The Member's % done (the progress calculator's), or null while it has nothing to study. */
  percent: number | null;
  /** Empty while nothing in it is Visible or Published: still being prepared. */
  items: LibraryItemView[];
  /** Whether any item is locked or expired, so the row says how to unlock it. */
  locked: boolean;
}

/**
 * Pure: what a Library item shows for the Member's access decision. The
 * Library lists only Visible and Published items, on a request past the gate
 * and the Active Device, so anything but allowed or expired is locked.
 */
export function itemState(decision: AccessDecision): LibraryItemState {
  if (decision.outcome === "allowed") {
    return decision.via === "free-preview" ? "free-preview" : "open";
  }
  return decision.outcome === "expired" ? "expired" : "locked";
}

/** Pure: one Topic's row, with each item's state from `decide`, and the Member's % done. */
export function topicView(
  topic: LibraryTopic,
  decide: (item: LibraryTopic["items"][number]) => AccessDecision,
  percent: number | null,
): LibraryTopicView {
  const items = topic.items.map((item) => ({
    kind: item.kind,
    id: item.id,
    label: CONTENT_LABELS[item.kind],
    state: itemState(decide(item)),
    href: paths.memberApp.content(item.kind, item.id),
  }));
  return {
    id: topic.id,
    number: String(topic.position).padStart(2, "0"),
    name: topic.name,
    percent,
    items,
    locked: items.some((item) => isLocked(item.state)),
  };
}

/**
 * Pure: the Subject the Library opens on: the one asked for (its code, any
 * case), or the first when that isn't one of the Exam's. Null for an Exam
 * with no Subjects.
 */
export function pickSubject(
  subjects: readonly LibrarySubject[],
  asked: string | undefined,
): LibrarySubject | null {
  const wanted = asked?.trim().toUpperCase();
  return subjects.find((subject) => subject.code === wanted) ?? subjects[0] ?? null;
}
