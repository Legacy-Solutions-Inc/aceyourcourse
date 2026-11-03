import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import type { AdminActionState } from "@/lib/admin/action";
import type { ExamPageEditorKey } from "@/lib/admin/exam-pages-view";
import type { AdminExamPage } from "@/services/admin.types";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import type { UploadTicket } from "@/services/uploads.types";

import { type ExamPageActions, ExamPagePanel } from "./exam-page-panel";
import { ExamSectionSwitch } from "./exam-section-switch";

// Exam pages & promo's editors (BUILD-MAP §3.2, column 3) and a section
// switch, saving through stub Server Actions that answer as adminAction
// would. The router and the browser's PUT to the upload URL are the
// framework and network boundaries, so they're replaced.
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  unstable_rethrow: () => {},
}));
const network = vi.hoisted(() => ({
  sent: [] as { url: string; name: string }[],
  sizes: new Map<string, { width: number; height: number }>(),
}));
vi.mock("@/components/admin/products/put-file", () => ({
  putFile: async (url: string, file: File) => {
    network.sent.push({ url, name: file.name });
  },
  measureImage: async (file: File) => network.sizes.get(file.name) ?? null,
}));

type Submission = { input: unknown; expected?: { savedAt: string } };

/** A stub Server Action that answers each call in turn. */
function answering<T>(...answers: AdminActionState<T>[]) {
  return vi.fn(async (_previous: AdminActionState<T>, _submission: Submission) => {
    const next = answers.shift();
    if (!next) throw new Error("no more answers");
    return next;
  });
}

const OPENED_AT = "2026-10-22T03:42:00.000Z";
const STAMP = { savedAt: OPENED_AT, savedBy: null };
const SAVED_AT = { savedAt: "2026-10-22T03:43:00.000Z", savedBy: "AYC Content Team" };

function ce(): AdminExamPage {
  const exam = CATALOGUE_SEED.exams.find((e) => e.code === "CE");
  const page = CATALOGUE_SEED.examPages.find((p) => p.examCode === "CE");
  if (!exam || !page) throw new Error("the seed has no CE");
  return structuredClone({
    exam,
    page,
    stamps: {
      header: STAMP,
      subjects: STAMP,
      sections: STAMP,
      bundleOffer: STAMP,
      seo: STAMP,
      officialExamDate: STAMP,
    },
    products: [
      { id: "prd-001", shortName: "CE Formula Flash Cards", state: "live", showOnWebsite: true },
      { id: "prd-008", shortName: "CE Review Bundle 3-in-1", state: "live", showOnWebsite: true },
    ],
  });
}

/** What a save answers: the page with these changes, and the part's new stamp. */
function savedWith(change: (page: AdminExamPage) => void): AdminActionState<AdminExamPage> {
  const page = ce();
  change(page);
  return { status: "saved", value: page };
}

function renderPanel(selected: ExamPageEditorKey, actions: Partial<ExamPageActions> = {}) {
  const user = userEvent.setup({ applyAccept: false });
  const all: ExamPageActions = {
    setSection: answering(),
    saveHeader: answering(),
    saveSubjects: answering(),
    saveBundle: answering(),
    saveSeo: answering(),
    saveDate: answering(),
    createShareImageUpload: answering(),
    ...actions,
  };
  render(
    <>
      <ExamPagePanel opened={ce()} selected={selected} actions={all} today="2026-11-03" />
      <Toaster />
    </>,
  );
  return { user, actions: all };
}

const editor = () => screen.getByRole("complementary", { name: "Exam page editor" });
const saveState = () => within(editor()).getByRole("status");

beforeEach(() => {
  router.refresh.mockClear();
  network.sent = [];
  network.sizes.clear();
  // jsdom has no object URLs; the preview only needs a src.
  URL.createObjectURL = vi.fn((file: Blob) => `blob:${file instanceof File ? file.name : "file"}`);
  URL.revokeObjectURL = vi.fn();
});

describe("the Header", () => {
  it("saves the fields with the stamp it opened with, then reads the page again", async () => {
    const saveHeader = answering(
      savedWith((page) => {
        page.exam.blurb = "Every CE formula.";
        page.stamps.header = SAVED_AT;
      }),
    );
    const { user } = renderPanel("header", { saveHeader });

    const text = within(editor()).getByLabelText("TEXT");
    await user.clear(text);
    await user.type(text, "Every CE formula.");
    expect(saveState()).toHaveTextContent("UNSAVED CHANGES");
    await user.click(within(editor()).getByRole("button", { name: "Save" }));

    expect(await within(editor()).findByText("✓ SAVED · LIVE ON THE SITE")).toBeInTheDocument();
    expect(saveHeader).toHaveBeenCalledWith(expect.anything(), {
      input: {
        code: "CE",
        name: "Civil Engineering",
        longName: "Civil Engineering Licensure Exam",
        blurb: "Every CE formula.",
        madeFor: "Engineers needing a quick formula reference",
      },
      expected: { savedAt: OPENED_AT },
    });
    expect(router.refresh).toHaveBeenCalled();
    expect(within(editor()).getByText(/From the top-selling CE product/)).toBeInTheDocument();
  });

  it("shows each field's message when the save is refused, keeping the edits", async () => {
    const saveHeader = answering<AdminExamPage>({
      status: "refused",
      error: { kind: "invalid", fieldErrors: { name: ["ADD THE EXAM NAME"] } },
    });
    const { user } = renderPanel("header", { saveHeader });

    await user.clear(within(editor()).getByLabelText("EXAM NAME"));
    await user.click(within(editor()).getByRole("button", { name: "Save" }));

    expect(await within(editor()).findByText("ADD THE EXAM NAME")).toBeInTheDocument();
    expect(saveState()).toHaveTextContent("FIX THE FIELDS MARKED IN RED");
    expect(within(editor()).getByLabelText("EXAM NAME")).toHaveValue("");
  });

  it("says who saved first when the save conflicts", async () => {
    const saveHeader = answering<AdminExamPage>({
      status: "refused",
      error: { kind: "conflict", savedBy: "Angel Rose L. Lepaña", savedAt: OPENED_AT },
    });
    const { user } = renderPanel("header", { saveHeader });

    await user.type(within(editor()).getByLabelText("MADE FOR"), "!");
    await user.click(within(editor()).getByRole("button", { name: "Save" }));

    expect(await within(editor()).findByRole("alert")).toHaveTextContent(
      /Angel Rose L\. Lepaña saved this header at/,
    );
  });

  it("shows the “Couldn't save” toast when the save breaks down", async () => {
    const { user } = renderPanel("header", {
      saveHeader: answering<AdminExamPage>({ status: "failed" }),
    });
    await user.type(within(editor()).getByLabelText("MADE FOR"), "!");
    await user.click(within(editor()).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("COULDN’T SAVE")).toBeInTheDocument();
  });
});

describe("Subjects covered", () => {
  it("sends every Subject with its fixed code and the new name", async () => {
    const saveSubjects = answering(savedWith(() => {}));
    const { user } = renderPanel("subjects", { saveSubjects });

    const mstc = within(editor()).getByLabelText("01 · MSTC");
    await user.clear(mstc);
    await user.type(mstc, "Math, Surveying & Transpo");
    await user.click(within(editor()).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saveSubjects).toHaveBeenCalled());
    expect(saveSubjects.mock.calls[0]?.[1].input).toEqual({
      code: "CE",
      subjects: [
        { code: "MSTC", name: "Math, Surveying & Transpo" },
        { code: "HPGE", name: "Hydraulics & Geotechnical Engineering" },
        { code: "PSAD", name: "Principles of Structural Analysis & Design" },
      ],
    });
  });
});

describe("the Bundle offer", () => {
  it("drops the fields with No offer, and sends no Product", async () => {
    const saveBundle = answering(savedWith((page) => (page.page.bundleOffer = null)));
    const { user } = renderPanel("bundle", { saveBundle });

    await user.selectOptions(within(editor()).getByLabelText("PRODUCT"), "No offer");
    expect(within(editor()).queryByLabelText("HEADLINE")).not.toBeInTheDocument();
    await user.click(within(editor()).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saveBundle).toHaveBeenCalled());
    expect(saveBundle.mock.calls[0]?.[1].input).toMatchObject({ code: "CE", productId: "" });
  });
});

describe("Search & AI visibility", () => {
  it("counts the whole title and previews it as typed, GOOD within the limits", async () => {
    const { user } = renderPanel("seo");
    const title = within(editor()).getByLabelText("PAGE TITLE");

    await user.type(title, "CE Board Exam Reviewer");
    // "CE Board Exam Reviewer · Ace Your Course"
    expect(title).toHaveAccessibleDescription("40 / 60 characters, with the site name");
    expect(within(editor()).getByRole("figure")).toHaveTextContent(
      "CE Board Exam Reviewer · Ace Your Course",
    );
    expect(within(editor()).getByText("GOOD")).toBeInTheDocument();
  });

  it("says CHECK for a 70-character description, and marks a 61-character title red", async () => {
    const { user } = renderPanel("seo");
    await user.type(within(editor()).getByLabelText("META DESCRIPTION"), "d".repeat(70));
    expect(within(editor()).getByText(/^CHECK/)).toBeInTheDocument();

    const title = within(editor()).getByLabelText("PAGE TITLE");
    await user.type(title, "T".repeat(43));
    expect(title).toHaveAccessibleDescription("61 / 60 characters, with the site name");
    const counter = within(editor()).getByText(/^61 \/ 60/);
    expect(counter).toHaveClass("text-destructive");
  });

  it("uploads a share image, warns that it isn't 1200 × 630, and saves its path", async () => {
    network.sizes.set("square.png", { width: 1200, height: 1200 });
    const createShareImageUpload = vi.fn(async (): Promise<AdminActionState<UploadTicket>> => ({
      status: "saved",
      value: {
        uploadUrl: "/api/dev/uploads/1?token=t",
        path: "uploads/1",
        publicUrl: "/api/dev/uploads/1",
      },
    }));
    const saveSeo = answering(savedWith((page) => (page.page.shareImage = "/api/dev/uploads/1")));
    const { user } = renderPanel("seo", { createShareImageUpload, saveSeo });

    const field = within(editor()).getByLabelText("SHARE IMAGE · 1200 × 630");
    await user.upload(field, new File(["png"], "square.png", { type: "image/png" }));

    expect(
      await within(editor()).findByText("1200 × 1200 · NOT 1200 × 630, SO IT MAY BE CROPPED"),
    ).toBeInTheDocument();
    await waitFor(() => expect(field).toHaveAccessibleDescription("square.png"));
    expect(createShareImageUpload).toHaveBeenCalledWith(expect.anything(), {
      input: { code: "CE", contentType: "image/png", size: 3 },
    });
    expect(network.sent).toEqual([{ url: "/api/dev/uploads/1?token=t", name: "square.png" }]);

    await user.click(within(editor()).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saveSeo).toHaveBeenCalled());
    expect(saveSeo.mock.calls[0]?.[1].input).toMatchObject({ shareImage: "uploads/1" });
  });

  it("refuses a GIF before uploading it", async () => {
    const createShareImageUpload = answering<UploadTicket>();
    const { user } = renderPanel("seo", { createShareImageUpload });
    await user.upload(
      within(editor()).getByLabelText("SHARE IMAGE · 1200 × 630"),
      new File(["gif"], "moving.gif", { type: "image/gif" }),
    );
    expect(
      within(editor()).getByText("“moving.gif” isn’t a JPEG, PNG or WebP image."),
    ).toBeInTheDocument();
    expect(createShareImageUpload).not.toHaveBeenCalled();
  });
});

describe("the Official Exam Date", () => {
  it("warns about a past date but saves it", async () => {
    const saveDate = answering(savedWith((page) => (page.page.officialExamDate = "2026-04-24")));
    const { user } = renderPanel("date", { saveDate });

    await user.type(within(editor()).getByLabelText("OFFICIAL EXAM DATE"), "2026-04-24");
    expect(
      within(editor()).getByText("THIS DATE HAS PASSED · SET THE NEXT ONE ONCE PRC ANNOUNCES IT"),
    ).toBeInTheDocument();
    await user.click(within(editor()).getByRole("button", { name: "Save" }));

    expect(await within(editor()).findByText("✓ SAVED · LIVE ON THE SITE")).toBeInTheDocument();
    expect(saveDate.mock.calls[0]?.[1].input).toEqual({
      code: "CE",
      officialExamDate: "2026-04-24",
    });
  });
});

describe("ExamSectionSwitch", () => {
  function renderSwitch(action = answering<AdminExamPage>(savedWith(() => {}))) {
    const user = userEvent.setup();
    render(
      <>
        <ExamSectionSwitch
          examCode="ME"
          section="reviews"
          on
          title="Reviews"
          action={action}
          aria-label="Show Reviews on the ME page"
        />
        <Toaster />
      </>,
    );
    return { user, action };
  }

  it("hides the section at once, then reads the page again", async () => {
    const { user, action } = renderSwitch();
    await user.click(screen.getByRole("switch", { name: "Show Reviews on the ME page" }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(action).toHaveBeenCalledWith(expect.anything(), {
      input: { code: "ME", section: "reviews", on: false },
    });
  });

  it("flips before the server answers", async () => {
    let answer: (state: AdminActionState<AdminExamPage>) => void = () => {};
    const action = vi.fn(
      () => new Promise<AdminActionState<AdminExamPage>>((resolve) => (answer = resolve)),
    );
    const { user } = renderSwitch(action);
    await user.click(screen.getByRole("switch", { name: "Show Reviews on the ME page" }));

    expect(screen.getByRole("switch", { name: "Show Reviews on the ME page" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    // Answered, so no save is left pending for the next test's switch.
    answer(savedWith(() => {}));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("switches back with the “Couldn't save” toast when the save breaks down", async () => {
    const { user } = renderSwitch(answering<AdminExamPage>({ status: "failed" }));
    await user.click(screen.getByRole("switch", { name: "Show Reviews on the ME page" }));

    expect(await screen.findByText(/The switch is back as it was\./)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Show Reviews on the ME page" })).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );
  });
});
