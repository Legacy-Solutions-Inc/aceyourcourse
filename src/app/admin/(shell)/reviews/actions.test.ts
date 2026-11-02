import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import { faqFormValues, newFaqForm } from "@/lib/admin/faq-form";
import { newReviewForm, reviewFormValues } from "@/lib/admin/review-form";
import { getSampleStore, resetSampleStore, stampOf } from "@/services/mock/sample-store";

import {
  addFaq,
  addReview,
  countReviewDelete,
  moveFaqInGroup,
  moveReviewOnHome,
  removeFaq,
  removeReview,
  saveFaq,
  saveReview,
  setReviewPin,
} from "./actions";

// The REVIEWS tab's Server Actions, called as a browser would call them: each
// one is a public endpoint, so the Staff Guard and the input are checked here
// on the server, and every save clears the tags that make it live.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const IDLE: AdminActionState<never> = { status: "idle" };
const signInAs = (email: string) => jar.set("ayc_admin_sample", email);
const review = (id: string) => getSampleStore().catalogue.reviews.find((r) => r.id === id);
const formOf = (id: string) => {
  const found = review(id);
  if (!found) throw new Error(`${id} isn't in the catalogue`);
  return { id, ...reviewFormValues(found) };
};
const openedStamp = (id: string) => ({
  savedAt: stampOf(getSampleStore(), `review:${id}`).savedAt,
});

beforeEach(() => {
  jar.clear();
  resetSampleStore();
  vi.mocked(revalidateTag).mockClear();
});

describe("Reviews actions: the editor", () => {
  it("adds a Review and clears the reviews tag, so it's live", async () => {
    signInAs("content@aceyourcourse.ph");

    const state = await addReview(IDLE, {
      input: { ...newReviewForm("prd-001"), text: "Sulit!", marketplace: "lazada", helpful: "3" },
    });

    expect(state).toMatchObject({
      status: "saved",
      value: { review: { id: "rev-017", marketplace: "lazada", helpful: 3 } },
    });
    expect(revalidateTag).toHaveBeenCalledWith("catalogue:reviews");
  });

  it("saves an edit with the conflict check, and refuses a stale one", async () => {
    signInAs("angel@aceyourcourse.ph");
    const opened = openedStamp("rev-002");
    const saved = await saveReview(IDLE, {
      input: { ...formOf("rev-002"), stars: 4 },
      expected: opened,
    });
    expect(saved).toMatchObject({ status: "saved", value: { review: { stars: 4 } } });

    const stale = await saveReview(IDLE, {
      input: { ...formOf("rev-002"), stars: 1 },
      expected: opened,
    });
    expect(stale).toMatchObject({
      status: "refused",
      error: { kind: "conflict", savedBy: "Angel Rose L. Lepaña" },
    });
    expect(review("rev-002")?.stars).toBe(4);
  });

  it("answers the seam's messages: no text, and an FAQ quote the edit would break", async () => {
    signInAs("content@aceyourcourse.ph");

    expect(await addReview(IDLE, { input: newReviewForm("prd-001") })).toMatchObject({
      status: "refused",
      error: { kind: "invalid", formError: "PASTE THE REVIEW TEXT TO SAVE" },
    });
    expect(
      await saveReview(IDLE, {
        input: { ...formOf("rev-014"), text: "Quality 10/10." },
        expected: openedStamp("rev-014"),
      }),
    ).toMatchObject({
      status: "refused",
      error: {
        formError:
          "The FAQ “What are the posters like?” quotes this Review. Edit that quote first.",
      },
    });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("refuses a form that isn't the editor's shape", async () => {
    signInAs("content@aceyourcourse.ph");

    expect(
      await saveReview(IDLE, {
        input: { id: "rev-002", stars: "five" },
        expected: openedStamp("rev-002"),
      }),
    ).toMatchObject({ status: "refused", error: { kind: "invalid" } });
  });
});

describe("Reviews actions: HOME and the Home order", () => {
  it("pins a Review at the end of the Home order, even with an old stamp sent", async () => {
    signInAs("content@aceyourcourse.ph");

    const state = await setReviewPin(IDLE, {
      input: { id: "rev-002", pinned: true },
      expected: { savedAt: "2020-01-01T00:00:00.000Z" },
    });

    expect(state).toMatchObject({ status: "saved", value: { review: { homePin: 10 } } });
    expect(revalidateTag).toHaveBeenCalledWith("catalogue:reviews");
  });

  it("moves a pinned Review up, and refuses moving the first one up", async () => {
    signInAs("content@aceyourcourse.ph");

    const moved = await moveReviewOnHome(IDLE, { input: { id: "rev-006", direction: "up" } });
    expect(moved.status === "saved" && moved.value.slice(0, 2)).toEqual(["rev-006", "rev-013"]);
    expect(await moveReviewOnHome(IDLE, { input: { id: "rev-006", direction: "up" } })).toEqual({
      status: "refused",
      error: { kind: "invalid", fieldErrors: {}, formError: "IT’S ALREADY FIRST ON HOME" },
    });
  });

  it("answers not-found for a Review deleted elsewhere", async () => {
    signInAs("content@aceyourcourse.ph");
    const { catalogue } = getSampleStore();
    catalogue.reviews = catalogue.reviews.filter((r) => r.id !== "rev-006");

    expect(await setReviewPin(IDLE, { input: { id: "rev-006", pinned: false } })).toEqual({
      status: "refused",
      error: { kind: "not-found" },
    });
    expect(await moveReviewOnHome(IDLE, { input: { id: "rev-006", direction: "down" } })).toEqual({
      status: "refused",
      error: { kind: "not-found" },
    });
  });
});

describe("Reviews actions: delete", () => {
  it("counts the FAQ quotes, changing nothing, then deletes, clearing the reviews and FAQs tags", async () => {
    signInAs("content@aceyourcourse.ph");

    expect(await countReviewDelete(IDLE, { input: { id: "rev-014" } })).toEqual({
      status: "saved",
      value: { faqQuotes: 1 },
    });
    expect(revalidateTag).not.toHaveBeenCalled();

    expect(await removeReview(IDLE, { input: { id: "rev-014" } })).toEqual({
      status: "saved",
      value: { id: "rev-014", faqQuotes: 1 },
    });
    expect(revalidateTag).toHaveBeenCalledWith("catalogue:reviews");
    expect(revalidateTag).toHaveBeenCalledWith("catalogue:faqs");
    expect(review("rev-014")).toBeUndefined();
  });

  it("answers not-found once the Review is gone", async () => {
    signInAs("content@aceyourcourse.ph");
    await removeReview(IDLE, { input: { id: "rev-014" } });

    expect(await removeReview(IDLE, { input: { id: "rev-014" } })).toEqual({
      status: "refused",
      error: { kind: "not-found" },
    });
    expect(await countReviewDelete(IDLE, { input: { id: "rev-014" } })).toEqual({
      status: "refused",
      error: { kind: "not-found" },
    });
  });
});

describe("Reviews actions: the Staff Guard", () => {
  const calls = [
    ["addReview", () => addReview(IDLE, { input: { ...newReviewForm("prd-001"), text: "Hi" } })],
    [
      "saveReview",
      () => saveReview(IDLE, { input: formOf("rev-002"), expected: openedStamp("rev-002") }),
    ],
    ["setReviewPin", () => setReviewPin(IDLE, { input: { id: "rev-002", pinned: true } })],
    [
      "moveReviewOnHome",
      () => moveReviewOnHome(IDLE, { input: { id: "rev-006", direction: "up" } }),
    ],
    ["countReviewDelete", () => countReviewDelete(IDLE, { input: { id: "rev-014" } })],
    ["removeReview", () => removeReview(IDLE, { input: { id: "rev-014" } })],
  ] as const;

  it.each(calls)("sends a signed-out %s to sign-in, changing nothing", async (_name, call) => {
    const before = structuredClone(getSampleStore().catalogue.reviews);

    await expect(call()).rejects.toThrow(/^NEXT_REDIRECT \/admin\/sign-in/);
    expect(getSampleStore().catalogue.reviews).toEqual(before);
    expect(getSampleStore().staffActivity).toEqual([]);
  });

  it.each(calls)("sends %s from a User who isn't Staff to the 403 screen", async (_name, call) => {
    signInAs("juan.delacruz@gmail.com");

    await expect(call()).rejects.toThrow("NEXT_REDIRECT /admin/denied?reason=not-staff");
    expect(getSampleStore().staffActivity).toEqual([]);
  });
});

const faq = (id: string) => getSampleStore().catalogue.faqs.find((f) => f.id === id);
const faqFormOf = (id: string) => {
  const found = faq(id);
  if (!found) throw new Error(`${id} isn't in the catalogue`);
  return { id, ...faqFormValues(found) };
};
const faqStamp = (id: string) => ({ savedAt: stampOf(getSampleStore(), `faq:${id}`).savedAt });
const GCASH = { ...newFaqForm("buying"), question: "Can I pay by GCash?", answer: "Yes." };

describe("FAQ actions", () => {
  it("lets an Editor add an FAQ, and clears the FAQs tag, so it's live", async () => {
    signInAs("content@aceyourcourse.ph");

    const state = await addFaq(IDLE, { input: GCASH });

    expect(state).toMatchObject({
      status: "saved",
      value: { faq: { id: "faq-019", slug: "can-i-pay-by-gcash", group: "buying", order: 7 } },
    });
    expect(revalidateTag).toHaveBeenCalledWith("catalogue:faqs");
  });

  it("saves an edit with the conflict check, and refuses a stale one", async () => {
    signInAs("angel@aceyourcourse.ph");
    const opened = faqStamp("faq-002");
    expect(
      await saveFaq(IDLE, { input: { ...faqFormOf("faq-002"), answer: "Yes." }, expected: opened }),
    ).toMatchObject({ status: "saved", value: { faq: { answer: "Yes." } } });

    expect(
      await saveFaq(IDLE, { input: { ...faqFormOf("faq-002"), answer: "No." }, expected: opened }),
    ).toMatchObject({
      status: "refused",
      error: { kind: "conflict", savedBy: "Angel Rose L. Lepaña" },
    });
    expect(faq("faq-002")?.answer).toBe("Yes.");
  });

  it("answers the seam's messages", async () => {
    signInAs("content@aceyourcourse.ph");

    expect(await addFaq(IDLE, { input: newFaqForm("buying") })).toMatchObject({
      status: "refused",
      error: { kind: "invalid", formError: "WRITE A QUESTION AND ANSWER TO SAVE" },
    });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("refuses a form that isn't the editor's shape", async () => {
    signInAs("content@aceyourcourse.ph");

    expect(
      await saveFaq(IDLE, { input: { id: "faq-002", question: 7 }, expected: faqStamp("faq-002") }),
    ).toMatchObject({ status: "refused", error: { kind: "invalid" } });
  });

  it("moves an FAQ down in its group, and refuses ▲ on the first", async () => {
    signInAs("content@aceyourcourse.ph");

    expect(await moveFaqInGroup(IDLE, { input: { id: "faq-001", direction: "down" } })).toEqual({
      status: "saved",
      value: ["faq-002", "faq-001", "faq-003"],
    });
    expect(await moveFaqInGroup(IDLE, { input: { id: "faq-002", direction: "up" } })).toEqual({
      status: "refused",
      error: { kind: "invalid", fieldErrors: {}, formError: "IT’S ALREADY FIRST IN ITS GROUP" },
    });
  });

  it("deletes an FAQ, then answers not-found to deleting or moving it again", async () => {
    signInAs("content@aceyourcourse.ph");

    expect(await removeFaq(IDLE, { input: { id: "faq-001" } })).toEqual({
      status: "saved",
      value: { id: "faq-001" },
    });
    expect(revalidateTag).toHaveBeenCalledWith("catalogue:faqs");
    expect(await removeFaq(IDLE, { input: { id: "faq-001" } })).toEqual({
      status: "refused",
      error: { kind: "not-found" },
    });
    expect(await moveFaqInGroup(IDLE, { input: { id: "faq-001", direction: "down" } })).toEqual({
      status: "refused",
      error: { kind: "not-found" },
    });
  });

  const calls = [
    ["addFaq", () => addFaq(IDLE, { input: GCASH })],
    [
      "saveFaq",
      () => saveFaq(IDLE, { input: faqFormOf("faq-002"), expected: faqStamp("faq-002") }),
    ],
    ["moveFaqInGroup", () => moveFaqInGroup(IDLE, { input: { id: "faq-001", direction: "down" } })],
    ["removeFaq", () => removeFaq(IDLE, { input: { id: "faq-001" } })],
  ] as const;

  it.each(calls)("sends a signed-out %s to sign-in, changing nothing", async (_name, call) => {
    const before = structuredClone(getSampleStore().catalogue.faqs);

    await expect(call()).rejects.toThrow(/^NEXT_REDIRECT \/admin\/sign-in/);
    expect(getSampleStore().catalogue.faqs).toEqual(before);
    expect(getSampleStore().staffActivity).toEqual([]);
  });

  it.each(calls)("sends %s from a User who isn't Staff to the 403 screen", async (_name, call) => {
    signInAs("juan.delacruz@gmail.com");

    await expect(call()).rejects.toThrow("NEXT_REDIRECT /admin/denied?reason=not-staff");
    expect(getSampleStore().staffActivity).toEqual([]);
  });
});
