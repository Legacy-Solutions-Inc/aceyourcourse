import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminScreen } from "@/components/admin/admin-screen";
import { DeckEditor } from "@/components/admin/content/deck-editor";
import { requireStaff } from "@/lib/admin/guard";
import { paths } from "@/paths";
import { getDeckForAdmin } from "@/services/admin";

import {
  addCard,
  createCardImageUpload,
  moveCardInDeck,
  removeCard,
  saveCard,
  saveDeckFreePreview,
  saveDeckVisibility,
} from "../actions";

export const metadata: Metadata = { title: "Flashcards" };

interface DeckPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const param = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

/**
 * A Topic's deck in the card editor, for any Staff User (Phase 3, ticket 07;
 * BUILD-MAP §3.6), opened from its Topics list with "Flashcards" and read
 * fresh on every request. `card` opens one card in the form; anything else
 * (no card, "new", or a card that's gone) opens a new card's form. A Topic
 * that isn't there answers 404.
 */
export default async function DeckPage({ searchParams }: DeckPageProps) {
  const query = await searchParams;
  const topicId = param(query.topic) ?? "";
  const card = param(query.card);
  const actor = await requireStaff(paths.admin.deck(topicId, card));
  const deck = await getDeckForAdmin(actor, topicId);
  if (!deck) notFound();
  const selected = deck.cards.some((candidate) => candidate.id === card) ? (card ?? null) : null;

  return (
    <AdminScreen screen="content">
      <Link
        href={paths.admin.contentTopics(deck.exam.code, deck.subject.code)}
        className="w-fit text-[13px] font-semibold text-ayc-blue underline-offset-2 hover:underline"
      >
        ← {deck.subject.code} Topics
      </Link>
      <DeckEditor
        deck={deck}
        selected={selected}
        watermark={actor.email}
        actions={{
          createCardImageUpload,
          addCard,
          saveCard,
          moveCardInDeck,
          removeCard,
          saveDeckVisibility,
          saveDeckFreePreview,
        }}
      />
    </AdminScreen>
  );
}
