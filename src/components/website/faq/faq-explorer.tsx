"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MarketplaceLink } from "@/components/website/marketplace-link";
import { faqPageCopy } from "@/content/faq-page";
import { filterFaqs } from "@/lib/faq/faq-search";
import { listNumber } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { FaqGroupWithItems, FaqWithQuote } from "@/services/catalogue.types";

const copy = faqPageCopy;
const container = "mx-auto max-w-324 px-[clamp(20px,5vw,72px)]";
const mono = "font-mono text-xs font-bold tracking-[0.06em] uppercase";

/** An FAQ's element id, which is also its deep link: /faq#faq-{slug}. */
const faqElementId = (slug: string) => `faq-${slug}`;
const FAQ_HASH_PREFIX = `#${faqElementId("")}`;

/** The FAQ named by a /faq#faq-{slug} link, or null. */
const slugFromHash = (hash: string) =>
  hash.startsWith(FAQ_HASH_PREFIX) ? hash.slice(FAQ_HASH_PREFIX.length) : null;

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface FaqExplorerProps {
  /** The visible FAQs, in their groups (the Catalogue seam's listFaqs()). */
  groups: FaqGroupWithItems[];
  /** The hero's eyebrow, heading and intro, above the search. */
  hero: React.ReactNode;
  /** Shown under the answer of the FAQ with showCoverageTable. */
  coverageTable: React.ReactNode;
  /** The Shopee shop page, or null to hide "Chat us on Shopee". */
  shopeeShop: string | null;
  contactEmail: string;
  memberAppLive: boolean;
}

/**
 * The FAQ page's search, popular chips, topics and accordions. The first FAQ
 * starts open. A /faq#faq-{slug} link (on load, or when the hash changes) and
 * a popular chip open that FAQ and scroll to it. While searching, every match
 * starts open and the topic counts count the matches.
 */
export function FaqExplorer({
  groups,
  hero,
  coverageTable,
  shopeeShop,
  contactEmail,
  memberAppLive,
}: FaqExplorerProps) {
  const allSlugs = useMemo(
    () => groups.flatMap((group) => group.items.map((faq) => faq.slug)),
    [groups],
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string[]>(() => allSlugs.slice(0, 1));
  // Matches start open while searching; these are the ones closed since.
  const [closedWhileSearching, setClosedWhileSearching] = useState<string[]>([]);
  const [scrollTo, setScrollTo] = useState<string | null>(null);

  const results = useMemo(() => filterFaqs(groups, query), [groups, query]);
  const searching = query.trim() !== "";
  const matches = results.flatMap((group) => group.items.map((faq) => faq.slug));
  const found = matches.length;
  const openNow = searching ? matches.filter((slug) => !closedWhileSearching.includes(slug)) : open;

  const search = (value: string) => {
    setQuery(value);
    setClosedWhileSearching([]);
  };

  const onOpenChange = (next: string[]) => {
    if (searching) setClosedWhileSearching(matches.filter((slug) => !next.includes(slug)));
    else setOpen(next);
  };

  const setAll = (expanded: boolean) => {
    setOpen(expanded ? allSlugs : []);
    setClosedWhileSearching(expanded ? [] : allSlugs);
  };

  const jumpTo = useCallback((slug: string) => {
    setQuery("");
    setClosedWhileSearching([]);
    setOpen((current) => (current.includes(slug) ? current : [...current, slug]));
    setScrollTo(slug);
  }, []);

  // Scroll once the FAQ has opened, and move focus to it for keyboard users.
  useEffect(() => {
    if (!scrollTo) return;
    const item = document.getElementById(faqElementId(scrollTo));
    item?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    item?.querySelector<HTMLElement>("[aria-expanded]")?.focus({ preventScroll: true });
    setScrollTo(null);
  }, [scrollTo]);

  // An unknown slug in the hash is ignored: the page loads as usual.
  useEffect(() => {
    const openFromHash = () => {
      const slug = slugFromHash(window.location.hash);
      if (slug && allSlugs.includes(slug)) jumpTo(slug);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [allSlugs, jumpTo]);

  const popular = groups.flatMap((group) =>
    group.items.flatMap((faq) =>
      faq.popularLabel ? [{ slug: faq.slug, label: faq.popularLabel }] : [],
    ),
  );
  const numberOf = (group: FaqGroupWithItems["group"]) =>
    listNumber(groups.findIndex((g) => g.group === group));

  return (
    <>
      <section className="bg-ayc-navy text-ayc-cream">
        <div
          className={cn(
            container,
            "flex flex-col gap-5.5 pt-[clamp(48px,6vw,96px)] pb-[clamp(40px,5vw,64px)]",
          )}
        >
          {hero}

          <div className="flex min-h-16 max-w-180 items-center gap-3 border-[1.5px] border-ayc-cream bg-ayc-cream pr-2.5 pl-5 text-ayc-navy shadow-hard-md shadow-ayc-orange">
            <span aria-hidden="true" className="text-[22px]">
              ⌕
            </span>
            <label htmlFor="faq-search" className="sr-only">
              {copy.searchLabel}
            </label>
            <input
              id="faq-search"
              type="search"
              value={query}
              onChange={(event) => search(event.target.value)}
              placeholder={memberAppLive ? copy.app.searchPlaceholder : copy.searchPlaceholder}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-lg font-medium outline-none placeholder:text-ayc-slate [&::-webkit-search-cancel-button]:hidden"
            />
            {searching ? (
              <button
                type="button"
                onClick={() => search("")}
                className={cn(mono, "min-h-11 border-[1.5px] border-ayc-navy px-3.5 text-[13px]")}
              >
                {copy.clear}
              </button>
            ) : null}
          </div>

          {popular.length > 0 ? (
            <div
              role="group"
              aria-labelledby="faq-popular"
              className="flex flex-wrap items-center gap-2"
            >
              <span
                id="faq-popular"
                className="mr-1 font-mono text-[11px] font-medium tracking-[0.06em] text-ayc-on-navy-muted uppercase"
              >
                {copy.popular}
              </span>
              {popular.map((chip) => (
                <button
                  key={chip.slug}
                  type="button"
                  onClick={() => jumpTo(chip.slug)}
                  className="min-h-10 rounded-full border-[1.5px] border-ayc-cream/50 px-3.5 text-sm font-semibold transition-colors hover:border-ayc-cream hover:bg-ayc-cream/10 focus-visible:outline-ayc-cream"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div
        className={cn(
          container,
          "flex flex-wrap items-start gap-x-[clamp(32px,5vw,72px)] gap-y-7 pt-[clamp(40px,5vw,72px)] pb-[clamp(64px,8vw,112px)]",
        )}
      >
        <div className="flex max-w-75 flex-[1_1_240px] flex-col gap-3 lg:sticky lg:top-28">
          <nav aria-labelledby="faq-topics" className="flex flex-col gap-3">
            <span id="faq-topics" className={cn(mono, "text-[11px] text-ayc-slate")}>
              {copy.topics}
            </span>
            <ul className="flex flex-col border-[1.5px] border-ayc-navy bg-ayc-paper shadow-hard">
              {results.map((group) => (
                <li key={group.group} className="border-b-[1.5px] border-ayc-navy last:border-b-0">
                  <a
                    href={`#topic-${group.group}`}
                    className="flex min-h-13 items-center gap-3 px-4 text-[15px] font-bold text-ayc-navy no-underline hover:bg-ayc-sand hover:text-ayc-navy"
                  >
                    <span
                      aria-hidden="true"
                      className="min-w-4.5 font-mono text-[11px] text-ayc-blue"
                    >
                      {numberOf(group.group)}
                    </span>
                    <span className="flex-1">{group.title}</span>
                    <span className="font-mono text-xs font-medium text-ayc-slate">
                      {group.items.length}
                      <span className="sr-only">
                        {group.items.length === 1 ? " answer" : " answers"}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex gap-2">
            {[
              { label: copy.expandAll, expanded: true },
              { label: copy.collapseAll, expanded: false },
            ].map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => setAll(action.expanded)}
                className="min-h-11 flex-1 border-[1.5px] border-ayc-navy text-[13px] font-bold hover:bg-ayc-sand"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-[3_1_420px] flex-col gap-[clamp(36px,4vw,56px)]">
          <p
            role="status"
            className={cn(mono, "text-[13px] tracking-[0.04em]", !searching && "sr-only")}
          >
            {searching
              ? `${found} ${found === 1 ? "answer" : "answers"} for “${query.trim().toUpperCase()}”`
              : null}
          </p>

          <Accordion
            type="multiple"
            value={openNow}
            onValueChange={onOpenChange}
            className="flex flex-col gap-[clamp(36px,4vw,56px)]"
          >
            {results.map((group) => (
              <section
                key={group.group}
                id={`topic-${group.group}`}
                aria-labelledby={`topic-${group.group}-heading`}
                className="flex scroll-mt-28 flex-col gap-3.5"
              >
                <h2
                  id={`topic-${group.group}-heading`}
                  className="flex items-baseline gap-3.5 text-[clamp(26px,3vw,40px)] leading-none font-extrabold tracking-[-0.03em]"
                >
                  <span
                    aria-hidden="true"
                    className="font-mono text-[clamp(22px,2.4vw,30px)] text-ayc-blue"
                  >
                    {numberOf(group.group)}
                  </span>
                  {group.title}
                </h2>
                <div className="flex flex-col gap-2.5">
                  {group.items.map((faq) => (
                    <FaqItem
                      key={faq.slug}
                      faq={faq}
                      open={openNow.includes(faq.slug)}
                      coverageTable={faq.showCoverageTable ? coverageTable : null}
                    />
                  ))}
                </div>
              </section>
            ))}
          </Accordion>

          {searching && found === 0 ? (
            <div className="flex flex-col items-start gap-3.5 border-[1.5px] border-dashed border-ayc-navy bg-ayc-paper p-8">
              <p className="text-2xl font-extrabold tracking-[-0.02em]">
                No answers for “{query.trim()}” yet.
              </p>
              <p className="text-base leading-normal text-ayc-slate">
                {shopeeShop ? (
                  copy.noResultsHint
                ) : (
                  <>
                    {copy.noResultsHintEmail}{" "}
                    <a href={`mailto:${contactEmail}`} className="font-bold">
                      {contactEmail}
                    </a>
                    .
                  </>
                )}
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => search("")}
                  className="min-h-11.5 bg-ayc-navy px-4.5 text-[15px] font-bold text-ayc-cream"
                >
                  {copy.clearSearch}
                </button>
                {shopeeShop ? (
                  <MarketplaceLink
                    href={shopeeShop}
                    marketplace="shopee"
                    link="shop"
                    className="flex min-h-11.5 items-center border-[1.5px] border-ayc-navy px-4 text-[15px] font-bold text-ayc-navy no-underline hover:text-ayc-navy"
                  >
                    {copy.chatOnShopee} <span aria-hidden="true">&nbsp;↗</span>
                  </MarketplaceLink>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

interface FaqItemProps {
  faq: FaqWithQuote;
  open: boolean;
  coverageTable: React.ReactNode;
}

function FaqItem({ faq, open, coverageTable }: FaqItemProps) {
  const quote = faq.reviewQuote;
  return (
    <AccordionItem
      value={faq.slug}
      id={faqElementId(faq.slug)}
      className="scroll-mt-28 border-[1.5px] border-ayc-navy transition-[box-shadow,background-color] last:border-b-[1.5px] data-[state=open]:bg-ayc-paper data-[state=open]:shadow-hard-md"
    >
      <AccordionTrigger className="group min-h-16 items-center gap-5 rounded-none px-[clamp(16px,2vw,24px)] py-4.5 text-[clamp(17px,1.6vw,20px)] leading-snug font-bold text-ayc-navy hover:text-ayc-blue hover:no-underline [&>svg]:hidden">
        {faq.question}
        <span
          aria-hidden="true"
          className="flex size-8.5 flex-none items-center justify-center border-[1.5px] border-ayc-navy font-mono text-lg leading-none text-ayc-navy transition-[transform,background-color] group-data-[state=open]:rotate-45 group-data-[state=open]:bg-ayc-orange motion-reduce:transition-none"
        >
          +
        </span>
      </AccordionTrigger>
      {/* Every answer is in the page's HTML, hidden while closed, so search
          engines read the same answers as the FAQPage data. */}
      <AccordionContent
        forceMount
        hidden={!open}
        className="flex max-w-[46em] flex-col gap-3.5 px-[clamp(16px,2vw,24px)] pt-0 pb-5.5"
      >
        <p className="text-[17px] leading-relaxed text-pretty whitespace-pre-line text-ayc-navy">
          {faq.answer}
        </p>
        {quote ? (
          <figure className="flex flex-col gap-1.5 border-[1.5px] border-dashed border-ayc-navy bg-ayc-cream px-4 py-3.5">
            <span className={cn(mono, "text-[11px] text-ayc-blue")}>{copy.fromAReview}</span>
            <blockquote className="text-base leading-normal whitespace-pre-line">
              “{quote.text}”
            </blockquote>
            <figcaption className="font-mono text-[11px] text-ayc-slate">
              <span role="img" aria-label={`${quote.stars} out of 5 stars`}>
                {"★".repeat(quote.stars)}
              </span>{" "}
              · {quote.product.shortName}
              {quote.variation ? ` · ${quote.variation}` : null}
            </figcaption>
          </figure>
        ) : null}
        {coverageTable}
      </AccordionContent>
    </AccordionItem>
  );
}
