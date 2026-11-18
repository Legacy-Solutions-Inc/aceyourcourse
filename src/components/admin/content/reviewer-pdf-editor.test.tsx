import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import {
  CHOOSE_A_TOPIC,
  SPLIT_FAILED,
  STILL_SPLITTING,
  TOPIC_TAKEN,
  UNPUBLISH_TO_MOVE,
} from "@/lib/reviewer-pdfs/status";
import { paths } from "@/paths";
import type {
  AdminReviewerPdfDetail,
  AdminReviewerPdfScreen,
  AdminTopic,
  PlacementTopic,
} from "@/services/admin.types";
import type { ReviewerPdfUpload } from "@/services/content.types";

import {
  ReviewerPdfEditor,
  type ReviewerPdfEditorActions,
  type ReviewerPdfOwnerActions,
} from "./reviewer-pdf-editor";

// One Reviewer PDF's screen (Phase 3, ticket 13; stories 116, 128, 133o),
// with stub Server Actions: the preview goes page by page with the viewer's
// email over it; the Exam → Subject → Topic pickers place it, "+ New topic"
// makes a Topic without leaving, a Topic another Reviewer PDF holds links to
// it, and only Owners get "+ Add exam" and "+ Add subject"; Publish is
// disabled with the reason until it can be. The server's rules are in
// admin.reviewer-pdf-publishing.test.ts.
const { refresh, push, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
  unstable_rethrow: () => {},
}));
vi.mock("sonner", () => ({ toast }));

const ID = "0b9f4a5e-8d3c-4f1a-9e2b-7c6d5e4f3a21";
const OTHER = "6c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const SEEDED = "2026-11-17T03:42:00.000Z";
const VIEWER = { email: "content@aceyourcourse.ph" };

const UPLOAD: ReviewerPdfUpload = {
  fileName: "MSTC Reviewer.pdf",
  fileSize: 1200,
  uploadedAt: "2026-11-18T01:00:00.000Z",
  pageCount: 3,
  pagesDone: 3,
  heartbeatAt: "2026-11-18T01:00:03.000Z",
  restarts: 0,
  failure: null,
};

const topic = (id: string, name: string, position: number, reviewerPdfId: string | null = null) =>
  ({
    id,
    examCode: "CE",
    subjectCode: "MSTC",
    name,
    position,
    reviewerPdfId,
  }) satisfies PlacementTopic;

const SIMPLE_CURVES = topic("t-simple", "Simple Curves", 1, OTHER);
const SURVEYING = topic("t-surveying", "Surveying", 2);
const HYDROSTATICS: PlacementTopic = {
  ...topic("t-hydro", "Hydrostatics", 1),
  subjectCode: "HPGE",
};
const TOPICS = [SIMPLE_CURVES, SURVEYING, HYDROSTATICS];

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

const detail = (change: Partial<AdminReviewerPdfDetail> = {}): AdminReviewerPdfDetail => ({
  id: ID,
  status: "draft",
  upload: UPLOAD,
  placement: null,
  topicId: null,
  freePreview: false,
  stamp: { savedAt: SEEDED, savedBy: null },
  ...change,
});

const placedDetail = (change: Partial<AdminReviewerPdfDetail> = {}) =>
  detail({
    topicId: SURVEYING.id,
    placement: { examCode: "CE", subjectCode: "MSTC", topicName: "Surveying" },
    ...change,
  });

const saved = <T,>(value: T): AdminActionState<T> => ({ status: "saved", value });

const NEW_TOPIC: AdminTopic = {
  id: "t-transition",
  name: "Transition Curves",
  position: 3,
  content: { deck: null, quiz: null, reviewerPdf: null },
  deleteBlocker: null,
  stamp: { savedAt: SEEDED, savedBy: null },
};

function setup(
  pdf: AdminReviewerPdfDetail = detail(),
  {
    actions: change = {},
    owner = false,
  }: { actions?: Partial<ReviewerPdfEditorActions>; owner?: boolean } = {},
) {
  const actions: ReviewerPdfEditorActions = {
    savePlacement: vi.fn(async () =>
      saved(
        placedDetail({
          stamp: { savedAt: "2026-11-18T02:00:00.000Z", savedBy: "AYC Content Team" },
        }),
      ),
    ),
    savePublished: vi.fn(async () => saved(placedDetail({ status: "published" }))),
    saveFreePreview: vi.fn(async () => saved(detail({ freePreview: true }))),
    addTopic: vi.fn(async () => saved(NEW_TOPIC)),
    removeReviewerPdf: vi.fn(async () => saved(pdf)),
    ...change,
  };
  const ownerActions: ReviewerPdfOwnerActions | null = owner
    ? { addExam: vi.fn(), addSubject: vi.fn() }
    : null;
  const shown: AdminReviewerPdfScreen = { pdf, topics: TOPICS };
  render(
    <ReviewerPdfEditor
      screen={shown}
      exams={EXAMS}
      viewer={VIEWER}
      actions={actions}
      ownerActions={ownerActions}
    />,
  );
  return { actions, user: userEvent.setup() };
}

const placement = () => screen.getByRole("region", { name: "PLACEMENT" });
const inTheApp = () => screen.getByRole("region", { name: "IN THE MEMBER APP" });
const preview = () => screen.getByRole("region", { name: "PREVIEW" });

beforeEach(() => {
  refresh.mockClear();
  push.mockClear();
  toast.mockClear();
});

describe("the preview", () => {
  it("shows its pages one at a time, as Members see them, with the viewer's email over each", async () => {
    const { user } = setup();

    const page = within(preview()).getByRole("img", { name: "Page 1 of 3" });
    expect(page).toHaveAttribute("src", paths.admin.reviewerPdfPage(ID, 1));
    expect(within(preview()).getByRole("status")).toHaveTextContent(
      "PREVIEW · 1 / 3 · AS MEMBERS SEE IT",
    );
    const watermark = preview().querySelector("[data-watermark]");
    expect(watermark?.getAttribute("style")).toContain(
      encodeURIComponent("content@aceyourcourse.ph"),
    );
    expect(within(preview()).getByRole("button", { name: "Previous page" })).toBeDisabled();

    await user.click(within(preview()).getByRole("button", { name: "Next page" }));
    await user.click(within(preview()).getByRole("button", { name: "Next page" }));

    expect(within(preview()).getByRole("img", { name: "Page 3 of 3" })).toHaveAttribute(
      "src",
      paths.admin.reviewerPdfPage(ID, 3),
    );
    expect(within(preview()).getByRole("button", { name: "Next page" })).toBeDisabled();
    await user.click(within(preview()).getByRole("button", { name: "Previous page" }));
    expect(within(preview()).getByRole("img", { name: "Page 2 of 3" })).toBeInTheDocument();
  });

  it("shows the pages split so far while it's still being split", () => {
    setup(detail({ status: "processing", upload: { ...UPLOAD, pageCount: 5, pagesDone: 2 } }));

    expect(within(preview()).getByRole("img", { name: "Page 1 of 5" })).toBeInTheDocument();
    expect(preview()).toHaveTextContent("Pages 3–5 show here once they’re split.");
  });

  it("says why there's nothing to show: not split yet, no file, or a failed split", () => {
    setup(detail({ status: "processing", upload: { ...UPLOAD, pageCount: null, pagesDone: 0 } }));
    expect(preview()).toHaveTextContent("Its pages show here as they’re split.");
    expect(within(preview()).queryByRole("img")).toBeNull();
  });

  it("says a sample Reviewer PDF has no file, so no pages", () => {
    setup(detail({ upload: null }));
    expect(preview()).toHaveTextContent(
      "From the sample data: it has no file, so it has no pages.",
    );
  });
});

describe("Publish", () => {
  it("is disabled until it's placed under a Topic, saying so", () => {
    setup();

    const publish = within(inTheApp()).getByRole("button", { name: "Publish" });
    expect(publish).toBeDisabled();
    expect(publish).toHaveAccessibleDescription(CHOOSE_A_TOPIC);
  });

  it.each([
    [
      "still being split",
      detail({ status: "processing", upload: { ...UPLOAD, pagesDone: 1 } }),
      STILL_SPLITTING,
    ],
    [
      "failed",
      detail({ status: "failed", upload: { ...UPLOAD, pagesDone: 0, failure: "password" } }),
      SPLIT_FAILED,
    ],
  ])("is disabled for an upload %s, saying why", (_case, pdf, reason) => {
    setup(pdf);
    expect(within(inTheApp()).getByRole("button", { name: "Publish" })).toHaveAccessibleDescription(
      reason,
    );
  });

  it("publishes a placed Draft, says so, and reads the page again", async () => {
    const { actions, user } = setup(placedDetail());
    expect(inTheApp()).toHaveTextContent("NOT VISIBLE TO MEMBERS");

    await user.click(within(inTheApp()).getByRole("button", { name: "Publish" }));

    expect(actions.savePublished).toHaveBeenCalledWith(expect.anything(), {
      input: { id: ID, published: true },
    });
    expect(toast).toHaveBeenCalledWith("✓ PUBLISHED · MEMBERS CAN SEE IT");
    expect(refresh).toHaveBeenCalled();
  });

  it("unpublishes a Published one", async () => {
    const { actions, user } = setup(placedDetail({ status: "published" }), {
      actions: { savePublished: vi.fn(async () => saved(placedDetail({ status: "unpublished" }))) },
    });
    expect(inTheApp()).toHaveTextContent("LIVE IN THE LIBRARY");

    await user.click(within(inTheApp()).getByRole("button", { name: "Unpublish" }));

    expect(actions.savePublished).toHaveBeenCalledWith(expect.anything(), {
      input: { id: ID, published: false },
    });
    expect(toast).toHaveBeenCalledWith("✓ UNPUBLISHED · HIDDEN FROM MEMBERS");
  });

  it("says why the server refused, as a toast", async () => {
    const { user } = setup(placedDetail(), {
      actions: {
        savePublished: vi.fn(async () => ({
          status: "refused" as const,
          error: { kind: "invalid" as const, fieldErrors: {}, formError: CHOOSE_A_TOPIC },
        })),
      },
    });

    await user.click(within(inTheApp()).getByRole("button", { name: "Publish" }));

    expect(toast).toHaveBeenCalledWith(CHOOSE_A_TOPIC);
  });
});

describe("Free Preview", () => {
  it("saves at once when switched", async () => {
    const { actions, user } = setup();

    await user.click(within(inTheApp()).getByRole("switch", { name: "Free Preview" }));

    expect(actions.saveFreePreview).toHaveBeenCalledWith(expect.anything(), {
      input: { id: ID, freePreview: true },
    });
  });
});

describe("placement", () => {
  it("opens an unplaced one on the first Exam and Subject, with no Topic picked", () => {
    setup();

    expect(within(placement()).getByLabelText("EXAM")).toHaveValue("CE");
    expect(within(placement()).getByLabelText("SUBJECT")).toHaveValue("MSTC");
    expect(within(placement()).getByLabelText("TOPIC")).toHaveValue("");
    expect(placement()).toHaveTextContent(
      "Not in the member Library: choose a topic, save, then publish.",
    );
  });

  it("opens a placed one where it is, saying where Members will find it", () => {
    setup(placedDetail());

    expect(within(placement()).getByLabelText("TOPIC")).toHaveValue(SURVEYING.id);
    expect(placement()).toHaveTextContent(
      "Shows in the member Library under CE › MSTC › Surveying once it’s published.",
    );
  });

  it("saves the Topic picked, with the stamp the form opened with", async () => {
    const { actions, user } = setup();

    await user.selectOptions(within(placement()).getByLabelText("TOPIC"), "Surveying");
    await user.click(within(placement()).getByRole("button", { name: "Save placement" }));

    expect(actions.savePlacement).toHaveBeenCalledWith(expect.anything(), {
      input: { id: ID, topic: SURVEYING.id },
      expected: { savedAt: SEEDED },
    });
    expect(await within(placement()).findByText("✓ SAVED")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("won't save without a Topic", async () => {
    const { actions, user } = setup();

    await user.click(within(placement()).getByRole("button", { name: "Save placement" }));

    expect(actions.savePlacement).not.toHaveBeenCalled();
    expect(within(placement()).getByText("CHOOSE A TOPIC")).toBeInTheDocument();
  });

  it("links the Reviewer PDF on a Topic that has one, and won't save it there", async () => {
    const { actions, user } = setup();
    const topics = within(placement()).getByLabelText("TOPIC");
    expect(
      within(topics).getByRole("option", { name: "Simple Curves · has a Reviewer PDF" }),
    ).toBeInTheDocument();

    await user.selectOptions(topics, SIMPLE_CURVES.id);

    expect(
      within(placement()).getByRole("link", { name: "Open that Reviewer PDF" }),
    ).toHaveAttribute("href", paths.admin.reviewerPdf(OTHER));
    await user.click(within(placement()).getByRole("button", { name: "Save placement" }));
    expect(actions.savePlacement).not.toHaveBeenCalled();
    expect(within(placement()).getByText(TOPIC_TAKEN)).toBeInTheDocument();
  });

  it("reads the page again when the server knew of a Reviewer PDF there that the page didn't", async () => {
    const { user } = setup(detail(), {
      actions: {
        savePlacement: vi.fn(async () => ({
          status: "refused" as const,
          error: { kind: "invalid" as const, fieldErrors: { topic: [TOPIC_TAKEN] } },
        })),
      },
    });

    await user.selectOptions(within(placement()).getByLabelText("TOPIC"), SURVEYING.id);
    await user.click(within(placement()).getByRole("button", { name: "Save placement" }));

    expect(await within(placement()).findByText(TOPIC_TAKEN)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the conflict when someone placed it since the form opened", async () => {
    const { user } = setup(detail(), {
      actions: {
        savePlacement: vi.fn(async () => ({
          status: "refused" as const,
          error: { kind: "conflict" as const, savedBy: "Angel Rose L. Lepaña", savedAt: SEEDED },
        })),
      },
    });

    await user.selectOptions(within(placement()).getByLabelText("TOPIC"), SURVEYING.id);
    await user.click(within(placement()).getByRole("button", { name: "Save placement" }));

    expect(await within(placement()).findByRole("alert")).toHaveTextContent("SOMEONE SAVED FIRST");
  });

  it("offers the picked Exam's Subjects, and starts the Topic again when the Exam or Subject changes", async () => {
    const { user } = setup();
    await user.selectOptions(within(placement()).getByLabelText("TOPIC"), SURVEYING.id);

    await user.selectOptions(within(placement()).getByLabelText("SUBJECT"), "HPGE");
    expect(within(placement()).getByLabelText("TOPIC")).toHaveValue("");
    expect(
      within(within(placement()).getByLabelText("TOPIC"))
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Choose a topic", "Hydrostatics"]);

    await user.selectOptions(within(placement()).getByLabelText("EXAM"), "ME");
    expect(within(placement()).getByLabelText("SUBJECT")).toHaveValue("PIP");
    expect(within(placement()).getByLabelText("TOPIC")).toHaveValue("");
  });

  it("makes a Topic with “+ New topic” without leaving, and picks it", async () => {
    const { actions, user } = setup();

    await user.click(within(placement()).getByRole("button", { name: "+ New topic" }));
    const form = within(placement()).getByRole("form", { name: "New topic" });
    await user.type(within(form).getByLabelText("NEW TOPIC IN CE › MSTC"), "Transition Curves");
    await user.click(within(form).getByRole("button", { name: "Add topic" }));

    expect(actions.addTopic).toHaveBeenCalledWith(expect.anything(), {
      input: { exam: "CE", subject: "MSTC", name: "Transition Curves" },
    });
    expect(within(placement()).queryByRole("form", { name: "New topic" })).toBeNull();
    expect(within(placement()).getByLabelText("TOPIC")).toHaveValue(NEW_TOPIC.id);
    expect(toast).toHaveBeenCalledWith("✓ TOPIC ADDED · Transition Curves");
  });

  it("shows why a new Topic was refused, such as a name the Subject has already", async () => {
    const taken = "MSTC ALREADY HAS A TOPIC CALLED “Simple Curves”";
    const { user } = setup(detail(), {
      actions: {
        addTopic: vi.fn(async () => ({
          status: "refused" as const,
          error: { kind: "invalid" as const, fieldErrors: { name: [taken] } },
        })),
      },
    });

    await user.click(within(placement()).getByRole("button", { name: "+ New topic" }));
    const form = within(placement()).getByRole("form", { name: "New topic" });
    await user.type(within(form).getByLabelText("NEW TOPIC IN CE › MSTC"), "simple curves");
    await user.click(within(form).getByRole("button", { name: "Add topic" }));

    expect(await within(form).findByText(taken)).toBeInTheDocument();
    expect(within(placement()).getByLabelText("TOPIC")).toHaveValue("");
  });

  it("says a Published one is unpublished before it moves, and won't send a move", async () => {
    const { actions, user } = setup(placedDetail({ status: "published" }));
    expect(placement()).toHaveTextContent(UNPUBLISH_TO_MOVE);

    await user.selectOptions(within(placement()).getByLabelText("SUBJECT"), "HPGE");
    await user.selectOptions(within(placement()).getByLabelText("TOPIC"), HYDROSTATICS.id);
    await user.click(within(placement()).getByRole("button", { name: "Save placement" }));

    expect(actions.savePlacement).not.toHaveBeenCalled();
    expect(within(placement()).getByRole("status")).toHaveTextContent(UNPUBLISH_TO_MOVE);
  });

  it("says one still being split waits until it's split", () => {
    setup(detail({ status: "processing", upload: { ...UPLOAD, pagesDone: 1 } }));
    expect(placement()).toHaveTextContent(STILL_SPLITTING);
  });

  it("gives an Editor no “+ Add exam” or “+ Add subject”", () => {
    setup();

    expect(within(placement()).queryByRole("button", { name: "+ Add exam" })).toBeNull();
    expect(within(placement()).queryByRole("button", { name: /\+ Add subject/ })).toBeNull();
  });

  it("gives an Owner Pages & promo's forms for a new Exam and a new Subject", async () => {
    const { user } = setup(detail(), { owner: true });

    await user.click(within(placement()).getByRole("button", { name: "+ Add exam" }));
    expect(within(placement()).getByRole("form", { name: "New exam" })).toBeInTheDocument();

    await user.click(within(placement()).getByRole("button", { name: "+ Add subject to CE" }));
    expect(within(placement()).queryByRole("form", { name: "New exam" })).toBeNull();
    expect(within(placement()).getByRole("form", { name: "Add subject" })).toBeInTheDocument();
  });
});

describe("Delete", () => {
  it("goes back to the Reviewer PDFs once it's deleted", async () => {
    const { actions, user } = setup();

    await user.click(screen.getByRole("button", { name: "Delete MSTC Reviewer.pdf" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "DELETE");
    await user.click(within(dialog).getByRole("button", { name: "Delete Reviewer PDF" }));

    expect(actions.removeReviewerPdf).toHaveBeenCalledWith(expect.anything(), {
      input: { id: ID },
    });
    expect(push).toHaveBeenCalledWith(paths.admin.reviewerPdfs);
  });
});
