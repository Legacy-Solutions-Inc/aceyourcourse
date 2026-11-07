"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { faqListHref } from "@/lib/admin/faq-list";
import type { AdminFaq, AdminFaqList } from "@/services/admin.types";

import { EditFaq, type FaqEditorActions, NewFaq } from "./faq-editor";

interface FaqPanelProps {
  /** The selected FAQ's id, "new", or null. */
  selected: string | null;
  /** The selected FAQ, or null when it isn't in the catalogue. */
  opened: AdminFaq | null;
  list: Pick<AdminFaqList, "query" | "reviews" | "slugs">;
  actions: FaqEditorActions;
}

/**
 * The FAQS tab's right-hand panel (mockup 301–310): the selected FAQ's
 * editor, a new FAQ's, or a prompt to pick one. After a save the URL follows
 * the FAQ to its group, so the list beside it shows it; one just added opens
 * in its editor still saying "✓ SAVED".
 */
export function FaqPanel({ selected, opened, list, actions }: FaqPanelProps) {
  const router = useRouter();
  const [added, setAdded] = useState<AdminFaq | null>(null);
  // "✓ SAVED" is for the editor the new FAQ opens in; another selection forgets it.
  if (added && selected !== "new" && selected !== added.faq.id) setAdded(null);

  /** Shows the saved FAQ in its group, reading the list again. */
  const follow = ({ faq }: AdminFaq) =>
    router.replace(faqListHref({ ...list.query, group: faq.group }, faq.id), { scroll: false });

  let body: React.ReactNode;
  if (selected === "new") {
    body = (
      <NewFaq
        group={list.query.group}
        reviews={list.reviews}
        slugs={list.slugs}
        actions={actions}
        onAdded={(faq) => {
          setAdded(faq);
          follow(faq);
        }}
      />
    );
  } else if (opened) {
    const id = opened.faq.id;
    body = (
      <EditFaq
        key={id}
        opened={opened}
        reviews={list.reviews}
        listHref={faqListHref(list.query)}
        actions={actions}
        onSaved={(faq) => {
          follow(faq);
          router.refresh();
        }}
        savedOnOpen={added?.faq.id === id ? added : undefined}
      />
    );
  } else {
    body = (
      <>
        <p className="font-bold">Select a question</p>
        <p className="text-sm text-muted-foreground">
          Pick one from the list to edit it, or add a new one.
        </p>
      </>
    );
  }

  return (
    <aside
      aria-label="FAQ editor"
      className="flex min-w-0 flex-col gap-3 border-[1.5px] bg-ayc-paper p-4"
    >
      {body}
    </aside>
  );
}
