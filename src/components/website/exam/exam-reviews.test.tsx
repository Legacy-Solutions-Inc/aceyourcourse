import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ReviewWithProduct } from "@/services/catalogue.types";

import { testReview } from "../../../../test/fixtures/catalogue";
import { ExamReviews } from "./exam-reviews";

// "From {code} reviewees": up to 7 Reviews of the Exam's Products. Four or
// more scroll in a marquee, one to three sit in a grid, and none shows the
// mockup's message (docs/mockup/website/Exam_v2.dc.html L172–195).

const reviews = (count: number): ReviewWithProduct[] =>
  Array.from({ length: count }, (_, index) =>
    testReview({ id: `rev-${index}`, text: `Review number ${index + 1}` }),
  );

const marquee = () => screen.queryByRole("region", { name: "Reviews from CE reviewees" });
const EMPTY =
  "No written reviews yet. Buyers have left star ratings on Shopee but no comments so far.";

describe("ExamReviews", () => {
  it("scrolls 4 or more Reviews in a marquee, each linking to its Product", () => {
    render(<ExamReviews examCode="CE" reviews={reviews(4)} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("From CE reviewees");
    const region = marquee();
    expect(region).not.toBeNull();
    // The marquee's second copy, for the seamless loop, is hidden from screen readers.
    const links = within(region ?? document.body).getAllByRole("link", { name: "View product" });
    expect(links).toHaveLength(4);
    expect(links[0]).toHaveAttribute("href", "/products/ce-formula-flash-cards");
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
  });

  it("lays 3 Reviews out in a grid, not a marquee", () => {
    render(<ExamReviews examCode="CE" reviews={reviews(3)} />);
    expect(marquee()).toBeNull();
    const grid = screen.getByRole("list", { name: "From CE reviewees" });
    expect(within(grid).getAllByRole("listitem")).toHaveLength(3);
    expect(within(grid).getAllByRole("link", { name: "View product" })).toHaveLength(3);
  });

  it("shows the no-reviews message with none", () => {
    render(<ExamReviews examCode="CE" reviews={[]} />);
    expect(screen.getByText(EMPTY)).toBeInTheDocument();
    expect(marquee()).toBeNull();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
