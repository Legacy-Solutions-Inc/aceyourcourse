import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { seoFormValues } from "@/lib/admin/exam-page-form";
import type { ExamSeoForm } from "@/services/admin.schema";
import type { AdminSitePage, StaffActor } from "@/services/admin.types";
import { getSitePage } from "@/services/catalogue";
import { SITE_PAGES } from "@/services/catalogue.schema";
import type { SitePageKey } from "@/services/catalogue.types";

import { ADMIN_ARMS } from "../../test/admin-arms";

// The Admin seam's Site pages area, run against every arm (spec, Phase 2 →
// Site pages, Conflict check, Staff Activity; story 80a): each Site page's
// SEO title and description (blank uses the text in code) and share image,
// with the same rules as an Exam page's. Every save is live on the Website.
// Each test boots the data at BOOT with a fake clock.
const BOOT = new Date("2026-11-05T03:42:00.000Z");
const MINUTE = 60 * 1000;
const at = (offset: number) => new Date(BOOT.getTime() + offset);

const OWNER: StaffActor = {
  email: "angel@aceyourcourse.ph",
  name: "Angel Rose L. Lepaña",
  role: "owner",
};
const EDITOR: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};

const NEVER_SAVED = { savedAt: BOOT.toISOString(), savedBy: null };
const SAVED_BY_EDITOR = { savedAt: at(MINUTE).toISOString(), savedBy: EDITOR.name };

// The ticket's example, "About Ace Your Course · Iloilo board passers", is 62
// characters with the site name, so the Exam page rule refuses it (decided
// 2026-11-05: the same rules as Exam pages). This one fits.
const ABOUT_TITLE = "About us · board passers from Iloilo";
/** A page title whose whole <title>, with " · Ace Your Course", is `length` characters. */
const titleOfFull = (length: number) => "T".repeat(length - " · Ace Your Course".length);
const text = (length: number) => "d".repeat(length);

const WAIT_FOR_UPLOADS = "Wait for uploads to finish.";
const NOT_UPLOADED = "THE IMAGE ISN’T UPLOADED · ADD IT AGAIN";

describe.each(ADMIN_ARMS)("Admin seam: Site pages ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const saved = (result: { ok: boolean; value?: AdminSitePage }) => {
    if (!result.ok || !result.value)
      throw new Error(`expected a save, got ${JSON.stringify(result)}`);
    return result.value;
  };
  const seo = async (page: SitePageKey, changes: Partial<ExamSeoForm>, actor = EDITOR) => {
    const opened = await seam.getSitePageForAdmin(actor, page);
    return seam.updateSitePageSeo(
      actor,
      page,
      { ...seoFormValues(opened.page), ...changes },
      opened.stamps.seo,
    );
  };
  const later = () => vi.setSystemTime(at(MINUTE));

  describe("getSitePageForAdmin", () => {
    it.each(SITE_PAGES)("opens %s with nothing set and never saved", async (page) => {
      expect(await seam.getSitePageForAdmin(EDITOR, page)).toEqual({
        page: { page, seoTitle: null, seoDescription: null, shareImage: null },
        stamps: { seo: NEVER_SAVED },
      });
    });
  });

  describe("updateSitePageSeo", () => {
    it("saves an Editor's title and description, live on the Website, with Staff Activity", async () => {
      later();
      const description = text(120);
      const result = await seo("about", {
        seoTitle: ` ${ABOUT_TITLE} `,
        seoDescription: description,
      });

      expect(result).toMatchObject({ ok: true, tags: ["catalogue:site-pages"] });
      expect(saved(result).stamps.seo).toEqual(SAVED_BY_EDITOR);
      expect(await getSitePage("about")).toEqual({
        page: "about",
        seoTitle: ABOUT_TITLE,
        seoDescription: description,
        shareImage: null,
      });
      // The other Site pages are untouched.
      expect((await getSitePage("home")).seoTitle).toBeNull();
      expect(await arm.staffActivity()).toEqual([
        {
          id: expect.any(String),
          at: at(MINUTE).toISOString(),
          actor: { email: EDITOR.email, name: EDITOR.name },
          entity: "site-page",
          entityId: "about",
          action: "update-seo",
          before: { seoTitle: null, seoDescription: null, shareImage: null },
          after: { seoTitle: ABOUT_TITLE, seoDescription: description, shareImage: null },
        },
      ]);
    });

    it("saves blank fields as none, so the Website uses the text in code again", async () => {
      saved(await seo("about", { seoTitle: ABOUT_TITLE, seoDescription: text(120) }));
      saved(await seo("about", { seoTitle: "  ", seoDescription: "" }));
      expect(await getSitePage("about")).toMatchObject({ seoTitle: null, seoDescription: null });
    });

    it("saves a description under 80 characters, which the editor only flags", async () => {
      saved(await seo("products", { seoDescription: text(70) }));
      expect((await getSitePage("products")).seoDescription).toBe(text(70));
    });

    it("takes a whole title of 60 characters, and refuses 61, as on an Exam page", async () => {
      expect(await seo("faq", { seoTitle: titleOfFull(60) })).toMatchObject({ ok: true });
      expect(await seo("faq", { seoTitle: titleOfFull(61) })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { seoTitle: ["KEEP THE WHOLE TITLE TO 60 CHARACTERS"] },
        },
      });
    });

    it("takes a description of 160 characters, and refuses 161, as on an Exam page", async () => {
      expect(await seo("faq", { seoDescription: text(160) })).toMatchObject({ ok: true });
      expect(await seo("faq", { seoDescription: text(161) })).toMatchObject({
        ok: false,
        error: { fieldErrors: { seoDescription: ["KEEP IT TO 160 CHARACTERS"] } },
      });
    });

    it("saves an uploaded share image at its public URL, keeps it, and clears it", async () => {
      const upload = await arm.uploadPhoto({ purpose: "site-page-share-image" });
      const result = await seo("faq", { shareImage: upload.path });
      expect(saved(result).page.shareImage).toBe(upload.publicUrl);
      expect((await getSitePage("faq")).shareImage).toBe(upload.publicUrl);

      // Saved again with the image it has, it keeps it.
      saved(await seo("faq", { seoTitle: "FAQ" }));
      expect((await getSitePage("faq")).shareImage).toBe(upload.publicUrl);

      saved(await seo("faq", { shareImage: "" }));
      expect((await getSitePage("faq")).shareImage).toBeNull();
    });

    it("asks to wait for a share image whose file hasn't arrived", async () => {
      const upload = await arm.uploadPhoto({ purpose: "site-page-share-image", send: false });
      expect(await seo("faq", { shareImage: upload.path })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: WAIT_FOR_UPLOADS },
      });
    });

    it.each([
      ["an Exam page's share image upload", () => arm.uploadPhoto({ purpose: "share-image" })],
      ["a Product photo upload", () => arm.uploadPhoto({ purpose: "product-photo" })],
      ["a path the Admin didn't upload", async () => ({ path: "/products/x/1.webp" })],
    ])("refuses %s as the share image", async (_case, image) => {
      const { path } = await image();
      expect(await seo("faq", { shareImage: path })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { shareImage: [NOT_UPLOADED] } },
      });
    });

    it("refuses a save over a newer one, naming who saved it, and saves nothing", async () => {
      const stale = await seam.getSitePageForAdmin(EDITOR, "about");
      later();
      saved(await seo("about", { seoTitle: "About us" }, OWNER));
      expect(
        await seam.updateSitePageSeo(
          EDITOR,
          "about",
          { ...seoFormValues(stale.page), seoTitle: ABOUT_TITLE },
          stale.stamps.seo,
        ),
      ).toMatchObject({ ok: false, error: { kind: "conflict", savedBy: OWNER.name } });
      expect((await getSitePage("about")).seoTitle).toBe("About us");
    });

    it("keeps each Site page's stamp its own: saving Home never makes About's editor conflict", async () => {
      const about = await seam.getSitePageForAdmin(EDITOR, "about");
      later();
      saved(await seo("home", { seoTitle: "Home" }, OWNER));
      saved(
        await seam.updateSitePageSeo(
          EDITOR,
          "about",
          { ...seoFormValues(about.page), seoTitle: ABOUT_TITLE },
          about.stamps.seo,
        ),
      );
    });
  });
});
