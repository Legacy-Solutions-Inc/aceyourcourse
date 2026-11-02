"use client";

import { useId, useRef, useState } from "react";

import { PanelSection, TextField } from "@/components/admin/products/product-fields";
import { quoteCredit } from "@/lib/admin/faq-form";
import { reviewName } from "@/lib/admin/review-list";
import type { FaqReviewOption } from "@/services/admin.types";

interface QuotePickerProps {
  /** The Reviews a quote can come from. */
  reviews: FaqReviewOption[];
  /** The quoted Review's id and the words taken from it; "" for none. */
  reviewId: string;
  text: string;
  onChange: (quote: { reviewId: string; text: string }) => void;
  errors: { reviewId?: string; text?: string };
}

/** How many matching Reviews the search shows at once. */
const MATCHES_SHOWN = 6;

const BUTTON =
  "min-h-8 cursor-pointer border-[1.5px] bg-ayc-paper px-2.5 text-[13px] font-semibold hover:bg-ayc-sand";

/** Pure: the Reviews whose text or Product matches the search, case-insensitively. */
function matching(reviews: FaqReviewOption[], search: string): FaqReviewOption[] {
  const words = search.trim().toLowerCase();
  if (!words) return [];
  return reviews.filter((review) =>
    [review.text, review.product.shortName, review.product.examCode].some((field) =>
      field.toLowerCase().includes(words),
    ),
  );
}

/**
 * SUPPORTING REVIEW · OPTIONAL (mockup 302–304; spec, Phase 2 → FAQ): pick a
 * Review shown on the Website by its words or its Product, then paste the
 * words to quote, or select them in the Review. The server checks they're in
 * the Review word for word. The credit line is the Review's stars and Product,
 * never typed.
 */
export function QuotePicker({ reviews, reviewId, text, onChange, errors }: QuotePickerProps) {
  const [search, setSearch] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const reviewText = useRef<HTMLQuoteElement>(null);
  const searchId = useId();
  const errorId = `${searchId}-error`;
  const chosen = reviews.find((review) => review.id === reviewId);
  const matches = matching(reviews, search);

  /** Quotes the words selected in the Review, when the selection is inside it. */
  function quoteSelection() {
    const selection = window.getSelection();
    const words = selection?.toString().trim() ?? "";
    const inside =
      selection !== null &&
      selection.rangeCount > 0 &&
      reviewText.current?.contains(selection.getRangeAt(0).commonAncestorContainer);
    if (!words || !inside) {
      setHint("Select words in the Review first.");
      return;
    }
    setHint(null);
    onChange({ reviewId, text: words });
  }

  const remove = (
    <button
      type="button"
      className={BUTTON}
      aria-describedby={errors.reviewId ? errorId : undefined}
      onClick={() => onChange({ reviewId: "", text: "" })}
    >
      Remove quote
    </button>
  );

  if (!reviewId) {
    return (
      <PanelSection title="SUPPORTING REVIEW · OPTIONAL">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={searchId} className="font-mono text-xs font-medium text-muted-foreground">
            FIND A REVIEW TO QUOTE
          </label>
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search Reviews by their words or Product"
            aria-describedby={[`${searchId}-hint`, errors.reviewId ? errorId : null]
              .filter(Boolean)
              .join(" ")}
            aria-invalid={errors.reviewId ? true : undefined}
            className="w-full min-w-0 border-[1.5px] bg-white px-2.5 py-2.25 text-sm font-medium placeholder:text-muted-foreground"
          />
          <p id={`${searchId}-hint`} className="text-xs text-muted-foreground">
            Find the Review that backs up the answer, then quote its words.
          </p>
        </div>
        {search.trim() ? (
          matches.length > 0 ? (
            <ul aria-label="Matching reviews" className="flex flex-col gap-1.5">
              {matches.slice(0, MATCHES_SHOWN).map((review) => (
                <li key={review.id}>
                  <button
                    type="button"
                    aria-label={`Quote this review: ${reviewName(review.text)} · ${review.product.shortName}`}
                    onClick={() => {
                      setSearch("");
                      onChange({ reviewId: review.id, text: "" });
                    }}
                    className="flex w-full cursor-pointer flex-col gap-0.5 border-[1.5px] bg-white px-2.5 py-2 text-left hover:bg-ayc-sand"
                  >
                    <span className="line-clamp-2 text-[13px] leading-[1.4]">{review.text}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {quoteCredit(review)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted-foreground">No Reviews match.</p>
          )
        ) : null}
        {errors.reviewId ? <FieldMessage id={errorId}>{errors.reviewId}</FieldMessage> : null}
      </PanelSection>
    );
  }

  return (
    <PanelSection title="SUPPORTING REVIEW · OPTIONAL">
      {chosen ? (
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-xs font-medium text-muted-foreground">
            THE REVIEW · SELECT THE WORDS TO QUOTE
          </p>
          <blockquote
            ref={reviewText}
            className="border-[1.5px] border-dashed bg-white px-2.5 py-2 text-[13px] leading-[1.45] whitespace-pre-line"
          >
            {chosen.text}
          </blockquote>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={BUTTON}
              // Keeps the selection: pressing the button would otherwise clear it.
              onMouseDown={(event) => event.preventDefault()}
              onClick={quoteSelection}
            >
              Quote the selected words
            </button>
            {remove}
          </div>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {hint}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] text-muted-foreground">
            The Review this quotes isn’t on the Website now, so the FAQ page leaves the quote out.
          </p>
          <div>{remove}</div>
        </div>
      )}
      <TextField
        label="QUOTE FROM A REAL REVIEW"
        multiline
        placeholder="Paste a line from a review that backs up the answer"
        value={text}
        onChange={(next) => onChange({ reviewId, text: next })}
        error={errors.text}
        inputClassName="min-h-14"
      />
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-xs font-medium text-muted-foreground">
          CREDIT LINE · AUTOMATIC
        </p>
        <p className="border-[1.5px] border-ayc-rule bg-ayc-sand/40 px-2.5 py-2.25 text-sm font-medium">
          {chosen ? quoteCredit(chosen) : "—"}
        </p>
      </div>
      {errors.reviewId ? <FieldMessage id={errorId}>{errors.reviewId}</FieldMessage> : null}
    </PanelSection>
  );
}

function FieldMessage({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="font-mono text-[11px] font-medium text-destructive">
      {children}
    </p>
  );
}
