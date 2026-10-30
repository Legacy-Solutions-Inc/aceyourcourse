import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { listExams } from "@/services/catalogue";

import { homeCopy, homeSteps, promoVideo, tryCards } from "./home";

// Home's fixed copy (docs/mockup/website/Home_v2.dc.html), checked against the
// catalogue and the files it points at.

const shipped = (publicPath: string) => existsSync(join(process.cwd(), "public", publicPath));

describe("the Try a card sample cards", () => {
  it("puts each card under one of its own Exam's Subjects", async () => {
    const exams = await listExams();
    expect(tryCards).toHaveLength(3);
    for (const card of tryCards) {
      const exam = exams.find((e) => e.code === card.examCode);
      expect(exam, `${card.examCode} is an Exam on the Website`).toBeDefined();
      expect(
        exam?.subjects.map((s) => s.code),
        card.topic,
      ).toContain(card.subjectCode);
    }
  });

  it("ships each card's image, described for screen readers", () => {
    for (const card of tryCards) {
      expect(shipped(card.image), card.image).toBe(true);
      expect(card.alt).toMatch(new RegExp(`^Flash card: ${card.topic}`));
    }
  });
});

describe("the promo video", () => {
  it("ships the compressed video and its poster", () => {
    expect(shipped(promoVideo.src)).toBe(true);
    expect(shipped(promoVideo.poster)).toBe(true);
  });
});

describe("the four steps", () => {
  it("has four, and no app-free step mentions or links to the app", () => {
    expect(homeSteps).toHaveLength(4);
    for (const { appOff } of homeSteps) {
      expect(`${appOff.title} ${appOff.description} ${appOff.cta}`).not.toMatch(/\bapp\b/i);
      expect("path" in appOff.target ? appOff.target.path : "").not.toMatch(/^\/app/);
    }
  });
});

describe("the hero sub-headline", () => {
  it("adds the app clause to the same sentence while the switch is on", () => {
    expect(homeCopy.hero.subheadline).toBe(
      "Flash cards, notebooks, and posters for board exam review in various courses. Shipped nationwide.",
    );
    expect(homeCopy.hero.subheadlineApp).toBe(
      "Flash cards, notebooks, and posters for board exam review in various courses. Shipped nationwide, and also available in the app.",
    );
  });
});
