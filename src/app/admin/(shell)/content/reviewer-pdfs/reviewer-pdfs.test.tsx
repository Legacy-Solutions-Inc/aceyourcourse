import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import { originalPath, pagePath } from "@/lib/reviewer-pdfs/paths";
import { readSampleUpload, receiveSampleUpload } from "@/services/uploads.mock";
import { getOrCreateMember } from "@/services/member.mock";
import { sampleUserId } from "@/services/mock/members";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { pdfOfPages, reviewerPdfFixture } from "../../../../../../test/reviewer-pdfs";
import { addReviewerPdf, createReviewerPdfUpload, removeReviewerPdf } from "./actions";
import ReviewerPdfsPage from "./page";

// Member App content → Reviewer PDFs (Phase 3, ticket 12; stories 114, 115),
// on sample data: the page as a browser loads it, and its Server Actions as a
// browser sends them, through to the job's runs after the response (here,
// the fake renderer, at once). Every Admin action's refusals for signed-out
// visitors, non-Staff and closed mode are also in actions.permissions.test.ts;
// the seam's rules, the job's and the cron's in admin.reviewer-pdfs.test.ts.
const { jar, pending } = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  pending: [] as (() => Promise<void>)[],
}));

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
  usePathname: () => "/admin/content/reviewer-pdfs",
  useRouter: () => ({ refresh: () => {}, replace: () => {} }),
  unstable_rethrow: () => {},
}));
// What `after` schedules runs when the test says, as after the response.
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => {
    pending.push(task);
  },
}));
// The sample data's renderer, without its second a page.
vi.mock("@/services/page-images.fake", async (original) => {
  const fake = await original<typeof import("@/services/page-images.fake")>();
  return { ...fake, createFakeRenderer: () => fake.createFakeRenderer() };
});

const IDLE: AdminActionState<never> = { status: "idle" };
const EDITOR = "content@aceyourcourse.ph";
const TESTER = "tester@example.com";

const signInAs = (email: string) => jar.set("ayc_admin_sample", email);
const renderPage = async () => render(await ReviewerPdfsPage());

async function afterTheResponse() {
  for (const task of pending.splice(0)) await task();
}

/** Uploads a PDF to the sample data as the screen does, and gives the path to record. */
async function upload(bytes: Uint8Array) {
  const created = await createReviewerPdfUpload(IDLE, {
    input: { contentType: "application/pdf", size: bytes.byteLength },
  });
  if (created.status !== "saved" || created.value.method !== "put") {
    throw new Error(JSON.stringify(created));
  }
  const url = new URL(created.value.uploadUrl, "http://localhost");
  const id = url.pathname.split("/").at(-1) ?? "";
  const answer = await receiveSampleUpload(id, url.searchParams.get("token") ?? "", {
    contentType: "application/pdf",
    contentLength: bytes.byteLength,
    body: async () => bytes,
  });
  expect(answer).toBe("stored");
  // The upload route never serves a Reviewer PDF back to a browser.
  expect(readSampleUpload(id)).toBeNull();
  return created.value.path;
}

beforeEach(() => {
  resetSampleStore();
  jar.clear();
  pending.length = 0;
});

afterEach(() => {
  pending.length = 0;
});

describe("the Reviewer PDFs page", () => {
  it("lists the Reviewer PDFs with the drop zone, for any Staff User", async () => {
    signInAs(EDITOR);
    await renderPage();

    expect(screen.getByRole("heading", { name: "Drop a Reviewer PDF here" })).toBeInTheDocument();
    expect(screen.getByLabelText("Choose a PDF")).toHaveAttribute("accept", "application/pdf,.pdf");
    const list = screen.getByRole("list", { name: "Reviewer PDFs" });
    // The sample data's, from before uploads.
    expect(within(list).getAllByRole("listitem").length).toBe(getSampleStore().reviewerPdfs.length);
    expect(screen.getByRole("link", { name: "← Topics" })).toHaveAttribute(
      "href",
      "/admin/content",
    );
  });

  it("sends someone signed out to sign-in, and a Member to the 403 screen", async () => {
    await expect(renderPage()).rejects.toThrow(
      "NEXT_REDIRECT /admin/sign-in?next=%2Fadmin%2Fcontent%2Freviewer-pdfs",
    );
    signInAs(TESTER);
    await expect(renderPage()).rejects.toThrow("NEXT_REDIRECT /admin/denied");
  });
});

describe("the Reviewer PDFs' actions", () => {
  it("let an Editor upload a PDF, which splits into pages after the response, and delete it", async () => {
    signInAs(EDITOR);
    const path = await upload(pdfOfPages(3));

    const added = await addReviewerPdf(IDLE, { input: { path, fileName: "MSTC Reviewer.pdf" } });

    if (added.status !== "saved") throw new Error(JSON.stringify(added));
    const { id } = added.value;
    expect(added.value).toMatchObject({ status: "processing", upload: { pagesDone: 0 } });
    await renderPage();
    expect(screen.getByRole("list", { name: "Reviewer PDFs" })).toHaveTextContent(
      "Processing · reading the PDF",
    );

    // The job runs after the response: the Editor needn't stay.
    await afterTheResponse();
    expect(getSampleStore().reviewerPdfs.find((pdf) => pdf.id === id)?.status).toBe("draft");
    expect(Object.keys(getSampleStore().reviewerPdfFiles).sort()).toEqual(
      [originalPath(id), pagePath(id, 1), pagePath(id, 2), pagePath(id, 3)].sort(),
    );

    const removed = await removeReviewerPdf(IDLE, { input: { id } });
    expect(removed).toMatchObject({ status: "saved", value: { id, status: "draft" } });
    expect(getSampleStore().reviewerPdfFiles).toEqual({});
    expect(getSampleStore().staffActivity.map(({ action }) => action)).toEqual([
      "upload",
      "delete",
    ]);
  });

  it("fail a password-protected PDF with its fix", async () => {
    signInAs(EDITOR);
    const path = await upload(reviewerPdfFixture("password"));
    await addReviewerPdf(IDLE, { input: { path, fileName: "locked.pdf" } });
    await afterTheResponse();

    await renderPage();
    const row = within(screen.getByRole("list", { name: "Reviewer PDFs" }))
      .getAllByRole("listitem")
      .find((item) => item.textContent?.includes("locked.pdf"));
    expect(row).toHaveTextContent("Couldn’t split this PDF");
    expect(row).toHaveTextContent("Remove the password and upload again.");
  });

  it("refuse a non-PDF and a PDF over 200 MB before handing out an upload", async () => {
    signInAs(EDITOR);
    for (const input of [
      { contentType: "image/png", size: 10 },
      { contentType: "application/pdf", size: 200 * 1024 * 1024 + 1 },
    ]) {
      expect(await createReviewerPdfUpload(IDLE, { input })).toMatchObject({
        status: "refused",
        error: { kind: "invalid" },
      });
    }
    expect(getSampleStore().uploads).toEqual({});
  });

  it("refuse every action from a Member, changing nothing", async () => {
    signInAs(EDITOR);
    const path = await upload(pdfOfPages(2));
    const added = await addReviewerPdf(IDLE, { input: { path, fileName: "a.pdf" } });
    if (added.status !== "saved") throw new Error("expected the upload to be recorded");
    await getOrCreateMember({ userId: sampleUserId(TESTER), email: TESTER, name: "Bea Tester" });
    signInAs(TESTER);
    const before = JSON.stringify([getSampleStore().reviewerPdfs, getSampleStore().uploads]);

    for (const post of [
      () => createReviewerPdfUpload(IDLE, { input: { contentType: "application/pdf", size: 10 } }),
      () => addReviewerPdf(IDLE, { input: { path: "uploads/x", fileName: "mine.pdf" } }),
      () => removeReviewerPdf(IDLE, { input: { id: added.value.id } }),
    ]) {
      await expect(post()).rejects.toThrow("NEXT_REDIRECT /admin/denied");
    }
    expect(JSON.stringify([getSampleStore().reviewerPdfs, getSampleStore().uploads])).toBe(before);
    expect(pending).toHaveLength(1);
  });
});
