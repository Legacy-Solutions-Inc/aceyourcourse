import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type { AdminCard } from "@/services/admin.types";
import { getOrCreateMember } from "@/services/member.mock";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";
import { sampleUserId } from "@/services/mock/members";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { uploadSampleCardImage } from "../../../../../../test/card-images";
import { imageBytes } from "../../../../../../test/image-bytes";
import {
  addCard,
  createCardImageUpload,
  moveCardInDeck,
  removeCard,
  saveCard,
  saveDeckFreePreview,
  saveDeckVisibility,
} from "../actions";
import { GET as cardImage } from "./image/[card]/route";
import DeckPage from "./page";

// Member App content → a Topic's deck in the card editor (Phase 3, ticket 07;
// stories 125, 127, 128), on sample data: the page as a browser loads it, its
// Server Actions as a browser sends them, and the Staff-only image route.
// Every Admin action's refusals for signed-out visitors, non-Staff and closed
// mode are also in actions.permissions.test.ts; the seam's rules in
// admin.deck.test.ts.
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
  usePathname: () => "/admin/content/deck",
  useRouter: () => ({ refresh: () => {}, replace: () => {} }),
  unstable_rethrow: () => {},
}));

const IDLE: AdminActionState<never> = { status: "idle" };
const EDITOR = "content@aceyourcourse.ph";
const OWNER = "angel@aceyourcourse.ph";
const TESTER = "tester@example.com";
const ALGEBRA = sampleTopicId("CE", "MSTC", "Algebra");
const ALGEBRA_DECK = sampleContentId(ALGEBRA, "deck");

const signInAs = (email: string) => jar.set("ayc_admin_sample", email);
const renderPage = async (params: Record<string, string> = {}) =>
  render(await DeckPage({ searchParams: Promise.resolve(params) }));

async function addOne(front: string): Promise<AdminCard> {
  const state = await addCard(IDLE, { input: { topic: ALGEBRA, front, back: "$x^2$" } });
  if (state.status !== "saved") throw new Error(`Not added: ${JSON.stringify(state)}`);
  return state.value;
}

beforeEach(() => {
  jar.clear();
  resetSampleStore();
});

describe("the deck page", () => {
  it("opens an Editor on a Topic's deck: its state, its cards and a new card's form", async () => {
    signInAs(EDITOR);
    await addOne("Quadratic formula");
    await addOne("Slope");
    await renderPage({ topic: ALGEBRA });

    expect(screen.getByRole("heading", { level: 2, name: "Algebra flashcards" })).toBeVisible();
    expect(screen.getByText("CE · MSTC · 2 CARDS · HIDDEN")).toBeInTheDocument();
    const cards = screen.getByRole("list", { name: "Cards in Algebra" });
    expect(
      within(cards)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Quadratic formula", "Slope"]);
    expect(screen.getByRole("form", { name: "New card" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← MSTC Topics" })).toHaveAttribute(
      "href",
      "/admin/content?exam=ce&subject=mstc",
    );
  });

  it("opens the card the address names in the form", async () => {
    signInAs(OWNER);
    const card = await addOne("Slope");
    await renderPage({ topic: ALGEBRA, card: card.id });

    const form = screen.getByRole("form", { name: "Card 1" });
    expect(within(form).getByLabelText(/FRONT/)).toHaveValue("Slope");
  });

  it("answers 404 for a Topic that isn't there", async () => {
    signInAs(EDITOR);
    await expect(renderPage({ topic: "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b" })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    await expect(renderPage({})).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sends someone signed out to sign-in, and a Member to the 403 screen", async () => {
    await expect(renderPage({ topic: ALGEBRA })).rejects.toThrow("NEXT_REDIRECT /admin/sign-in");
    signInAs(TESTER);
    await expect(renderPage({ topic: ALGEBRA })).rejects.toThrow("NEXT_REDIRECT /admin/denied");
  });
});

describe("the card editor's actions", () => {
  it("lets an Editor add, edit, move and delete cards, and make the deck Visible", async () => {
    signInAs(EDITOR);
    const first = await addOne("First");
    const second = await addOne("Second");

    const edited = await saveCard(IDLE, {
      input: { id: first.id, front: "First, edited", back: "$y$", note: "", image: null },
      expected: first.stamp,
    });
    expect(edited).toMatchObject({ status: "saved", value: { front: "First, edited" } });
    expect(await moveCardInDeck(IDLE, { input: { id: second.id, direction: "up" } })).toMatchObject(
      { status: "saved", value: [second.id, first.id] },
    );
    expect(
      await saveDeckVisibility(IDLE, { input: { deck: ALGEBRA_DECK, visible: true } }),
    ).toMatchObject({ status: "saved", value: { visibility: "visible" } });
    expect(
      await saveDeckFreePreview(IDLE, { input: { deck: ALGEBRA_DECK, freePreview: true } }),
    ).toMatchObject({ status: "saved", value: { freePreview: true } });
    expect(await removeCard(IDLE, { input: { id: first.id } })).toMatchObject({
      status: "saved",
      value: { deckHidden: false },
    });
  });

  it("refuses an empty deck made Visible, and an edit without the stamp it opened with", async () => {
    signInAs(EDITOR);
    expect(
      await saveDeckVisibility(IDLE, { input: { deck: ALGEBRA_DECK, visible: true } }),
    ).toEqual({
      status: "refused",
      error: { kind: "invalid", fieldErrors: {}, formError: "ADD A CARD FIRST" },
    });

    const card = await addOne("Slope");
    expect(
      await saveCard(IDLE, { input: { id: card.id, front: "Forged", back: "$x$" } }),
    ).toMatchObject({ status: "refused", error: { kind: "invalid" } });
    expect(getSampleStore().cards.map((c) => c.front)).toEqual(["Slope"]);
  });

  it("hands an Editor a one-time upload URL for a card image, and refuses a GIF or a big one", async () => {
    signInAs(EDITOR);
    expect(
      await createCardImageUpload(IDLE, { input: { contentType: "image/png", size: 2048 } }),
    ).toMatchObject({ status: "saved", value: { contentType: "image/png" } });
    expect(
      await createCardImageUpload(IDLE, { input: { contentType: "image/gif", size: 2048 } }),
    ).toMatchObject({
      status: "refused",
      error: { fieldErrors: { contentType: ["USE A JPEG, PNG OR WEBP IMAGE"] } },
    });
    expect(
      await createCardImageUpload(IDLE, {
        input: { contentType: "image/png", size: 5 * 1024 * 1024 + 1 },
      }),
    ).toMatchObject({
      status: "refused",
      error: { fieldErrors: { size: ["KEEP THE IMAGE TO 5 MB"] } },
    });
  });

  it("refuses every card action from a Member, changing nothing", async () => {
    signInAs(EDITOR);
    const card = await addOne("Kept");
    await getOrCreateMember({ userId: sampleUserId(TESTER), email: TESTER, name: "Bea Tester" });
    signInAs(TESTER);
    const before = JSON.stringify({
      cards: getSampleStore().cards,
      decks: getSampleStore().decks,
      uploads: getSampleStore().uploads,
    });

    for (const post of [
      () => addCard(IDLE, { input: { topic: ALGEBRA, front: "F", back: "B" } }),
      () =>
        saveCard(IDLE, {
          input: { id: card.id, front: "F", back: "B" },
          expected: card.stamp,
        }),
      () => moveCardInDeck(IDLE, { input: { id: card.id, direction: "down" } }),
      () => removeCard(IDLE, { input: { id: card.id } }),
      () => saveDeckVisibility(IDLE, { input: { deck: ALGEBRA_DECK, visible: true } }),
      () => saveDeckFreePreview(IDLE, { input: { deck: ALGEBRA_DECK, freePreview: true } }),
      () => createCardImageUpload(IDLE, { input: { contentType: "image/png", size: 10 } }),
    ]) {
      await expect(post()).rejects.toThrow("NEXT_REDIRECT /admin/denied");
    }
    expect(
      JSON.stringify({
        cards: getSampleStore().cards,
        decks: getSampleStore().decks,
        uploads: getSampleStore().uploads,
      }),
    ).toBe(before);
  });
});

describe("the card image route", () => {
  async function cardWithImage(): Promise<{ card: AdminCard; bytes: Uint8Array }> {
    const bytes = imageBytes("image/png");
    const upload = await uploadSampleCardImage(bytes);
    const state = await addCard(IDLE, {
      input: { topic: ALGEBRA, front: "Beam", back: "$x$", image: upload },
    });
    if (state.status !== "saved") throw new Error("Not added");
    return { card: state.value, bytes };
  }

  const get = (card: string) =>
    cardImage(new Request(`http://localhost/admin/content/deck/image/${card}`), {
      params: Promise.resolve({ card }),
    });

  it("sends Staff a card's image, privately, never cached for anyone else", async () => {
    signInAs(EDITOR);
    const { card, bytes } = await cardWithImage();
    const response = await get(card.id);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  it("answers 404 for a card with no image, or no such card", async () => {
    signInAs(EDITOR);
    const card = await addOne("Plain");

    expect((await get(card.id)).status).toBe(404);
    expect((await get("not-a-card")).status).toBe(404);
  });

  it("sends someone signed out to sign-in, and a Member to the 403 screen", async () => {
    signInAs(EDITOR);
    const { card } = await cardWithImage();
    jar.clear();

    await expect(get(card.id)).rejects.toThrow("NEXT_REDIRECT /admin/sign-in");
    signInAs(TESTER);
    await expect(get(card.id)).rejects.toThrow("NEXT_REDIRECT /admin/denied");
  });
});
