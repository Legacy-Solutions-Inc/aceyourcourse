import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import {
  bundleFormValues,
  headerFormValues,
  seoFormValues,
  subjectFormValues,
} from "@/lib/admin/exam-page-form";
import { getExamPageForAdmin } from "@/services/admin";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import {
  createShareImageUpload,
  saveBundleOffer,
  saveExamHeader,
  saveExamSeo,
  saveOfficialExamDate,
  saveSubjectNames,
  setExamPageSection,
} from "./actions";

// Exam pages & promo's Server Actions, called as a browser would call them:
// each one is a public endpoint, so the Staff Guard and the input are checked
// here on the server, and every save clears the tags that make it live.
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
const EDITOR = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
} as const;
const signInAs = (email: string) => jar.set("ayc_admin_sample", email);

async function opened(code: string) {
  const page = await getExamPageForAdmin(EDITOR, code);
  if (!page) throw new Error(`${code} isn't in the catalogue`);
  return page;
}

beforeEach(() => {
  jar.clear();
  resetSampleStore();
  vi.mocked(revalidateTag).mockClear();
});

describe("Exam pages actions", () => {
  it("hides a section at once, clearing the exam-pages tag", async () => {
    signInAs(EDITOR.email);
    const state = await setExamPageSection(IDLE, {
      input: { code: "me", section: "reviews", on: false },
    });

    expect(state).toMatchObject({
      status: "saved",
      value: { page: { sections: { reviews: false } } },
    });
    expect(revalidateTag).toHaveBeenCalledWith("catalogue:exam-pages");
  });

  it("saves the Header with the conflict check, clearing the exams tag, and refuses a stale one", async () => {
    signInAs("angel@aceyourcourse.ph");
    const { exam, stamps } = await opened("CE");
    const input = { code: "ce", ...headerFormValues(exam), blurb: "Every CE formula." };

    expect(await saveExamHeader(IDLE, { input, expected: stamps.header })).toMatchObject({
      status: "saved",
      value: { exam: { blurb: "Every CE formula." } },
    });
    expect(revalidateTag).toHaveBeenCalledWith("catalogue:exams");
    expect(await saveExamHeader(IDLE, { input, expected: stamps.header })).toMatchObject({
      status: "refused",
      error: { kind: "conflict", savedBy: "Angel Rose L. Lepaña" },
    });
  });

  it("refuses an empty name with its field's message", async () => {
    signInAs(EDITOR.email);
    const { exam, stamps } = await opened("CE");
    const state = await saveExamHeader(IDLE, {
      input: { code: "ce", ...headerFormValues(exam), name: "" },
      expected: stamps.header,
    });
    expect(state).toMatchObject({
      status: "refused",
      error: { kind: "invalid", fieldErrors: { name: ["ADD THE EXAM NAME"] } },
    });
  });

  it("renames a Subject, clearing the exams tag", async () => {
    signInAs(EDITOR.email);
    const { exam, stamps } = await opened("CE");
    const { subjects } = subjectFormValues(exam);
    const state = await saveSubjectNames(IDLE, {
      input: {
        code: "ce",
        subjects: subjects.map((s, i) => (i === 0 ? { ...s, name: "Math" } : s)),
      },
      expected: stamps.subjects,
    });
    expect(state).toMatchObject({ status: "saved" });
    expect(getSampleStore().catalogue.exams[0]?.subjects[0]).toEqual({
      code: "MSTC",
      name: "Math",
    });
    expect(revalidateTag).toHaveBeenCalledWith("catalogue:exams");
  });

  it("saves the bundle offer, the SEO and the date, each clearing the exam-pages tag", async () => {
    signInAs(EDITOR.email);
    const { page, stamps } = await opened("CE");

    expect(
      await saveBundleOffer(IDLE, {
        input: { code: "ce", ...bundleFormValues(page), headline: "The CE bundle" },
        expected: stamps.bundleOffer,
      }),
    ).toMatchObject({ status: "saved" });
    expect(
      await saveExamSeo(IDLE, {
        input: { code: "ce", ...seoFormValues(page), seoTitle: "CE Board Exam Reviewer" },
        expected: stamps.seo,
      }),
    ).toMatchObject({ status: "saved", value: { page: { seoTitle: "CE Board Exam Reviewer" } } });
    expect(
      await saveOfficialExamDate(IDLE, {
        input: { code: "ce", officialExamDate: "2027-04-24" },
        expected: stamps.officialExamDate,
      }),
    ).toMatchObject({ status: "saved", value: { page: { officialExamDate: "2027-04-24" } } });
    expect(vi.mocked(revalidateTag).mock.calls).toEqual([
      ["catalogue:exam-pages"],
      ["catalogue:exam-pages"],
      ["catalogue:exam-pages"],
    ]);
  });

  it("refuses an input of the wrong shape before the seam sees it", async () => {
    signInAs(EDITOR.email);
    expect(
      await setExamPageSection(IDLE, { input: { code: "ce", section: "reviews", on: "off" } }),
    ).toMatchObject({ status: "refused", error: { kind: "invalid" } });
    expect(getSampleStore().staffActivity).toEqual([]);
  });

  it("gives an Editor a one-time URL for a share image, and refuses a GIF", async () => {
    signInAs(EDITOR.email);
    const state = await createShareImageUpload(IDLE, {
      input: { contentType: "image/png", size: 2048 },
    });
    expect(state).toMatchObject({
      status: "saved",
      value: { path: expect.stringMatching(/^uploads\//) },
    });
    expect(Object.values(getSampleStore().uploads)).toEqual([
      expect.objectContaining({ purpose: "share-image", contentType: "image/png" }),
    ]);

    expect(
      await createShareImageUpload(IDLE, { input: { contentType: "image/gif", size: 2048 } }),
    ).toMatchObject({
      status: "refused",
      error: { fieldErrors: { contentType: ["USE A JPEG, PNG OR WEBP IMAGE"] } },
    });
  });
});

describe("Exam pages actions: the Staff Guard", () => {
  const calls = [
    () => setExamPageSection(IDLE, { input: { code: "ce", section: "reviews", on: false } }),
    () => saveOfficialExamDate(IDLE, { input: { code: "ce", officialExamDate: "" } }),
    () => createShareImageUpload(IDLE, { input: { contentType: "image/png", size: 10 } }),
  ];

  it.each(calls.map((call, index) => [index, call] as const))(
    "sends a signed-out caller (%i) to sign in, changing nothing",
    async (_index, call) => {
      await expect(call()).rejects.toThrow(/^NEXT_REDIRECT \/admin\/sign-in/);
      expect(getSampleStore().staffActivity).toEqual([]);
    },
  );

  it.each(calls.map((call, index) => [index, call] as const))(
    "sends a User who isn't Staff (%i) to the 403 screen, changing nothing",
    async (_index, call) => {
      signInAs("juan.delacruz@gmail.com");
      await expect(call()).rejects.toThrow("NEXT_REDIRECT /admin/denied?reason=not-staff");
      expect(getSampleStore().staffActivity).toEqual([]);
      expect(getSampleStore().uploads).toEqual({});
    },
  );
});
