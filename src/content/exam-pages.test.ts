import { describe, expect, it } from "vitest";

import { getProductBySlug, listExams } from "@/services/catalogue";

import { bestFor, examPageCopy, examPromos, sampleCards } from "./exam-pages";

// The Exam page's fixed copy (docs/mockup/website/Exam_v2.dc.html L213–220,
// L163–170), checked against the catalogue it sits beside.

describe("the Exam page's sample formula cards", () => {
  it("has three cards for every Exam on the Website", async () => {
    for (const exam of await listExams()) {
      expect(sampleCards[exam.code], exam.code).toHaveLength(3);
    }
  });

  it("puts every card under one of its own Exam's Subjects", async () => {
    const exams = await listExams();
    for (const [examCode, cards] of Object.entries(sampleCards)) {
      const exam = exams.find((e) => e.code === examCode);
      expect(exam, `${examCode} is an Exam on the Website`).toBeDefined();
      const subjectCodes = exam?.subjects.map((s) => s.code) ?? [];
      for (const card of cards ?? []) {
        expect(subjectCodes, `${examCode}: ${card.front}`).toContain(card.subject);
        expect(card.front.trim()).not.toBe("");
        expect(card.back.trim()).not.toBe("");
        expect(card.note.trim()).not.toBe("");
      }
    }
  });

  it("is copied from the mockup", () => {
    expect(sampleCards.CE?.[0]).toEqual({
      subject: "MSTC",
      front: "Tangent distance of a simple curve",
      back: "T = R tan(I/2)",
      note: "R = radius, I = central angle",
    });
    expect(sampleCards.MT?.[0]?.back).toBe("LDL = TC − HDL − TG/5");
  });
});

describe("the Exam page's best-for map", () => {
  it("says what each format is best for, from the mockup", () => {
    expect(bestFor).toEqual({
      "flash-cards": "Quick recall on the go",
      posters: "Your study wall, active recall",
      notebook: "Practice solving and notes",
      bundle: "Everything in one order",
    });
  });
});

describe("the Exam page's promo banners", () => {
  it("offers the CE Review Bundle 3-in-1 on the CE page", () => {
    expect(examPromos).toEqual([
      {
        examCode: "CE",
        productSlug: "ce-review-bundle-3-in-1",
        eyebrow: "CE Review Bundle 3-in-1",
        body: "Cards, notebook, and posters for MSTC, HPGE, and PSAD in one order.",
      },
    ]);
  });

  it("adds the saving to a banner's eyebrow only when the catalogue gives one", () => {
    const { withSaving } = examPageCopy.promo;
    expect(withSaving("CE Review Bundle 3-in-1", "₱200")).toBe(
      "CE Review Bundle 3-in-1 · save ₱200",
    );
    expect(withSaving("CE Review Bundle 3-in-1", null)).toBe("CE Review Bundle 3-in-1");
  });

  it("points each banner at a Product of its own Exam", async () => {
    for (const promo of examPromos) {
      const product = await getProductBySlug(promo.productSlug);
      expect(product?.examCode, promo.productSlug).toBe(promo.examCode);
    }
  });

  it("leaves the banner's price out of its text, so the catalogue supplies it", () => {
    for (const promo of examPromos) {
      expect(promo.body).not.toMatch(/₱/);
    }
  });
});

describe("the Exam page copy", () => {
  it("counts the reviewers in the hero's call to action", () => {
    expect(examPageCopy.hero.seeProducts(3)).toBe("See 3 reviewers");
    expect(examPageCopy.hero.seeProducts(1)).toBe("See 1 reviewer");
  });

  it("counts the Subjects on the board", () => {
    expect(examPageCopy.subjects.eyebrow(3, "CELE")).toBe("3 subjects on the CELE");
    expect(examPageCopy.subjects.eyebrow(1, "CELE")).toBe("1 subject on the CELE");
  });
});
