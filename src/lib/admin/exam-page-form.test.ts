import { describe, expect, it } from "vitest";

import { examPageDefaults } from "@/services/catalogue.schema";

import { testExam } from "../../../test/fixtures/catalogue";
import {
  bundleFormValues,
  dateFormValues,
  headerFormValues,
  seoFormValues,
  subjectFormValues,
} from "./exam-page-form";

// Each Exam pages editor opens with these values, from the Exam or its page.

describe("the Exam pages editors' values", () => {
  it("opens the Header and Subjects covered with the Exam's fields", () => {
    const exam = testExam();
    expect(headerFormValues(exam)).toEqual({
      name: "Civil Engineering",
      longName: "Civil Engineering Licensure Exam",
      blurb: "Three subjects, four formats.",
      madeFor: "Engineers needing a quick formula reference",
    });
    expect(subjectFormValues(exam).subjects.map((subject) => subject.code)).toEqual([
      "MSTC",
      "HPGE",
      "PSAD",
    ]);
  });

  it("opens a page with nothing set as blank fields", () => {
    const page = examPageDefaults("CE");
    expect(bundleFormValues(page)).toEqual({
      productId: "",
      headline: "",
      text: "",
      buttonLabel: "",
    });
    expect(seoFormValues(page)).toEqual({ seoTitle: "", seoDescription: "", shareImage: "" });
    expect(dateFormValues(page)).toEqual({ officialExamDate: "" });
  });

  it("opens a page's bundle offer, SEO, share image and date", () => {
    const page = {
      ...examPageDefaults("CE"),
      bundleOffer: { productId: "prd-008", headline: "H", text: "T", buttonLabel: "B" },
      seoTitle: "CE Board Exam Reviewer",
      shareImage: "/api/dev/uploads/1",
      officialExamDate: "2027-04-24",
    };
    expect(bundleFormValues(page)).toEqual(page.bundleOffer);
    expect(seoFormValues(page)).toEqual({
      seoTitle: "CE Board Exam Reviewer",
      seoDescription: "",
      shareImage: "/api/dev/uploads/1",
    });
    expect(dateFormValues(page)).toEqual({ officialExamDate: "2027-04-24" });
  });
});
