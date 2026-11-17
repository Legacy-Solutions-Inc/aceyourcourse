import { describe, expect, it } from "vitest";

import type { AccessDecision } from "@/lib/member-app/access";
import type { LibrarySubject, LibraryTopic } from "@/services/member.types";

import { itemState, pickSubject, topicView } from "./library-view";

describe("itemState", () => {
  it.each<[AccessDecision, string]>([
    [{ outcome: "allowed", via: "pass" }, "open"],
    [{ outcome: "allowed", via: "staff" }, "open"],
    [{ outcome: "allowed", via: "free-preview" }, "free-preview"],
    [{ outcome: "expired", passEndedAt: "2026-11-14T03:42:00.000Z" }, "expired"],
    [{ outcome: "locked" }, "locked"],
    [{ outcome: "unavailable" }, "locked"],
  ])("shows %j as %s", (decision, state) => {
    expect(itemState(decision)).toBe(state);
  });
});

describe("topicView", () => {
  const topic: LibraryTopic = {
    id: "t1",
    name: "Simple Curves",
    position: 3,
    items: [
      { kind: "deck", id: "d1", freePreview: true },
      { kind: "quiz", id: "q1", freePreview: false },
      { kind: "reviewer-pdf", id: "r1", freePreview: false },
    ],
  };

  it("numbers the Topic and labels, links and states each item", () => {
    const view = topicView(topic, (item) =>
      item.freePreview ? { outcome: "allowed", via: "free-preview" } : { outcome: "locked" },
    );
    expect(view).toEqual({
      id: "t1",
      number: "03",
      name: "Simple Curves",
      locked: true,
      items: [
        {
          kind: "deck",
          id: "d1",
          label: "Flashcards",
          state: "free-preview",
          href: "/app/library/deck/d1",
        },
        { kind: "quiz", id: "q1", label: "Quiz", state: "locked", href: "/app/library/quiz/q1" },
        {
          kind: "reviewer-pdf",
          id: "r1",
          label: "Reviewer PDF",
          state: "locked",
          href: "/app/library/reviewer-pdf/r1",
        },
      ],
    });
  });

  it("isn't locked when everything opens", () => {
    expect(topicView(topic, () => ({ outcome: "allowed", via: "pass" })).locked).toBe(false);
  });

  it("is locked when a pass has ended", () => {
    const view = topicView(topic, () => ({
      outcome: "expired",
      passEndedAt: "2026-11-14T00:00:00Z",
    }));
    expect(view.locked).toBe(true);
  });
});

describe("pickSubject", () => {
  const subjects: LibrarySubject[] = [
    { code: "MSTC", name: "Mathematics", topics: [] },
    { code: "HPGE", name: "Hydraulics", topics: [] },
  ];

  it("opens on the Subject asked for, in any case", () => {
    expect(pickSubject(subjects, "hpge")?.code).toBe("HPGE");
  });

  it("opens on the first Subject when none, or another Exam's, is asked for", () => {
    expect(pickSubject(subjects, undefined)?.code).toBe("MSTC");
    expect(pickSubject(subjects, "PIP")?.code).toBe("MSTC");
  });

  it("gives nothing for an Exam with no Subjects", () => {
    expect(pickSubject([], "MSTC")).toBeNull();
  });
});
