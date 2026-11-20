"use client";

import Link from "next/link";

import { useInstantSave } from "@/components/admin/use-instant-save";
import type { AdminAction } from "@/lib/admin/action";
import { paths } from "@/paths";
import type { AdminDeck, AdminDeckSettings, AdminError, DeletedCard } from "@/services/admin.types";

import { CardForm, type CardFormActions } from "./card-form";
import { ContentRow } from "./content-row";
import { ContentSwitch } from "./content-switch";
import { useContentScreen } from "./use-content-screen";

export interface DeckEditorActions extends CardFormActions {
  moveCardInDeck: AdminAction<string[]>;
  removeCard: AdminAction<DeletedCard>;
  saveDeckVisibility: AdminAction<AdminDeckSettings>;
  saveDeckFreePreview: AdminAction<AdminDeckSettings>;
}

interface DeckEditorProps {
  /** The Topic's deck, read on the server for this render. */
  deck: AdminDeck;
  /** The card open in the form, or null for a new card. */
  selected: string | null;
  /** The signed-in Staff User's email: the preview's watermark. */
  watermark: string;
  actions: DeckEditorActions;
}

export const NOW_HIDDEN = "The deck is now Hidden because it has no cards.";
export const ADD_A_CARD_FIRST = "ADD A CARD FIRST · A DECK NEEDS AT LEAST ONE CARD TO BE VISIBLE";

/** Pure: what a refused toggle says, as a toast. */
const settingRefusal = (error: AdminError) =>
  error.kind === "invalid" && error.formError
    ? error.formError
    : error.kind === "not-found"
      ? "That deck is gone. Reload the page."
      : "The deck wasn’t changed. Reload the page and try again.";

/**
 * A Topic's deck in Member App content (BUILD-MAP §3.6; stories 125, 127,
 * 128): the deck's state (Visible or Hidden, Free Preview, how many cards),
 * the cards in order with Edit, ▲▼ and Delete, and the card form. "Visible
 * to members" can't be turned on while the deck is empty, and deleting the
 * last card of a Visible deck hides it, which the screen says. The server
 * enforces every rule and records each change in Staff Activity; this screen
 * only shows what it answered.
 */
export function DeckEditor({ deck, selected, watermark, actions }: DeckEditorProps) {
  const { exam, subject, topic, cards } = deck;
  const settings = deck.deck;
  const visibility = useInstantSave(actions.saveDeckVisibility, {
    what: `${topic.name} flashcards`,
    kept: "The switch is back as it was.",
    refused: settingRefusal,
  });
  const freePreview = useInstantSave(actions.saveDeckFreePreview, {
    what: `${topic.name} flashcards`,
    kept: "The switch is back as it was.",
    refused: settingRefusal,
  });

  const card = cards.find((candidate) => candidate.id === selected) ?? null;
  const visible = settings?.visibility === "visible";
  const count = `${cards.length} ${cards.length === 1 ? "CARD" : "CARDS"}`;
  const label = `${subject.code} · ${topic.name.toUpperCase()}`;

  const screen = useContentScreen({
    noun: "CARD",
    nowHidden: NOW_HIDDEN,
    pathOf: (item) => paths.admin.deck(topic.id, item),
    openId: card?.id ?? null,
  });
  const deleted = ({ card: gone, deckHidden }: DeletedCard) => screen.deleted(gone, deckHidden);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section
        aria-labelledby="deck-title"
        className="flex min-w-0 flex-col gap-3 border-[1.5px] bg-ayc-paper p-4.5"
      >
        <div className="flex flex-col gap-0.5">
          <h2 id="deck-title" className="text-lg font-bold">
            {topic.name} flashcards
          </h2>
          <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">
            {exam.code} · {subject.code} · {count} · {visible ? "VISIBLE" : "HIDDEN"}
            {settings?.freePreview ? " · FREE PREVIEW" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <ContentSwitch
            label="Visible to members"
            description={
              visible
                ? "Members see this deck in the Library."
                : "Hidden: Members don’t see this deck."
            }
            checked={visible}
            disabledReason={!visible && cards.length === 0 ? ADD_A_CARD_FIRST : null}
            pending={visibility.pending}
            onChange={(checked) =>
              settings && visibility.save({ deck: settings.id, visible: checked })
            }
          />
          <ContentSwitch
            label="Free Preview"
            description="Members with no Access Pass can open it while it’s Visible."
            checked={settings?.freePreview ?? false}
            disabledReason={settings ? null : "ADD A CARD FIRST"}
            pending={freePreview.pending}
            onChange={(checked) =>
              settings && freePreview.save({ deck: settings.id, freePreview: checked })
            }
          />
        </div>
        <p role="status" className="text-sm font-semibold">
          {screen.notice}
        </p>
      </section>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section
          aria-labelledby="deck-cards"
          className="flex min-w-0 flex-col gap-2 border-[1.5px] bg-ayc-paper p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3
              id="deck-cards"
              className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue"
            >
              CARDS · {cards.length}
            </h3>
            <Link
              href={paths.admin.deck(topic.id, "new")}
              className="inline-flex min-h-9 items-center border-[1.5px] bg-primary px-3 text-[13px] font-bold text-primary-foreground"
            >
              + Add card
            </Link>
          </div>
          {cards.length > 0 ? (
            <ol aria-label={`Cards in ${topic.name}`} className="flex flex-col">
              {cards.map((row, index) => (
                <ContentRow
                  key={`${row.id}:${row.position}`}
                  id={row.id}
                  noun="card"
                  position={row.position}
                  text={row.front}
                  href={paths.admin.deck(topic.id, row.id)}
                  first={index === 0}
                  last={index === cards.length - 1}
                  current={row.id === card?.id}
                  move={actions.moveCardInDeck}
                  remove={actions.removeCard}
                  deleteWarning="Members who marked it lose that mark. This can’t be undone."
                  onDeleted={deleted}
                >
                  {row.front}
                </ContentRow>
              ))}
            </ol>
          ) : (
            <p className="border border-dashed border-ayc-rule p-3.5 text-sm text-muted-foreground">
              No cards yet. Write the first one in the form.
            </p>
          )}
          <p className="font-mono text-[10px] font-bold tracking-[0.04em] text-muted-foreground">
            MEMBERS SEE ONE CARD AT A TIME WITH THEIR EMAIL AS A WATERMARK
          </p>
        </section>

        <section className="min-w-0 border-[1.5px] bg-ayc-paper p-4" aria-label="Card form">
          <CardForm
            key={card ? card.id : "new"}
            topicId={topic.id}
            label={label}
            card={card}
            imageSrc={card?.image ? paths.admin.cardImage(card.id) : null}
            watermark={watermark}
            actions={actions}
            onSaved={(saved, next) => screen.saved(saved.id, next)}
          />
        </section>
      </div>
    </div>
  );
}
