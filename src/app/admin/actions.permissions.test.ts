import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import {
  bundleFormValues,
  headerFormValues,
  seoFormValues,
  subjectFormValues,
} from "@/lib/admin/exam-page-form";
import { faqFormValues } from "@/lib/admin/faq-form";
import { productFormValues } from "@/lib/admin/product-form";
import { announcementFormValues, promoBannerFormValues } from "@/lib/admin/promo-form";
import { reviewFormValues } from "@/lib/admin/review-form";
import { getExamPageForAdmin } from "@/services/admin";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { SAVES, sampleActor, sampleEmail } from "../../../test/admin-inputs";

import * as examPages from "./(shell)/exam-pages/actions";
import * as products from "./(shell)/products/actions";
import * as reviews from "./(shell)/reviews/actions";
import * as settings from "./(shell)/settings/actions";
import * as root from "./actions";
import * as signIn from "./sign-in/actions";

// ─────────────────────────────────────────────────────────────────────────────
// The permission matrix (spec, Testing Decisions → Permission and deny-all
// tests; stories 59 and 60). Every Admin Server Action is a public endpoint,
// so each one is called here as a browser would call it, by every caller it
// must refuse:
//   - signed out, which goes to sign-in,
//   - a User who isn't Staff, who goes to the 403 screen,
//   - an Editor, for the Owners-only actions, which answer "forbidden", and
//   - anyone at all with the Admin mode forced to closed, which answers 404.
// Each refusal leaves the sample store exactly as it was. The registry below
// lists every action with the Staff Role it needs, and an input that saves:
// each one is also called by the least Staff Role allowed, so a wrong role in
// the registry, or an input the refusals never reached, fails too. A new
// action in any "use server" module under src/app/admin that isn't in the
// registry fails the first test.
// ─────────────────────────────────────────────────────────────────────────────

const { jar, mode } = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  mode: { current: "sample" as "sample" | "closed" },
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
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
// The mode as the server would compute it, which a test can force to closed.
vi.mock("@/lib/admin/mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/mode")>()),
  get adminMode() {
    return mode.current;
  },
}));

const IDLE: AdminActionState<never> = { status: "idle" };
const OWNER = sampleEmail("owner");
const EDITOR = sampleEmail("editor");
const NOT_STAFF = sampleEmail("not-staff");
const READER = sampleActor("editor");

const signInAs = (email: string) => jar.set("ayc_admin_sample", email);
/** The stamp every record has before anyone saves it. */
const opened = () => ({ savedAt: getSampleStore().bootedAt });

function find<T extends { id: string }>(list: T[], id: string): T {
  const found = list.find((item) => item.id === id);
  if (!found) throw new Error(`${id} isn't in the sample data`);
  return found;
}

async function cePage() {
  const page = await getExamPageForAdmin(READER, "ce");
  if (!page) throw new Error("CE isn't in the sample data");
  return page;
}

function signInForm(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

/**
 * Who may call an action: any Staff User, Owners only, or anyone, for signing
 * in and out, which need no Staff Role. Those two are refused only when the
 * Admin is closed.
 */
type Role = "staff" | "owner" | "anyone";
interface Entry {
  role: Role;
  /** Calls the action with an input it would save. */
  call: () => Promise<unknown>;
  /** An editor's save: the same call without the stamp its editor opened with. */
  withoutStamp?: () => Promise<unknown>;
}

const staff = (call: Entry["call"]): Entry => ({ role: "staff", call });
const owner = (call: Entry["call"]): Entry => ({ role: "owner", call });
const anyone = (call: Entry["call"]): Entry => ({ role: "anyone", call });

/** An editor's save, which must send the stamp its editor opened with. */
function editorSave<T>(
  role: "staff" | "owner",
  action: AdminAction<T>,
  input: () => unknown,
): Entry {
  return {
    role,
    call: async () => action(IDLE, { input: await input(), expected: opened() }),
    withoutStamp: async () => action(IDLE, { input: await input() }),
  };
}

/** This folder: every actions.ts under it holds Admin Server Actions. */
const ADMIN_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Every exported Admin Server Action, by its module, relative to this folder. */
const REGISTRY: Record<string, Record<string, Entry>> = {
  "./actions.ts": {
    signOut: anyone(() => root.signOut()),
    switchAccount: anyone(() => root.switchAccount()),
    resetSampleData: staff(() => root.resetSampleData()),
  },
  "./sign-in/actions.ts": {
    signInAs: anyone(() => signIn.signInAs({ error: null, email: "" }, signInForm(OWNER))),
    // Live mode only: sample mode answers 404 (see sign-in/live.test.tsx).
    continueWithGoogle: anyone(() => signIn.continueWithGoogle(new FormData())),
    // Live mode under pnpm dev only (ticket 19): elsewhere it answers 404.
    signInWithPassword: anyone(() =>
      signIn.signInWithPassword({ error: null, fieldErrors: {}, email: "" }, signInForm(OWNER)),
    ),
  },
  "./(shell)/settings/actions.ts": {
    saveContactEmail: editorSave("owner", settings.saveContactEmail, () => ({
      contactEmail: SAVES.contactEmail,
    })),
    saveLinks: editorSave("owner", settings.saveLinks, () => ({
      shopLinks: { shopee: "shopee.ph/aceyourcourse", lazada: "", tiktok: "" },
      socialLinks: { tiktok: "", facebook: "", instagram: "" },
    })),
    saveTrustFigures: editorSave("owner", settings.saveTrustFigures, () => ({
      shopStats: { rating: "4.9", ratingCount: "900", followers: "3.8K" },
    })),
    addInvite: owner(() => settings.addInvite(IDLE, { input: SAVES.invite })),
    renewStaffInvite: owner(() =>
      settings.renewStaffInvite(IDLE, { input: { email: sampleEmail("expired") } }),
    ),
    cancelStaffInvite: owner(() =>
      settings.cancelStaffInvite(IDLE, { input: { email: sampleEmail("invited") } }),
    ),
    changeStaffMemberRole: owner(() =>
      settings.changeStaffMemberRole(IDLE, { input: { email: EDITOR, role: "owner" } }),
    ),
    removeStaffMember: owner(() => settings.removeStaffMember(IDLE, { input: { email: EDITOR } })),
  },
  "./(shell)/products/actions.ts": {
    setProductFlag: staff(() =>
      products.setProductFlag(IDLE, { input: { id: "prd-001", showOnWebsite: false } }),
    ),
    addProduct: staff(() =>
      products.addProduct(IDLE, {
        input: SAVES.newProduct,
      }),
    ),
    saveProduct: editorSave("staff", products.saveProduct, () => {
      const product = find(getSampleStore().catalogue.products, "prd-001");
      return { id: product.id, ...productFormValues(product), priceFrom: SAVES.priceFrom };
    }),
    countProductDelete: staff(() =>
      products.countProductDelete(IDLE, { input: { id: "prd-005" } }),
    ),
    removeProduct: staff(() => products.removeProduct(IDLE, { input: { id: "prd-005" } })),
    createPhotoUpload: staff(() =>
      products.createPhotoUpload(IDLE, { input: { contentType: "image/png", size: 2048 } }),
    ),
  },
  "./(shell)/reviews/actions.ts": {
    setReviewPin: staff(() =>
      reviews.setReviewPin(IDLE, { input: { id: "rev-002", pinned: true } }),
    ),
    moveReviewOnHome: staff(() =>
      reviews.moveReviewOnHome(IDLE, { input: { id: "rev-006", direction: "up" } }),
    ),
    addReview: staff(() => reviews.addReview(IDLE, { input: SAVES.newReview })),
    saveReview: editorSave("staff", reviews.saveReview, () => {
      const review = find(getSampleStore().catalogue.reviews, "rev-002");
      return { id: review.id, ...reviewFormValues(review), stars: 4 };
    }),
    countReviewDelete: staff(() => reviews.countReviewDelete(IDLE, { input: { id: "rev-014" } })),
    removeReview: staff(() => reviews.removeReview(IDLE, { input: { id: "rev-014" } })),
    addFaq: staff(() =>
      reviews.addFaq(IDLE, {
        input: SAVES.newFaq,
      }),
    ),
    saveFaq: editorSave("staff", reviews.saveFaq, () => {
      const faq = find(getSampleStore().catalogue.faqs, "faq-002");
      return { id: faq.id, ...faqFormValues(faq), answer: "Yes." };
    }),
    moveFaqInGroup: staff(() =>
      reviews.moveFaqInGroup(IDLE, { input: { id: "faq-001", direction: "down" } }),
    ),
    removeFaq: staff(() => reviews.removeFaq(IDLE, { input: { id: "faq-001" } })),
  },
  "./(shell)/exam-pages/actions.ts": {
    setExamPageSection: staff(() =>
      examPages.setExamPageSection(IDLE, { input: { code: "me", section: "reviews", on: false } }),
    ),
    saveExamHeader: editorSave("staff", examPages.saveExamHeader, async () => ({
      code: "ce",
      ...headerFormValues((await cePage()).exam),
      blurb: SAVES.examBlurb,
    })),
    saveSubjectNames: editorSave("staff", examPages.saveSubjectNames, async () => {
      const { subjects } = subjectFormValues((await cePage()).exam);
      return {
        code: "ce",
        subjects: subjects.map((subject, i) => (i === 0 ? { ...subject, name: "Math" } : subject)),
      };
    }),
    saveBundleOffer: editorSave("staff", examPages.saveBundleOffer, async () => ({
      code: "ce",
      ...bundleFormValues((await cePage()).page),
      headline: SAVES.bundleHeadline,
    })),
    saveExamSeo: editorSave("staff", examPages.saveExamSeo, async () => ({
      code: "ce",
      ...seoFormValues((await cePage()).page),
      seoTitle: SAVES.seoTitle,
    })),
    saveOfficialExamDate: editorSave("staff", examPages.saveOfficialExamDate, () => ({
      code: "ce",
      officialExamDate: SAVES.officialExamDate,
    })),
    createShareImageUpload: staff(() =>
      examPages.createShareImageUpload(IDLE, {
        input: { code: "CE", contentType: "image/png", size: 2048 },
      }),
    ),
    saveSitePageSeo: editorSave("staff", examPages.saveSitePageSeo, () => ({
      site: "about",
      seoTitle: SAVES.seoTitle,
      seoDescription: "",
      shareImage: "",
    })),
    createSitePageShareImageUpload: staff(() =>
      examPages.createSitePageShareImageUpload(IDLE, {
        input: { site: "faq", contentType: "image/png", size: 2048 },
      }),
    ),
    saveAboutSection: editorSave("staff", examPages.saveAboutSection, () => ({
      section: "closing",
      heading: "Your turn.",
    })),
    createAboutPhotoUpload: staff(() =>
      examPages.createAboutPhotoUpload(IDLE, {
        input: { slot: "story-2", contentType: "image/png", size: 2048 },
      }),
    ),
    savePromoBanner: editorSave("staff", examPages.savePromoBanner, () => ({
      ...promoBannerFormValues(getSampleStore().catalogue.settings.promoBanner),
      buttonLabel: SAVES.bannerButtonLabel,
    })),
    setPromoBanner: staff(() => examPages.setPromoBanner(IDLE, { input: { visible: true } })),
    saveAnnouncement: editorSave("staff", examPages.saveAnnouncement, () => {
      const { messages } = announcementFormValues(getSampleStore().catalogue.settings.announcement);
      return { messages: messages.slice(0, 1) };
    }),
  },
};

const ENTRIES = Object.entries(REGISTRY).flatMap(([module, actions]) =>
  Object.entries(actions).map(([name, entry]) => ({ module, name, ...entry })),
);
const GUARDED = ENTRIES.filter((entry) => entry.role !== "anyone");
const OWNERS_ONLY = ENTRIES.filter((entry) => entry.role === "owner");
const EDITOR_SAVES = ENTRIES.flatMap(({ withoutStamp, ...entry }) =>
  withoutStamp ? [{ ...entry, withoutStamp }] : [],
);
const named = <T extends { module: string; name: string }>(entries: T[]) =>
  entries.map(
    (entry) => [`${entry.module.replace(/^\.\/(\(shell\)\/)?/, "")} ${entry.name}`, entry] as const,
  );

/** The whole sample store, byte for byte. */
const snapshot = () => JSON.stringify(getSampleStore());

beforeEach(() => {
  jar.clear();
  mode.current = "sample";
  resetSampleStore();
  vi.mocked(revalidateTag).mockClear();
});

describe("the action registry", () => {
  it("lists every exported Admin Server Action, and nothing else", async () => {
    // Every "use server" module, whatever its name, holds Server Actions.
    const files = readdirSync(ADMIN_DIR, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .filter((file) =>
        /^["']use server["']/.test(readFileSync(path.join(ADMIN_DIR, file), "utf8").trimStart()),
      )
      .map((file) => `./${file.split(path.sep).join("/")}`);
    const exported = Object.fromEntries(
      await Promise.all(
        files.map(async (module) => {
          const exports: Record<string, unknown> = await import(path.join(ADMIN_DIR, module));
          const actions = Object.keys(exports).filter(
            (name) => typeof exports[name] === "function",
          );
          return [module, actions.sort()] as const;
        }),
      ),
    );
    const registered = Object.fromEntries(
      Object.entries(REGISTRY).map(([module, actions]) => [module, Object.keys(actions).sort()]),
    );

    expect(registered).toEqual(exported);
  });

  // The registry's role and input are right: the least Staff Role it names
  // gets the action through, so the refusals below are the Guard's doing.
  it.each(named(GUARDED))("%s goes through for the least Staff Role allowed", async (_, entry) => {
    signInAs(entry.role === "owner" ? OWNER : EDITOR);
    const before = getSampleStore().generation;

    const result = await entry.call();

    if (entry.name === "resetSampleData") {
      expect(getSampleStore().generation).not.toBe(before);
    } else {
      expect(result).toMatchObject({ status: "saved" });
    }
  });

  it("lets anyone sign in and out: the staff list decides what happens next", async () => {
    await expect(REGISTRY["./sign-in/actions.ts"]?.signInAs?.call()).rejects.toThrow(
      "NEXT_REDIRECT /admin",
    );
    expect(jar.get("ayc_admin_sample")).toBe(OWNER);

    await expect(REGISTRY["./actions.ts"]?.signOut?.call()).rejects.toThrow(
      "NEXT_REDIRECT /admin/sign-in",
    );
    expect(jar.has("ayc_admin_sample")).toBe(false);
  });

  it("lets anyone use another account: sample mode signs out to the Sign in as list", async () => {
    signInAs(NOT_STAFF);
    await expect(REGISTRY["./actions.ts"]?.switchAccount?.call()).rejects.toThrow(
      /^NEXT_REDIRECT \/admin\/sign-in$/,
    );
    expect(jar.has("ayc_admin_sample")).toBe(false);
  });

  it("has no Continue with Google in sample mode", async () => {
    await expect(REGISTRY["./sign-in/actions.ts"]?.continueWithGoogle?.call()).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("has no password box in sample mode", async () => {
    await expect(REGISTRY["./sign-in/actions.ts"]?.signInWithPassword?.call()).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});

describe("the permission matrix", () => {
  it.each(named(GUARDED))(
    "%s sends a signed-out caller to sign-in, changing nothing",
    async (_, entry) => {
      const before = snapshot();

      await expect(entry.call()).rejects.toThrow(/^NEXT_REDIRECT \/admin\/sign-in/);
      expect(snapshot()).toBe(before);
      expect(revalidateTag).not.toHaveBeenCalled();
    },
  );

  // The Guard records the refusal, as it does on any Admin request from a
  // User who isn't Staff (ticket 03), and changes nothing else.
  it.each(named(GUARDED))(
    "%s sends a User who isn't Staff to the 403 screen, changing nothing but the refusal log",
    async (_, entry) => {
      signInAs(NOT_STAFF);
      const before = getSampleStore();
      const unchanged = JSON.stringify({ ...before, deniedSignIns: [] });

      await expect(entry.call()).rejects.toThrow("NEXT_REDIRECT /admin/denied?reason=not-staff");
      const after = getSampleStore();
      expect(JSON.stringify({ ...after, deniedSignIns: [] })).toBe(unchanged);
      expect(after.deniedSignIns).toEqual([
        { id: expect.any(String), email: NOT_STAFF, reason: "not-staff", at: expect.any(String) },
      ]);
      expect(revalidateTag).not.toHaveBeenCalled();
    },
  );

  it.each(named(OWNERS_ONLY))("%s refuses an Editor, changing nothing", async (_, entry) => {
    signInAs(EDITOR);
    const before = snapshot();

    expect(await entry.call()).toEqual({
      status: "refused",
      error: { kind: "forbidden", message: "ONLY AN OWNER CAN DO THIS" },
    });
    expect(snapshot()).toBe(before);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  // A forged request can't skip the conflict check by leaving out the stamp.
  it.each(named(EDITOR_SAVES))(
    "%s refuses a save sent without its editor's stamp, changing nothing",
    async (_, entry) => {
      signInAs(entry.role === "owner" ? OWNER : EDITOR);
      const before = snapshot();

      expect(await entry.withoutStamp()).toEqual({
        status: "refused",
        error: { kind: "invalid", fieldErrors: {}, formError: "RELOAD THE PAGE AND TRY AGAIN" },
      });
      expect(snapshot()).toBe(before);
      expect(revalidateTag).not.toHaveBeenCalled();
    },
  );

  it.each(named(ENTRIES))(
    "%s answers 404 to an Owner with the Admin closed, changing nothing",
    async (_, entry) => {
      signInAs(OWNER);
      mode.current = "closed";
      const before = snapshot();

      await expect(entry.call()).rejects.toThrow("NEXT_NOT_FOUND");
      expect(snapshot()).toBe(before);
      expect(jar.get("ayc_admin_sample")).toBe(OWNER);
      expect(revalidateTag).not.toHaveBeenCalled();
    },
  );
});
