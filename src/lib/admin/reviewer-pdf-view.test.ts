import { describe, expect, it } from "vitest";

import type { PlacementTopic } from "@/services/admin.types";

import {
  libraryLine,
  openingPlacement,
  pickedTopicHolder,
  statusLine,
  topicOptions,
} from "./reviewer-pdf-view";

// What a Reviewer PDF's screen shows (Phase 3, ticket 13; BUILD-MAP §3.5),
// pure: where its placement opens, the Topics it can go under in a Subject,
// which Reviewer PDF holds the Topic picked, and its library and status lines.

const EXAMS = [
  {
    code: "CE",
    subjects: [
      { code: "MSTC", name: "Mathematics" },
      { code: "HPGE", name: "Hydraulics" },
    ],
  },
  { code: "ME", subjects: [{ code: "PIP", name: "Power Plant" }] },
];

const topic = (id: string, subjectCode: string, name: string, position: number, pdf?: string) =>
  ({
    id,
    examCode: "CE",
    subjectCode,
    name,
    position,
    reviewerPdfId: pdf ?? null,
  }) satisfies PlacementTopic;

const TOPICS = [
  topic("t1", "MSTC", "Simple Curves", 1, "pdf-a"),
  topic("t3", "MSTC", "Surveying", 3),
  topic("t2", "MSTC", "Spiral Curves", 2),
  topic("t4", "HPGE", "Hydrostatics", 1),
];

describe("openingPlacement", () => {
  it("opens on where it's placed", () => {
    expect(
      openingPlacement(
        { topicId: "t4", placement: { examCode: "CE", subjectCode: "HPGE" } },
        EXAMS,
      ),
    ).toEqual({ exam: "CE", subject: "HPGE", topic: "t4" });
  });

  it("opens an unplaced one on the first Exam's first Subject, with no Topic picked", () => {
    expect(openingPlacement({ topicId: null, placement: null }, EXAMS)).toEqual({
      exam: "CE",
      subject: "MSTC",
      topic: "",
    });
    expect(openingPlacement({ topicId: null, placement: null }, [])).toEqual({
      exam: "",
      subject: "",
      topic: "",
    });
  });
});

describe("topicOptions", () => {
  it("lists the Subject's Topics in order, after a prompt, marking one another Reviewer PDF holds", () => {
    expect(topicOptions(TOPICS, "CE", "MSTC", "pdf-b")).toEqual([
      { value: "", label: "Choose a topic" },
      { value: "t1", label: "Simple Curves · has a Reviewer PDF" },
      { value: "t2", label: "Spiral Curves" },
      { value: "t3", label: "Surveying" },
    ]);
  });

  it("doesn't mark the Topic this Reviewer PDF holds itself", () => {
    expect(topicOptions(TOPICS, "CE", "MSTC", "pdf-a")[1]).toEqual({
      value: "t1",
      label: "Simple Curves",
    });
  });

  it("gives only the prompt for a Subject with no Topics yet", () => {
    expect(topicOptions(TOPICS, "ME", "PIP", "pdf-b")).toEqual([
      { value: "", label: "Choose a topic" },
    ]);
  });
});

describe("pickedTopicHolder", () => {
  it("is the other Reviewer PDF on the Topic picked", () => {
    expect(pickedTopicHolder(TOPICS, "t1", "pdf-b")).toBe("pdf-a");
  });

  it("is null for a free Topic, the one it holds itself, and no Topic", () => {
    expect(pickedTopicHolder(TOPICS, "t2", "pdf-b")).toBeNull();
    expect(pickedTopicHolder(TOPICS, "t1", "pdf-a")).toBeNull();
    expect(pickedTopicHolder(TOPICS, "", "pdf-b")).toBeNull();
  });
});

describe("libraryLine", () => {
  const placement = { examCode: "CE", subjectCode: "MSTC", topicName: "Simple Curves" };

  it("says where Members find a Published one", () => {
    expect(libraryLine("published", placement)).toBe(
      "Shows in the member Library under CE › MSTC › Simple Curves.",
    );
  });

  it("says where a placed one will show once it's published", () => {
    expect(libraryLine("draft", placement)).toBe(
      "Shows in the member Library under CE › MSTC › Simple Curves once it’s published.",
    );
    expect(libraryLine("unpublished", placement)).toBe(
      "Shows in the member Library under CE › MSTC › Simple Curves once it’s published.",
    );
  });

  it("says an unplaced one needs a Topic first", () => {
    expect(libraryLine("draft", null)).toBe(
      "Not in the member Library: choose a topic, save, then publish.",
    );
  });
});

describe("statusLine", () => {
  it("is live for a Published one, and not visible yet for the rest", () => {
    expect(statusLine("published")).toBe("LIVE IN THE LIBRARY");
    for (const status of ["processing", "draft", "unpublished", "failed"] as const) {
      expect(statusLine(status)).toBe("NOT VISIBLE TO MEMBERS");
    }
  });
});
