import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { testExam } from "../../../../test/fixtures/catalogue";
import { AboutCta } from "./about-cta";

// The closing call to action (docs/mockup/website/About_v2.dc.html L138–149):
// a tile per Exam, which the mockup cut short at MT, then "All reviewers" in
// place of "+ Other courses".

const EXAMS = [
  testExam(),
  testExam({ code: "ME", name: "Mechanical Engineering" }),
  testExam({ code: "EE", name: "Electrical Engineering" }),
  testExam({ code: "MT", name: "Medical Technology" }),
  testExam({ code: "CPA", name: "Accountancy" }),
];

const section = () =>
  within(screen.getByRole("region", { name: "Your turn. Find the reviewer for your board." }));
const tiles = () =>
  section()
    .getAllByRole("link")
    .map((link) => [link.textContent?.replace(/\s+/g, " "), link.getAttribute("href")]);

describe("AboutCta", () => {
  it("has a tile for every Exam, CPA included, each going to its Exam page", () => {
    render(<AboutCta exams={EXAMS} />);
    expect(tiles()).toEqual([
      ["CE Civil Engineering Reviewers →", "/exams/ce"],
      ["ME Mechanical Engineering Reviewers →", "/exams/me"],
      ["EE Electrical Engineering Reviewers →", "/exams/ee"],
      ["MT Medical Technology Reviewers →", "/exams/mt"],
      ["CPA Accountancy Reviewers →", "/exams/cpa"],
      ["+ All reviewers →", "/products"],
    ]);
    expect(section().getByRole("link", { name: "CPA Accountancy Reviewers" })).toBeVisible();
  });

  it("ends with All reviewers, in place of the mockup's Other courses", () => {
    render(<AboutCta exams={EXAMS} />);
    expect(section().getByRole("link", { name: "All reviewers" })).toHaveAttribute(
      "href",
      "/products",
    );
    expect(section().queryByText(/Other courses/i)).toBeNull();
  });

  it("has only All reviewers with no Exams", () => {
    render(<AboutCta exams={[]} />);
    expect(tiles()).toEqual([["+ All reviewers →", "/products"]]);
  });
});
