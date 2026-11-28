import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_COOKIE } from "@/lib/member-app/device-token";
import type { AdminCard } from "@/services/admin.types";
import {
  addBetaTester,
  createCard,
  setDeckFreePreview,
  setDeckVisibility,
} from "@/services/admin.mock";
import {
  addTargetExam,
  getOrCreateMember,
  listStudyDays,
  recordConsent,
} from "@/services/member.mock";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";
import { sampleUserId } from "@/services/mock/members";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { sampleActor } from "../../../test/admin-inputs";
import { uploadSampleCardImage } from "../../../test/card-images";
import { imageBytes } from "../../../test/image-bytes";
import { AGREED_TO_CURRENT, onThisDevice, TEST_DEVICE_TOKEN } from "../../../test/member-inputs";
import { markStudyCard, saveStudyPosition } from "./(shell)/library/actions";
import { redirectsTo } from "../../../test/redirects";

// Studying a deck in the Member App (Phase 3, ticket 08; stories 95–97, 104
// and 106), on sample data: the deck page as a browser loads it, and the
// player's Server Actions as a browser sends them. The player itself is in
// deck-player.test.tsx; the seam's rules in member.study.test.ts. It's 17
// Nov 2026, 11:42 in Manila. The sample CE MSTC decks: Simple Curves' is
// Visible and Free Preview, Spiral Curves' Visible, Algebra's Hidden, all
// with no cards until an Editor writes them. The tester's CE pass ends in 90
// days, the lapsed tester's ended 3 days ago, and the stranger has none.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/app/library/deck",
  useRouter: () => ({ refresh: () => {} }),
  unstable_rethrow: () => {},
}));

const BOOT = new Date("2026-11-17T03:42:00.000Z");
const EDITOR = sampleActor("editor");
const OWNER = sampleActor("owner");
const TESTER = "tester@example.com";

const topic = (name: string) => sampleTopicId("CE", "MSTC", name);
const FREE_DECK = sampleContentId(topic("Simple Curves"), "deck");
const PASS_DECK = sampleContentId(topic("Spiral Curves"), "deck");
const HIDDEN_DECK = sampleContentId(topic("Algebra"), "deck");
const deckPage = (id: string) => `/app/library/deck/${id}`;

/** Signed in as this sample User, a Member who has agreed, with CE selected, on this browser. */
async function memberOnDevice(email: string, name: string) {
  const userId = sampleUserId(email);
  await getOrCreateMember({ userId, email, name });
  await recordConsent(userId, AGREED_TO_CURRENT);
  await addTargetExam(userId, { examCode: "CE", examDate: "2027-01-10" });
  await onThisDevice(userId);
  jar.set("ayc_admin_sample", email);
  jar.set(DEVICE_COOKIE, TEST_DEVICE_TOKEN);
  return userId;
}
const asTester = () => memberOnDevice(TESTER, "Bea Tester");
const asLapsed = () => memberOnDevice("lapsed@example.com", "Lou Lapsed");
async function asNewTester() {
  await addBetaTester(OWNER, { email: "stranger@example.com" });
  return memberOnDevice("stranger@example.com", "Sam Stranger");
}

/** An Editor writes cards in a Topic's deck, in order. */
async function writeCards(name: string, ...fronts: string[]): Promise<AdminCard[]> {
  const cards: AdminCard[] = [];
  for (const front of fronts) {
    const added = await createCard(EDITOR, { topic: topic(name), front, back: "$x^2$" });
    if (!added.ok) throw new Error("Not added");
    cards.push(added.value);
  }
  return cards;
}

const opening = async (id: string) =>
  (await import("./(shell)/library/[kind]/[id]/page")).default({
    params: Promise.resolve({ kind: "deck", id }),
    searchParams: Promise.resolve({}),
  });

/** The Member's marks, as the sample data holds them. */
const marksOf = (userId: string) =>
  getSampleStore()
    .cardMarks.filter((mark) => mark.userId === userId)
    .map(({ cardId, verdict }) => [cardId, verdict]);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(BOOT);
  jar.clear();
  resetSampleStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the deck page", () => {
  it("opens a deck the tester's pass allows in the player, as a focus screen", async () => {
    const userId = await asTester();
    await writeCards("Spiral Curves", "Spiral angle", "Length of spiral");
    render(await opening(PASS_DECK));

    expect(screen.getByRole("heading", { level: 1, name: "Spiral Curves" })).toBeInTheDocument();
    expect(screen.getByText("CARD 1 / 2")).toBeInTheDocument();
    const front = screen.getByRole("figure", { name: "Card front" });
    expect(front).toHaveTextContent("Spiral angle");
    expect(front).toHaveTextContent("MSTC · SPIRAL CURVES");
    const watermark = front.querySelector("[data-watermark]") as HTMLElement;
    expect(decodeURIComponent(watermark.style.backgroundImage)).toContain(
      `${TESTER} · ${userId.slice(0, 8).toUpperCase()}`,
    );
    // The breadcrumb, and the back bar below 760 px.
    expect(
      within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByText("MSTC · FLASHCARDS"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Back" })).getByRole("link", {
        name: "Back to MSTC topics",
      }),
    ).toHaveAttribute("href", "/app/library?subject=MSTC");
  });

  it("opens a Free Preview deck for a new tester with no pass", async () => {
    await asNewTester();
    await writeCards("Simple Curves", "Tangent distance");
    render(await opening(FREE_DECK));
    expect(screen.getByRole("figure", { name: "Card front" })).toHaveTextContent(
      "Tangent distance",
    );
  });

  it("says a deck with no cards yet is still being prepared", async () => {
    await asNewTester();
    render(await opening(FREE_DECK));

    expect(screen.getByRole("heading", { level: 2, name: "Nothing here yet" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "These flashcards are still being prepared. They’ll show up here automatically.",
      ),
    ).toBeInTheDocument();
  });

  it("never sends a locked deck's cards to the browser, showing the unlock prompt", async () => {
    await asNewTester();
    await writeCards("Spiral Curves", "A secret formula");
    const page = await opening(PASS_DECK);
    render(page);

    expect(
      screen.getByRole("heading", { level: 2, name: "Unlock with CE All-Access" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See plans" })).toHaveAttribute(
      "href",
      "/app/plans?exam=CE",
    );
    expect(document.body.innerHTML).not.toContain("A secret formula");
    // Nor in what the server would send for the page's client parts.
    expect(JSON.stringify(page)).not.toContain("A secret formula");
  });

  it("tells the lapsed tester their pass ended, with the marks they made kept", async () => {
    const userId = await asLapsed();
    const [card] = await writeCards("Simple Curves", "Tangent distance");
    // Marked while the deck was Free Preview; then Staff ended Free Preview.
    await markStudyCard({ deckId: FREE_DECK, cardId: card?.id, verdict: "got", position: null });
    await setDeckFreePreview(EDITOR, FREE_DECK, false);
    render(await opening(FREE_DECK));

    expect(
      screen.getByRole("heading", { level: 2, name: "Your CE All-Access ended on 14 Nov 2026" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Your access ended\. Renew to keep reviewing\. Your progress is kept: 1 card marked\./,
      ),
    ).toBeInTheDocument();
    expect(marksOf(userId)).toEqual([[card?.id, "got"]]);
  });

  it("says a Hidden deck is no longer available, never showing its cards", async () => {
    await asTester();
    await writeCards("Algebra", "Quadratic formula");
    render(await opening(HIDDEN_DECK));

    expect(
      screen.getByRole("heading", { level: 2, name: "No longer available" }),
    ).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("Quadratic formula");
  });

  it("offers to continue where the Member left the deck", async () => {
    await asTester();
    const [, second] = await writeCards("Spiral Curves", "First", "Second");
    await saveStudyPosition({ deckId: PASS_DECK, cardId: second?.id });
    render(await opening(PASS_DECK));

    expect(
      screen.getByRole("heading", { level: 2, name: "You stopped at card 2 of 2" }),
    ).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Continue at card 2" }));
    expect(screen.getByRole("figure", { name: "Card front" })).toHaveTextContent("Second");
  });

  it("shows a card's image from a signed URL", async () => {
    await asTester();
    const image = await uploadSampleCardImage(imageBytes("image/png"));
    await createCard(EDITOR, { topic: topic("Spiral Curves"), front: "S", back: "$s$", image });
    render(await opening(PASS_DECK));
    await userEvent.setup().keyboard(" ");

    expect(
      within(screen.getByRole("figure", { name: "Card back" })).getByRole("img"),
    ).toHaveAttribute("src", expect.stringMatching(/^\/api\/dev\/card-images\/[\w-]+$/));
  });

  it("answers 404 for a deck that isn't there", async () => {
    await asTester();
    await expect(opening("3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sends a replaced device to the Active Device screen, coming back to the deck", async () => {
    await asTester();
    jar.set(DEVICE_COOKIE, "a-token-from-before-the-switch");
    await expect(opening(PASS_DECK)).rejects.toThrow(
      redirectsTo(`/app/device?next=${encodeURIComponent(deckPage(PASS_DECK))}`),
    );
  });
});

describe("the player's actions", () => {
  it("saves the Member's mark, where they are in the deck, and today as a Study Day", async () => {
    const userId = await asTester();
    const [first, second] = await writeCards("Spiral Curves", "First", "Second");

    expect(
      await markStudyCard({
        deckId: PASS_DECK,
        cardId: first?.id,
        verdict: "again",
        position: { cardId: second?.id },
      }),
    ).toEqual({ status: "saved" });
    expect(marksOf(userId)).toEqual([[first?.id, "again"]]);
    expect(getSampleStore().deckPositions).toEqual([
      { userId, deckId: PASS_DECK, cardId: second?.id, savedAt: BOOT.toISOString() },
    ]);
    expect(await listStudyDays(userId)).toEqual(["2026-11-17"]);
  });

  it("clears where the Member is once they finish the deck", async () => {
    await asTester();
    const [first] = await writeCards("Spiral Curves", "First");
    await saveStudyPosition({ deckId: PASS_DECK, cardId: first?.id });

    expect(await saveStudyPosition({ deckId: PASS_DECK, cardId: null })).toEqual({
      status: "saved",
    });
    expect(getSampleStore().deckPositions).toEqual([]);
  });

  it("refuses a mark on a locked deck's card, changing nothing", async () => {
    const userId = await asNewTester();
    const [card] = await writeCards("Spiral Curves", "Spiral angle");

    expect(
      await markStudyCard({ deckId: PASS_DECK, cardId: card?.id, verdict: "got", position: null }),
    ).toEqual({ status: "refused", decision: { outcome: "locked" } });
    expect(marksOf(userId)).toEqual([]);
    expect(await listStudyDays(userId)).toEqual([]);
  });

  it("says no longer available once the deck is hidden mid-session, keeping the marks", async () => {
    const userId = await asTester();
    const [first, second] = await writeCards("Spiral Curves", "First", "Second");
    await markStudyCard({ deckId: PASS_DECK, cardId: first?.id, verdict: "got", position: null });
    await setDeckVisibility(EDITOR, PASS_DECK, false);

    expect(
      await markStudyCard({
        deckId: PASS_DECK,
        cardId: second?.id,
        verdict: "got",
        position: null,
      }),
    ).toEqual({ status: "refused", decision: { outcome: "unavailable" } });
    expect(await saveStudyPosition({ deckId: PASS_DECK, cardId: second?.id })).toEqual({
      status: "refused",
      decision: { outcome: "unavailable" },
    });
    expect(marksOf(userId)).toEqual([[first?.id, "got"]]);
  });

  it("refuses a mark from a replaced device, changing nothing", async () => {
    const userId = await asTester();
    const [card] = await writeCards("Spiral Curves", "Spiral angle");
    jar.set(DEVICE_COOKIE, "a-token-from-before-the-switch");

    await expect(
      markStudyCard({ deckId: PASS_DECK, cardId: card?.id, verdict: "got", position: null }),
    ).rejects.toThrow(redirectsTo(`/app/device?next=${encodeURIComponent(deckPage(PASS_DECK))}`));
    expect(marksOf(userId)).toEqual([]);
    expect(await listStudyDays(userId)).toEqual([]);
  });

  it.each([
    ["a verdict that isn't one", { verdict: "maybe" }],
    ["a card id that isn't one", { cardId: "card-1" }],
    ["no deck", { deckId: undefined }],
    ["a position that isn't one", { position: "end" }],
  ])("changes nothing for %s", async (_case, forged) => {
    const userId = await asTester();
    const [card] = await writeCards("Spiral Curves", "Spiral angle");

    expect(
      await markStudyCard({
        deckId: PASS_DECK,
        cardId: card?.id,
        verdict: "got",
        position: null,
        ...forged,
      }),
    ).toEqual({ status: "not-found" });
    expect(marksOf(userId)).toEqual([]);
  });

  it("keeps one Member's marks to themselves", async () => {
    await asTester();
    const [card] = await writeCards("Simple Curves", "Tangent distance");
    await markStudyCard({ deckId: FREE_DECK, cardId: card?.id, verdict: "again", position: null });

    await asNewTester();
    render(await opening(FREE_DECK));
    // Straight to the summary: the tester's Review again isn't the stranger's.
    await userEvent.setup().click(screen.getByRole("button", { name: "Finish deck →" }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "0 of 1 got it · 0 to review again",
    );
  });

  it("sends someone signed out to sign in, coming back to the deck", async () => {
    await expect(
      markStudyCard({ deckId: PASS_DECK, cardId: PASS_DECK, verdict: "got", position: null }),
    ).rejects.toThrow(redirectsTo(`/app/sign-in?next=${encodeURIComponent(deckPage(PASS_DECK))}`));
  });
});
