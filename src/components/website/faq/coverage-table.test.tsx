import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { testExam } from "../../../../test/fixtures/catalogue";
import { CoverageTable } from "./coverage-table";

const EXAMS = [
  testExam(),
  testExam({
    code: "CPA",
    board: "CPALE",
    name: "Accountancy",
    subjects: [
      { code: "FAR", name: "Financial Accounting and Reporting" },
      { code: "AUD", name: "Auditing" },
    ],
  }),
];

describe("CoverageTable", () => {
  it("lists each Exam with its Subject codes, linking to its Exam page", () => {
    render(<CoverageTable exams={EXAMS} />);
    const rows = within(screen.getByRole("list", { name: "Subjects per exam" })).getAllByRole(
      "link",
    );
    expect(rows.map((row) => row.getAttribute("href"))).toEqual(["/exams/ce", "/exams/cpa"]);
    expect(rows[0]).toHaveTextContent("CECivil EngineeringMSTCHPGEPSAD");
    expect(rows[1]).toHaveTextContent("CPAAccountancyFARAUD");
  });

  it("renders nothing when there are no Exams", () => {
    const { container } = render(<CoverageTable exams={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
