import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ContentState } from "./content-state";

// The ended state in place of a deck, quiz or Reviewer PDF (Phase 3's
// locked state; Phase 4, ticket 12; mockup `expired`): when the Member's
// Access Pass ended, it says when, keeps their progress in the Exam ("312
// cards marked, 14 quizzes taken"), and leads to that Exam's Plans with
// "Renew access", or keeps the "contact us" note while the Exam has nothing
// on sale (ticket 02).
const EXPIRED = { outcome: "expired", passEndedAt: "2026-11-14T02:00:00.000Z" } as const;
const BACK = { href: "/app/library?subject=MSTC", label: "Back to MSTC topics" };
const KEPT = "Renew to keep reviewing. Your progress is kept: 312 cards marked, 14 quizzes taken.";

describe("ContentState, once access ended", () => {
  it("says when it ended, what's kept, and leads to the Exam's Plans with “Renew access”", () => {
    render(
      <ContentState
        decision={EXPIRED}
        examCode="CE"
        unlock={{ kind: "plans", href: "/app/plans?exam=CE" }}
        back={BACK}
        keptNote={KEPT}
      />,
    );

    expect(screen.getByText("🔒 ACCESS ENDED")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Your CE All-Access ended on 14 Nov 2026" }),
    ).toBeInTheDocument();
    expect(screen.getByText(`Your access ended. ${KEPT}`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Renew access" })).toHaveAttribute(
      "href",
      "/app/plans?exam=CE",
    );
    expect(screen.getByRole("link", { name: BACK.label })).toHaveAttribute("href", BACK.href);
  });

  it("keeps the contact us note, and no Renew link, while the Exam has nothing on sale", () => {
    render(
      <ContentState
        decision={EXPIRED}
        examCode="CE"
        unlock={{ kind: "contact", contactEmail: "hello@example.com" }}
        back={BACK}
        keptNote={KEPT}
      />,
    );

    expect(screen.getByText(/312 cards marked, 14 quizzes taken\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "hello@example.com" })).toHaveAttribute(
      "href",
      "mailto:hello@example.com",
    );
    expect(screen.queryByRole("link", { name: "Renew access" })).toBeNull();
  });
});
