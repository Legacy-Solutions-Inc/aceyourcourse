import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StaffActor } from "@/services/admin.types";

import { ADMIN_ARMS } from "../../test/admin-arms";

// The Admin seam's overview area, run against every arm (spec, Phase 2 story
// 61): the catalogue data the Overview works out what needs Staff from. It's
// read fresh, so a fix made elsewhere shows on the next load.
const BOOT = new Date("2026-10-22T03:42:00.000Z");

const EDITOR: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};

describe.each(ADMIN_ARMS)("Admin seam: Overview ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives every Product, Exam and Exam page record, and the Website's settings", async () => {
    const overview = await seam.getOverview(EDITOR);
    expect(overview.products).toHaveLength(15);
    expect(overview.products.filter((p) => p.state === "coming-soon")).toHaveLength(7);
    expect(overview.exams.map((exam) => exam.code)).toEqual(["CE", "ME", "EE", "MT", "CPA"]);
    expect(overview.settings.shopStats.asOf).toBe("2026-10-29");
    expect(overview.settings.promoBanner?.visible).toBe(false);
    expect(Array.isArray(overview.examPages)).toBe(true);
  });

  it("includes Products hidden from the Website", async () => {
    await arm.reset((seed) => {
      const [first] = seed.products;
      if (first) first.showOnWebsite = false;
    });
    const { products } = await seam.getOverview(EDITOR);
    expect(products.filter((product) => !product.showOnWebsite)).toHaveLength(1);
  });

  it("reads a fix made elsewhere on the next load", async () => {
    const before = await seam.getOverview(EDITOR);
    expect(before.settings.promoBanner?.visible).toBe(false);
    const result = await seam.setPromoBannerVisible(EDITOR, true);
    expect(result.ok).toBe(true);
    expect((await seam.getOverview(EDITOR)).settings.promoBanner?.visible).toBe(true);
  });

  it("gives a copy: changing it changes nothing in the catalogue", async () => {
    const overview = await seam.getOverview(EDITOR);
    overview.settings.shopStats.asOf = "2020-01-01";
    overview.products.splice(0);
    const again = await seam.getOverview(EDITOR);
    expect(again.settings.shopStats.asOf).toBe("2026-10-29");
    expect(again.products).toHaveLength(15);
  });
});
