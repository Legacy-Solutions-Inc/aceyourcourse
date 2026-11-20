import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import { CHOOSE_A_TOPIC } from "@/lib/reviewer-pdfs/status";
import { recordReviewerPdf, runReviewerPdfJob } from "@/services/admin.mock";
import { getOrCreateMember } from "@/services/member.mock";
import { sampleTopicId } from "@/services/mock/content";
import { sampleUserId } from "@/services/mock/members";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import { createFakeRenderer, FAKE_PAGE_IMAGE } from "@/services/page-images.fake";

import { sampleActor } from "../../../../../../../test/admin-inputs";
import { uploadSampleReviewerPdf } from "../../../../../../../test/reviewer-pdf-uploads";
import { pdfOfPages } from "../../../../../../../test/reviewer-pdfs";
import { addExam } from "../../../exam-pages/actions";
import { addTopic } from "../../actions";
import {
  saveReviewerPdfFreePreview,
  saveReviewerPdfPlacement,
  saveReviewerPdfPublished,
} from "../actions";
import ReviewerPdfPage from "./page";
import { GET as reviewerPdfPage } from "./pages/[page]/route";

// Member App content → one Reviewer PDF (Phase 3, ticket 13; stories 116,
// 128, 133o), on sample data: the page as a browser loads it, its Server
// Actions as a browser posts them, and the Staff-only page route its preview
// reads. Every Admin action's refusals for signed-out visitors, non-Staff and
// closed mode are also in actions.permissions.test.ts; the seam's rules in
// admin.reviewer-pdf-publishing.test.ts.
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
  usePathname: () => "/admin/content/reviewer-pdfs",
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  unstable_rethrow: () => {},
}));

const IDLE: AdminActionState<never> = { status: "idle" };
const EDITOR = "content@aceyourcourse.ph";
const OWNER = sampleActor("owner").email;
const TESTER = "tester@example.com";
const SURVEYING = sampleTopicId("CE", "MSTC", "Surveying");
const UNKNOWN = "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";

const signInAs = (email: string) => jar.set("ayc_admin_sample", email);
const renderPage = async (id: string) =>
  render(await ReviewerPdfPage({ params: Promise.resolve({ id }) }));
const getPage = (id: string, page: string) =>
  reviewerPdfPage(new Request(`http://localhost/admin/content/reviewer-pdfs/${id}/pages/${page}`), {
    params: Promise.resolve({ id, page }),
  });

/** An Editor's upload, split into its 3 pages: a Draft, not placed yet. */
async function splitDraft(): Promise<string> {
  const path = await uploadSampleReviewerPdf(pdfOfPages(3));
  const recorded = await recordReviewerPdf(sampleActor("editor"), {
    path,
    fileName: "Surveying Reviewer.pdf",
  });
  if (!recorded.ok) throw new Error(JSON.stringify(recorded.error));
  const { id } = recorded.value;
  while ((await runReviewerPdfJob(id, createFakeRenderer())) === "more");
  return id;
}

const statusOf = (id: string) => getSampleStore().reviewerPdfs.find((pdf) => pdf.id === id)?.status;

beforeEach(() => {
  resetSampleStore();
  jar.clear();
});

describe("a Reviewer PDF's page", () => {
  it("shows an Editor its preview, placement and Publish, disabled until it's placed", async () => {
    const id = await splitDraft();
    signInAs(EDITOR);

    await renderPage(id);

    expect(
      screen.getByRole("heading", { level: 2, name: "Surveying Reviewer.pdf" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Page 1 of 3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toHaveAccessibleDescription(
      CHOOSE_A_TOPIC,
    );
    expect(screen.getByRole("button", { name: "+ New topic" })).toBeInTheDocument();
    // "+ Add exam" and "+ Add subject" are Owners' only.
    expect(screen.queryByRole("button", { name: "+ Add exam" })).toBeNull();
    expect(screen.queryByRole("button", { name: /\+ Add subject/ })).toBeNull();
    expect(screen.getByRole("link", { name: "← Reviewer PDFs" })).toHaveAttribute(
      "href",
      "/admin/content/reviewer-pdfs",
    );
  });

  it("gives an Owner “+ Add exam” and “+ Add subject”", async () => {
    const id = await splitDraft();
    signInAs(OWNER);

    await renderPage(id);

    expect(screen.getByRole("button", { name: "+ Add exam" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add subject to CE" })).toBeInTheDocument();
  });

  it("is a 404 for an id that isn't a Reviewer PDF's", async () => {
    signInAs(EDITOR);
    await expect(renderPage(UNKNOWN)).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(renderPage("not-an-id")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sends someone signed out to sign-in, and a Member to the 403 screen", async () => {
    const id = await splitDraft();
    await expect(renderPage(id)).rejects.toThrow(
      `NEXT_REDIRECT /admin/sign-in?next=${encodeURIComponent(`/admin/content/reviewer-pdfs/${id}`)}`,
    );
    signInAs(TESTER);
    await expect(renderPage(id)).rejects.toThrow("NEXT_REDIRECT /admin/denied");
  });
});

describe("its actions", () => {
  it("let an Editor place it under a new Topic, publish, unpublish and publish it again", async () => {
    const id = await splitDraft();
    signInAs(EDITOR);

    const made = await addTopic(IDLE, {
      input: { exam: "CE", subject: "MSTC", name: "Transition Curves" },
    });
    if (made.status !== "saved") throw new Error(JSON.stringify(made));
    const placed = await saveReviewerPdfPlacement(IDLE, {
      input: { id, topic: made.value.id },
      expected: { savedAt: getSampleStore().bootedAt },
    });
    expect(placed).toMatchObject({
      status: "saved",
      value: { topicId: made.value.id, placement: { topicName: "Transition Curves" } },
    });

    for (const published of [true, false, true]) {
      expect(await saveReviewerPdfPublished(IDLE, { input: { id, published } })).toMatchObject({
        status: "saved",
      });
    }
    expect(statusOf(id)).toBe("published");
    expect(
      getSampleStore().staffActivity.map(({ entity, action }) => `${entity} ${action}`),
    ).toEqual([
      "reviewer-pdf upload",
      "topic add",
      "reviewer-pdf place",
      "reviewer-pdf publish",
      "reviewer-pdf unpublish",
      "reviewer-pdf publish",
    ]);
  });

  it("refuse a direct post publishing one with no Topic, changing nothing", async () => {
    const id = await splitDraft();
    signInAs(EDITOR);

    const result = await saveReviewerPdfPublished(IDLE, { input: { id, published: true } });

    expect(result).toEqual({
      status: "refused",
      error: { kind: "invalid", fieldErrors: {}, formError: CHOOSE_A_TOPIC },
    });
    expect(statusOf(id)).toBe("draft");
  });

  it("refuse a placement sent without the stamp its form opened with, so the conflict check can't be skipped", async () => {
    const id = await splitDraft();
    signInAs(EDITOR);

    const result = await saveReviewerPdfPlacement(IDLE, { input: { id, topic: SURVEYING } });

    expect(result).toMatchObject({ status: "refused", error: { kind: "invalid" } });
    expect(getSampleStore().reviewerPdfs.find((pdf) => pdf.id === id)?.topicId).toBeNull();
  });

  it("refuse an Editor's post to the Owner-only “+ Add exam”", async () => {
    signInAs(EDITOR);
    const exams = getSampleStore().catalogue.exams.length;

    const result = await addExam(IDLE, {
      input: {
        code: "CHE",
        board: "CHELE",
        name: "Chemical Engineering",
        longName: "Chemical Engineering Licensure Examination",
        blurb: "",
        madeFor: "",
        subjects: [{ code: "PCHEM", name: "Physical Chemistry" }],
      },
    });

    expect(result).toMatchObject({ status: "refused", error: { kind: "forbidden" } });
    expect(getSampleStore().catalogue.exams).toHaveLength(exams);
  });

  it("refuse every post from a Member, changing nothing", async () => {
    const id = await splitDraft();
    await getOrCreateMember({ userId: sampleUserId(TESTER), email: TESTER, name: "Bea Tester" });
    signInAs(TESTER);
    const before = JSON.stringify([getSampleStore().reviewerPdfs, getSampleStore().staffActivity]);

    for (const post of [
      () =>
        saveReviewerPdfPlacement(IDLE, {
          input: { id, topic: SURVEYING },
          expected: { savedAt: getSampleStore().bootedAt },
        }),
      () => saveReviewerPdfPublished(IDLE, { input: { id, published: true } }),
      () => saveReviewerPdfFreePreview(IDLE, { input: { id, freePreview: true } }),
      () => addTopic(IDLE, { input: { exam: "CE", subject: "MSTC", name: "Mine" } }),
    ]) {
      await expect(post()).rejects.toThrow("NEXT_REDIRECT /admin/denied");
    }
    expect(JSON.stringify([getSampleStore().reviewerPdfs, getSampleStore().staffActivity])).toBe(
      before,
    );
  });
});

describe("its page route", () => {
  it("sends Staff a clean page image, privately, never cached anywhere", async () => {
    const id = await splitDraft();
    signInAs(EDITOR);

    const response = await getPage(id, "2");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(FAKE_PAGE_IMAGE);
  });

  it.each(["4", "0", "1.5", "-1", "two", "01"])(
    "answers 404 for page %j, which it doesn't have",
    async (page) => {
      const id = await splitDraft();
      signInAs(EDITOR);
      const response = await getPage(id, page);
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    },
  );

  it("answers 404 for a Reviewer PDF that isn't there", async () => {
    signInAs(EDITOR);
    expect((await getPage(UNKNOWN, "1")).status).toBe(404);
  });

  it("never sends a page to a Member or someone signed out", async () => {
    const id = await splitDraft();
    await expect(getPage(id, "1")).rejects.toThrow("NEXT_REDIRECT /admin/sign-in");
    signInAs(TESTER);
    await expect(getPage(id, "1")).rejects.toThrow("NEXT_REDIRECT /admin/denied");
  });
});
