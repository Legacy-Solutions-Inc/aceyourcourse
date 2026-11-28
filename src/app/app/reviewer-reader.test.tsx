import { cleanup, render, screen } from "@testing-library/react";
import sharp from "sharp";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_COOKIE } from "@/lib/member-app/device-token";
import {
  addBetaTester,
  placeReviewerPdf,
  recordReviewerPdf,
  runReviewerPdfJob,
  setReviewerPdfFreePreview,
  setReviewerPdfPublished,
} from "@/services/admin.mock";
import {
  addTargetExam,
  getOrCreateMember,
  listStudyDays,
  recordConsent,
} from "@/services/member.mock";
import { sampleTopicId } from "@/services/mock/content";
import { sampleUserId } from "@/services/mock/members";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import { createFakeRenderer, FAKE_PAGE_IMAGE } from "@/services/page-images.fake";
import { sharpStamper } from "@/services/page-images.sharp";

import { sampleActor } from "../../../test/admin-inputs";
import { AGREED_TO_CURRENT, onThisDevice, TEST_DEVICE_TOKEN } from "../../../test/member-inputs";
import { uploadSampleReviewerPdf } from "../../../test/reviewer-pdf-uploads";
import { pdfOfPages } from "../../../test/reviewer-pdfs";
import { saveReadingPosition } from "./(shell)/library/actions";
import { GET as pageEndpoint } from "./reviewer-pdfs/[id]/pages/[page]/route";
import { redirectsTo } from "../../../test/redirects";

// Reading a Reviewer PDF in the Member App (Phase 3, ticket 14; stories 101,
// 102 and 105), on sample data: the protected page endpoint as the reader's
// <img> requests it, the Reviewer PDF's page as a browser loads it, and the
// reader's Server Action as a browser sends it. The reader itself is in
// reviewer-reader.test.tsx, the seam's rules in member.reviewer.test.ts, and
// the stamp in page-images.sharp.test.ts: here sharp stamps the sample
// data's tiny page for real. An Editor uploads a 3-page PDF and places it
// under CE MSTC's Surveying. It's 17 Nov 2026, 11:42 in Manila; the
// tester's CE pass ends in 90 days, the lapsed tester's ended 3 days ago,
// and the new tester has none.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/app/library/reviewer-pdf",
  useRouter: () => ({ refresh: () => {} }),
  unstable_rethrow: () => {},
}));

const BOOT = new Date("2026-11-17T03:42:00.000Z");
const EDITOR = sampleActor("editor");
const OWNER = sampleActor("owner");
const TESTER = "tester@example.com";
const SURVEYING = sampleTopicId("CE", "MSTC", "Surveying");
const UNKNOWN = "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";

const readerPage = (id: string) => `/app/library/reviewer-pdf/${id}`;

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

/** An Editor's 3-page upload, split and placed under Surveying; Published unless asked, and Free Preview when asked. */
async function reviewerPdf({ publish = true, freePreview = false } = {}): Promise<string> {
  const path = await uploadSampleReviewerPdf(pdfOfPages(3));
  const recorded = await recordReviewerPdf(EDITOR, { path, fileName: "Surveying.pdf" });
  if (!recorded.ok) throw new Error(JSON.stringify(recorded.error));
  const { id } = recorded.value;
  while ((await runReviewerPdfJob(id, createFakeRenderer())) === "more");
  const placed = await placeReviewerPdf(EDITOR, { id, topic: SURVEYING });
  if (!placed.ok) throw new Error(JSON.stringify(placed.error));
  if (freePreview) await setReviewerPdfFreePreview(EDITOR, id, true);
  if (publish) await setReviewerPdfPublished(EDITOR, id, true);
  return id;
}

const getPage = (id: string, page: string) =>
  pageEndpoint(new Request(`http://localhost/app/reviewer-pdfs/${id}/pages/${page}`), {
    params: Promise.resolve({ id, page }),
  });
const opening = async (id: string) =>
  (await import("./(shell)/library/[kind]/[id]/page")).default({
    params: Promise.resolve({ kind: "reviewer-pdf", id }),
    searchParams: Promise.resolve({}),
  });
const devicePage = async (next: string) =>
  (await import("./device/page")).default({ searchParams: Promise.resolve({ next }) });

const viewsOf = (userId: string) =>
  getSampleStore()
    .reviewerPageViews.filter((view) => view.userId === userId)
    .map((view) => view.page);

/** Whether a response's cache headers let anything but the Member's own browser keep it. */
function sharedCacheable(response: Response): boolean {
  const control = response.headers.get("cache-control") ?? "";
  return /\bpublic\b|s-maxage/.test(control) || !/\bprivate\b/.test(control);
}

// sharp's first text loads its fonts, which takes a second or two: once, here, not in a test.
beforeAll(async () => {
  await sharpStamper.stamp(FAKE_PAGE_IMAGE, { email: TESTER, memberId: "00000000" });
});

/** The page endpoint as the reader's fetch reaches it: here it never answers, so a page stays loading. */
const endpoint = vi.fn(() => new Promise<Response>(() => {}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(BOOT);
  jar.clear();
  resetSampleStore();
  endpoint.mockClear();
  vi.stubGlobal("fetch", endpoint);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("the page endpoint", () => {
  it("sends the tester a page stamped for them, kept only by their browser and only briefly", async () => {
    const userId = await asTester();
    const id = await reviewerPdf();

    const response = await getPage(id, "2");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toBe("private, max-age=300");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(sharedCacheable(response)).toBe(false);
    const image = new Uint8Array(await response.arrayBuffer());
    // Stamped, never the clean page.
    expect(Buffer.from(image).equals(Buffer.from(FAKE_PAGE_IMAGE))).toBe(false);
    expect(await sharp(image).metadata()).toMatchObject({ format: "webp", width: 16, height: 21 });
    // Viewing it counts: the page, and the day as a Study Day.
    expect(viewsOf(userId)).toEqual([2]);
    expect(await listStudyDays(userId)).toEqual(["2026-11-17"]);
  });

  it("stamps each Member's copy of the same page differently", async () => {
    const id = await reviewerPdf({ freePreview: true });
    await asTester();
    const mine = new Uint8Array(await (await getPage(id, "1")).arrayBuffer());
    await asNewTester();
    const theirs = new Uint8Array(await (await getPage(id, "1")).arrayBuffer());

    expect(Buffer.from(mine).equals(Buffer.from(theirs))).toBe(false);
  });

  it.each([
    ["the new tester's locked one", asNewTester, "locked"],
    ["the lapsed tester's expired one", asLapsed, "expired"],
  ])("refuses %s with no image bytes, recording nothing", async (_case, signIn, outcome) => {
    const userId = await signIn();
    const id = await reviewerPdf();

    const response = await getPage(id, "1");

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toMatch(/^application\/json/);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ refused: outcome });
    expect(viewsOf(userId)).toEqual([]);
  });

  it("decides before it reads the page number: a locked Member isn't told which pages exist", async () => {
    await asNewTester();
    const id = await reviewerPdf();
    for (const page of ["99", "0", "two"]) {
      const response = await getPage(id, page);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ refused: "locked" });
    }
  });

  it("refuses a Draft's pages and an Unpublished one's as no longer available, even to Staff", async () => {
    await memberOnDevice(OWNER.email, OWNER.name);
    const draft = await reviewerPdf({ publish: false });
    expect(await (await getPage(draft, "1")).json()).toEqual({ refused: "unavailable" });

    await setReviewerPdfPublished(EDITOR, draft, true);
    expect((await getPage(draft, "1")).status).toBe(200);
    await setReviewerPdfPublished(EDITOR, draft, false);
    const response = await getPage(draft, "1");
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ refused: "unavailable" });
  });

  it.each(["0", "4", "-1", "1.5", "two", "01", ""])(
    "answers 404 for page %j, which it doesn't have",
    async (page) => {
      const userId = await asTester();
      const id = await reviewerPdf();
      const response = await getPage(id, page);
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(viewsOf(userId)).toEqual([]);
    },
  );

  it("answers 404 for a Reviewer PDF that isn't one", async () => {
    await asTester();
    expect((await getPage(UNKNOWN, "1")).status).toBe(404);
    expect((await getPage("not-an-id", "1")).status).toBe(404);
  });

  it("sends a replaced device to “Session ended”, with no page", async () => {
    await asTester();
    const id = await reviewerPdf();
    jar.set(DEVICE_COOKIE, "a-token-from-before-the-switch");

    await expect(getPage(id, "1")).rejects.toThrow(
      redirectsTo(`/app/device?next=${encodeURIComponent(readerPage(id))}`),
    );
    render(await devicePage(readerPage(id)));
    expect(
      screen.getByRole("heading", { level: 1, name: "You were signed in on another device" }),
    ).toBeInTheDocument();
  });

  it("sends a request with no device token to “Use the Member App on this device”, with no page", async () => {
    await asTester();
    const id = await reviewerPdf();
    jar.delete(DEVICE_COOKIE);

    await expect(getPage(id, "1")).rejects.toThrow(
      redirectsTo(`/app/device?next=${encodeURIComponent(readerPage(id))}`),
    );
    render(await devicePage(readerPage(id)));
    expect(
      screen.getByRole("heading", { level: 1, name: "Use the Member App on this device?" }),
    ).toBeInTheDocument();
  });

  it("sends someone signed out to sign in, and a Member who hasn't agreed to consent", async () => {
    const id = await reviewerPdf();
    await expect(getPage(id, "1")).rejects.toThrow(/^NEXT_REDIRECT \/app\/sign-in\?next=/);

    const userId = sampleUserId(TESTER);
    await getOrCreateMember({ userId, email: TESTER, name: "Bea Tester" });
    jar.set("ayc_admin_sample", TESTER);
    await expect(getPage(id, "1")).rejects.toThrow(/^NEXT_REDIRECT \/app\/consent\?next=/);
  });
});

describe("the Reviewer PDF's page", () => {
  it("opens the reader at page 1 the first time, and where the tester left it after", async () => {
    await asTester();
    const id = await reviewerPdf();

    const { unmount } = render(await opening(id));
    expect(screen.getByText("MSTC Reviewer · Surveying")).toBeInTheDocument();
    expect(screen.getByText("PAGE 1 / 3")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    // The reader asks the page endpoint for the stamped page: the page itself holds no image.
    expect(endpoint).toHaveBeenCalledWith(`/app/reviewer-pdfs/${id}/pages/1`, {
      redirect: "manual",
    });
    unmount();

    expect(await saveReadingPosition({ reviewerPdfId: id, page: 3, zoom: 125 })).toEqual({
      status: "saved",
    });
    render(await opening(id));
    expect(screen.getByText("PAGE 3 / 3")).toBeInTheDocument();
    expect(screen.getByText("125%")).toBeInTheDocument();
    expect(endpoint).toHaveBeenLastCalledWith(`/app/reviewer-pdfs/${id}/pages/3`, {
      redirect: "manual",
    });
  });

  it("shows the new tester the unlock prompt, and links no page", async () => {
    await asNewTester();
    const id = await reviewerPdf();

    render(await opening(id));

    expect(
      screen.getByRole("heading", { level: 2, name: "Unlock with CE All-Access" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
    expect(document.body.innerHTML).not.toContain("/pages/");
  });

  it("tells the lapsed tester to renew, keeping the pages they viewed", async () => {
    const id = await reviewerPdf({ freePreview: true });
    const userId = await asLapsed();
    await getPage(id, "1");
    await getPage(id, "2");
    expect(viewsOf(userId)).toEqual([1, 2]);
    await setReviewerPdfFreePreview(EDITOR, id, false);

    render(await opening(id));

    expect(
      screen.getByRole("heading", { level: 2, name: "Your CE All-Access ended on 14 Nov 2026" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Renew to keep reviewing\. Your progress is kept: 2 pages viewed\./),
    ).toBeInTheDocument();
  });

  it("says an Unpublished one is no longer available", async () => {
    await asTester();
    const id = await reviewerPdf();
    await setReviewerPdfPublished(EDITOR, id, false);

    render(await opening(id));

    expect(
      screen.getByRole("heading", { level: 2, name: "No longer available" }),
    ).toBeInTheDocument();
  });

  it("sends a replaced device to the Active Device screen, coming back to the Reviewer PDF", async () => {
    await asTester();
    const id = await reviewerPdf();
    jar.set(DEVICE_COOKIE, "a-token-from-before-the-switch");
    await expect(opening(id)).rejects.toThrow(
      redirectsTo(`/app/device?next=${encodeURIComponent(readerPage(id))}`),
    );
  });
});

describe("the reader's action", () => {
  it("refuses a locked Member's place, saving nothing", async () => {
    const userId = await asNewTester();
    const id = await reviewerPdf();

    expect(await saveReadingPosition({ reviewerPdfId: id, page: 2, zoom: 100 })).toEqual({
      status: "refused",
      decision: { outcome: "locked" },
    });
    expect(getSampleStore().readerPositions.filter((p) => p.userId === userId)).toEqual([]);
  });

  it("saves nothing for a page it doesn't have, a zoom the reader doesn't offer, or what isn't a place", async () => {
    await asTester();
    const id = await reviewerPdf();

    for (const input of [
      { reviewerPdfId: id, page: 9, zoom: 100 },
      { reviewerPdfId: id, page: 2, zoom: 110 },
      { reviewerPdfId: id, page: "2", zoom: 100 },
      null,
    ]) {
      expect(await saveReadingPosition(input)).toEqual({ status: "not-found" });
    }
    expect(getSampleStore().readerPositions).toEqual([]);
  });

  it("sends a replaced device to the Active Device screen, saving nothing", async () => {
    await asTester();
    const id = await reviewerPdf();
    jar.set(DEVICE_COOKIE, "a-token-from-before-the-switch");

    await expect(saveReadingPosition({ reviewerPdfId: id, page: 2, zoom: 100 })).rejects.toThrow(
      redirectsTo(`/app/device?next=${encodeURIComponent(readerPage(id))}`),
    );
    expect(getSampleStore().readerPositions).toEqual([]);
  });
});
