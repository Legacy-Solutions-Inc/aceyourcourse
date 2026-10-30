import { afterEach, describe, expect, it, vi } from "vitest";

import { getExamByCode, getWebsiteSettings, listExams } from "./catalogue";

// Behaviour tests against the Catalogue seam's public contract. Expected values
// are copied by hand from docs/mockup/aycData.js (EXAMS, EXAM_INFO, STORES,
// CONTACT, SHOP) and docs/mockup/website/SiteNav.dc.html.

describe("catalogue seam: Exams", () => {
  it("lists the five Exams with Products, in seed order", async () => {
    const exams = await listExams();
    expect(exams.map((e) => [e.code, e.name, e.board])).toEqual([
      ["CE", "Civil Engineering", "CELE"],
      ["ME", "Mechanical Engineering", "MELE"],
      ["EE", "Electrical Engineering", "REE"],
      ["MT", "Medical Technology", "MTLE"],
      ["CPA", "Accountancy", "CPALE"],
    ]);
  });

  it("lists each Exam with its Subjects and full names", async () => {
    const exams = await listExams();
    const ce = exams.find((e) => e.code === "CE");
    expect(ce).toEqual({
      code: "CE",
      board: "CELE",
      name: "Civil Engineering",
      longName: "Civil Engineering Licensure Exam",
      blurb:
        "Three subjects, four formats. Our CE line started it all and it’s still our best seller. Start with the cards, add the notebook and posters, or get everything in one bundle.",
      madeFor: "Engineers needing a quick formula reference",
      subjects: [
        { code: "MSTC", name: "Mathematics, Surveying & Transportation Engineering" },
        { code: "HPGE", name: "Hydraulics & Geotechnical Engineering" },
        { code: "PSAD", name: "Principles of Structural Analysis & Design" },
      ],
    });
    expect(exams.map((e) => e.subjects.length)).toEqual([3, 3, 3, 6, 6]);
  });

  it("does not list the Exams that have no Products yet", async () => {
    const codes = (await listExams()).map((e) => e.code);
    for (const soon of ["PH", "LET", "FT", "MP", "PT", "PM"]) {
      expect(codes).not.toContain(soon);
    }
  });

  it.each(["ce", "CE", "Ce"])("gets CE by the code %s", async (code) => {
    const exam = await getExamByCode(code);
    expect(exam?.code).toBe("CE");
    expect(exam?.longName).toBe("Civil Engineering Licensure Exam");
  });

  it("gets CPA by its lowercase URL code", async () => {
    expect((await getExamByCode("cpa"))?.name).toBe("Accountancy");
  });

  it.each(["zz", "", "   ", "c", "cel", "PH"])(
    "returns null for the unknown code %j",
    async (code) => {
      expect(await getExamByCode(code)).toBeNull();
    },
  );

  it("hands out copies, so a caller's change never leaks into the next read", async () => {
    const [ce] = await listExams();
    if (!ce) throw new Error("expected the seed to list CE first");
    ce.subjects.push({ code: "X", name: "Injected" });
    ce.name = "Changed";

    const again = await getExamByCode("CE");
    expect(again?.name).toBe("Civil Engineering");
    expect(again?.subjects).toHaveLength(3);
  });
});

describe("catalogue seam: Website settings", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns the Marketplace shop links", async () => {
    expect((await getWebsiteSettings()).shopLinks).toEqual({
      shopee: "https://shopee.ph/aceyourcourse",
      lazada: "https://www.lazada.com.ph/shop/aceyourcourse",
      tiktok: "https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop",
    });
  });

  it("returns the social links, contact email and shop stats", async () => {
    const settings = await getWebsiteSettings();
    expect(settings.socialLinks).toEqual({
      tiktok: "https://www.tiktok.com/@aceyourcourse",
      facebook: "https://www.facebook.com/aceyourcourseph",
      instagram: "https://www.instagram.com/aceyourcourseph",
    });
    expect(settings.contactEmail).toBe("aceyourcourseinc@gmail.com");
    expect(settings.shopStats).toEqual({
      rating: 4.8,
      ratingCount: 874,
      followers: "3.7K",
      asOf: "2026-10-29",
    });
  });

  it("returns the three announcement messages, with only the app one needing the Member App", async () => {
    const { announcement } = await getWebsiteSettings();
    expect(announcement.id).toBeTruthy();
    expect(announcement.messages).toEqual([
      {
        text: "Physical copies on Shopee, Lazada & TikTok Shop",
        href: "/products",
        requiresMemberApp: false,
      },
      {
        text: "Digital reviewers in the app · no auto-renew",
        href: "/app",
        requiresMemberApp: true,
      },
      {
        text: "Ships from Iloilo City · SPayLater 0% on Shopee",
        href: "/faq",
        requiresMemberApp: false,
      },
    ]);
  });

  it("returns the 11.11 promo banner, hidden", async () => {
    expect((await getWebsiteSettings()).promoBanner).toEqual({
      visible: false,
      text: "11.11 · Any 2 reviewers, 4% off on Shopee",
      buttonLabel: "Shop the sale",
      href: "https://shopee.ph/aceyourcourse",
      startDate: "2026-11-09",
      endDate: "2026-11-11",
    });
  });

  it("has the Member App switch off when MEMBER_APP_LIVE is unset", async () => {
    vi.stubEnv("MEMBER_APP_LIVE", undefined);
    vi.resetModules();
    const seam = await import("./catalogue");
    expect((await seam.getWebsiteSettings()).memberAppLive).toBe(false);
  });

  it('has the Member App switch off when MEMBER_APP_LIVE is "false"', async () => {
    vi.stubEnv("MEMBER_APP_LIVE", "false");
    vi.resetModules();
    const seam = await import("./catalogue");
    expect((await seam.getWebsiteSettings()).memberAppLive).toBe(false);
  });

  it('has the Member App switch on when MEMBER_APP_LIVE is "true"', async () => {
    vi.stubEnv("MEMBER_APP_LIVE", "true");
    vi.resetModules();
    const seam = await import("./catalogue");
    expect((await seam.getWebsiteSettings()).memberAppLive).toBe(true);
  });

  it("refuses to load a seed that fails validation", async () => {
    vi.resetModules();
    vi.doMock("@/services/mock/catalogue", async (importOriginal) => {
      const real = await importOriginal<typeof import("@/services/mock/catalogue")>();
      const [first] = real.CATALOGUE_SEED.exams;
      return {
        CATALOGUE_SEED: { ...real.CATALOGUE_SEED, exams: [first, first] },
      };
    });
    await expect(import("./catalogue.mock")).rejects.toThrow(/exams\.1\.code: duplicate/);
    vi.doUnmock("@/services/mock/catalogue");
  });
});
