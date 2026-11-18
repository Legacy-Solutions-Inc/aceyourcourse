import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import { MAX_PDF_BYTES } from "@/lib/reviewer-pdfs/job";
import type { AdminReviewerPdf } from "@/services/admin.types";
import type { ReviewerPdfUpload } from "@/services/content.types";
import type { ReviewerPdfUploadTicket } from "@/services/uploads.types";

import { REFRESH_MS, ReviewerPdfs, type ReviewerPdfsActions } from "./reviewer-pdfs";

// The Reviewer PDFs screen (Phase 3, ticket 12; stories 114, 115), with stub
// Server Actions and a stub upload: a PDF is checked in the browser before
// it's uploaded (a PDF of up to 200 MB), sent with its progress shown, then
// recorded; the list shows each one's status and progress, reads itself
// again while any is Processing, shows a failure with its fix, and deletes
// behind the typed confirmation. The server's rules are in
// admin.reviewer-pdfs.test.ts.
const { refresh, toast, sendReviewerPdf } = vi.hoisted(() => ({
  refresh: vi.fn(),
  toast: vi.fn(),
  sendReviewerPdf: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  unstable_rethrow: () => {},
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("./send-reviewer-pdf", () => ({ sendReviewerPdf }));

const ID = "0b9f4a5e-8d3c-4f1a-9e2b-7c6d5e4f3a21";
const UPLOADED_AT = "2026-11-18T01:00:00.000Z";

const UPLOAD: ReviewerPdfUpload = {
  fileName: "MSTC Reviewer.pdf",
  fileSize: 14.2 * 1024 * 1024,
  uploadedAt: UPLOADED_AT,
  pageCount: 312,
  pagesDone: 75,
  heartbeatAt: UPLOADED_AT,
  restarts: 0,
  failure: null,
};

const pdf = (change: Partial<AdminReviewerPdf> = {}): AdminReviewerPdf => ({
  id: ID,
  status: "processing",
  placement: null,
  upload: UPLOAD,
  ...change,
});

const TICKET: ReviewerPdfUploadTicket = {
  method: "put",
  uploadUrl: "/api/dev/uploads/u?token=t",
  path: "uploads/u",
};

const saved = <T,>(value: T): AdminActionState<T> => ({ status: "saved", value });

function setup(pdfs: AdminReviewerPdf[] = [], change: Partial<ReviewerPdfsActions> = {}) {
  const actions: ReviewerPdfsActions = {
    createReviewerPdfUpload: vi.fn(async () => saved(TICKET)),
    addReviewerPdf: vi.fn(async () =>
      saved(pdf({ upload: { ...UPLOAD, pageCount: null, pagesDone: 0 } })),
    ),
    removeReviewerPdf: vi.fn(async () => saved(pdf())),
    ...change,
  };
  render(<ReviewerPdfs pdfs={pdfs} actions={actions} />);
  return { actions, user: userEvent.setup() };
}

const pdfFile = (size = 1024, name = "MSTC Reviewer.pdf", type = "application/pdf") => {
  const file = new File(["%PDF-1.4"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

beforeEach(() => {
  refresh.mockClear();
  toast.mockClear();
  sendReviewerPdf.mockReset();
  sendReviewerPdf.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("uploading", () => {
  it("sends the PDF, records it, and says the Editor can leave", async () => {
    const { actions, user } = setup();
    let finish: () => void = () => {};
    sendReviewerPdf.mockImplementation(
      (_ticket, _file, onProgress: (sent: number) => void) =>
        new Promise<void>((resolve) => {
          onProgress(0.42);
          finish = resolve;
        }),
    );
    const file = pdfFile(2048);

    await user.upload(screen.getByLabelText("Choose a PDF"), file);

    expect(actions.createReviewerPdfUpload).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { contentType: "application/pdf", size: 2048 } },
    );
    expect(
      await screen.findByRole("progressbar", { name: "Uploading MSTC Reviewer.pdf" }),
    ).toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByRole("status")).toHaveTextContent(
      "UPLOADING MSTC Reviewer.pdf · 42% · KEEP THIS PAGE OPEN UNTIL IT’S UPLOADED",
    );
    expect(sendReviewerPdf).toHaveBeenCalledWith(TICKET, file, expect.any(Function));
    // While it's uploading, leaving the page asks first.
    const leaving = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);

    finish();

    await waitFor(() =>
      expect(actions.addReviewerPdf).toHaveBeenCalledWith(
        { status: "idle" },
        { input: { path: "uploads/u", fileName: "MSTC Reviewer.pdf" } },
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "✓ UPLOADED MSTC Reviewer.pdf · YOU CAN LEAVE THIS PAGE. IT KEEPS GOING AND SHOWS UP AS A DRAFT WHEN DONE.",
    );
    expect(toast).toHaveBeenCalledWith("✓ UPLOADED · SPLITTING IT INTO PAGES");
    expect(refresh).toHaveBeenCalled();
    const after = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it.each([
    ["a file that isn't a PDF", pdfFile(1024, "photo.png", "image/png"), "USE A PDF FILE"],
    ["a PDF over 200 MB", pdfFile(MAX_PDF_BYTES + 1), "KEEP THE PDF TO 200 MB"],
    ["an empty PDF", pdfFile(0), "THE FILE IS EMPTY"],
  ])("refuses %s before uploading anything", async (_, file, message) => {
    const { actions } = setup();
    const user = userEvent.setup({ applyAccept: false });

    await user.upload(screen.getByLabelText("Choose a PDF"), file);

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(actions.createReviewerPdfUpload).not.toHaveBeenCalled();
    expect(sendReviewerPdf).not.toHaveBeenCalled();
  });

  it("takes a PDF dropped on the drop zone", async () => {
    const { actions } = setup();
    const zone = screen.getByRole("region", { name: "Drop a Reviewer PDF here" });
    const file = pdfFile();

    fireEvent.dragOver(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    await waitFor(() => expect(actions.addReviewerPdf).toHaveBeenCalled());
    expect(sendReviewerPdf).toHaveBeenCalledWith(TICKET, file, expect.any(Function));
  });

  it("shows the server's refusal of the upload", async () => {
    const { user } = setup([], {
      createReviewerPdfUpload: vi.fn(
        async (): Promise<AdminActionState<ReviewerPdfUploadTicket>> => ({
          status: "refused",
          error: { kind: "invalid", fieldErrors: { size: ["KEEP THE PDF TO 200 MB"] } },
        }),
      ),
    });

    await user.upload(screen.getByLabelText("Choose a PDF"), pdfFile());

    expect(await screen.findByRole("alert")).toHaveTextContent("KEEP THE PDF TO 200 MB");
    expect(sendReviewerPdf).not.toHaveBeenCalled();
  });

  it("says when the upload stops, recording nothing", async () => {
    sendReviewerPdf.mockRejectedValue(new Error("network"));
    const { actions, user } = setup();

    await user.upload(screen.getByLabelText("Choose a PDF"), pdfFile());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "THE UPLOAD STOPPED · CHECK YOUR CONNECTION AND UPLOAD IT AGAIN",
    );
    expect(actions.addReviewerPdf).not.toHaveBeenCalled();
  });

  it("shows why the server wouldn't record it", async () => {
    const { user } = setup([], {
      addReviewerPdf: vi.fn(async (): Promise<AdminActionState<AdminReviewerPdf>> => ({
        status: "refused",
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "THE PDF HASN’T FINISHED UPLOADING · UPLOAD IT AGAIN",
        },
      })),
    });

    await user.upload(screen.getByLabelText("Choose a PDF"), pdfFile());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "THE PDF HASN’T FINISHED UPLOADING · UPLOAD IT AGAIN",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("says when the server can't be reached", async () => {
    const { user } = setup([], {
      createReviewerPdfUpload: vi.fn(
        async (): Promise<AdminActionState<ReviewerPdfUploadTicket>> => ({ status: "failed" }),
      ),
    });

    await user.upload(screen.getByLabelText("Choose a PDF"), pdfFile());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "COULDN’T UPLOAD IT · CHECK YOUR CONNECTION AND TRY AGAIN",
    );
  });
});

describe("the list", () => {
  it("shows each one's file, placement, status and progress", () => {
    setup([
      pdf(),
      pdf({
        id: "6f1d2c3b-4a59-4e8f-9d7c-1b2a3c4d5e6f",
        status: "published",
        upload: null,
        placement: { examCode: "CE", subjectCode: "MSTC", topicName: "Simple Curves" },
      }),
    ]);

    const list = screen.getByRole("list", { name: "Reviewer PDFs" });
    const [processing, sample] = within(list).getAllByRole("listitem");
    if (!processing || !sample) throw new Error("expected two rows");
    expect(processing).toHaveTextContent("MSTC Reviewer.pdf");
    expect(processing).toHaveTextContent("14.2 MB · UPLOADED 18 NOV 2026, 9:00 AM");
    expect(processing).toHaveTextContent("Not placed under a Topic yet");
    expect(processing).toHaveTextContent("PROCESSING");
    expect(processing).toHaveTextContent("Processing · 75 of 312 pages");
    expect(
      within(processing).getByRole("progressbar", { name: "Pages split from MSTC Reviewer.pdf" }),
    ).toHaveAttribute("aria-valuenow", "24");
    expect(sample).toHaveTextContent("Simple Curves Reviewer PDF");
    expect(sample).toHaveTextContent("FROM THE SAMPLE DATA · NO FILE");
    expect(sample).toHaveTextContent("CE › MSTC › Simple Curves");
    expect(sample).toHaveTextContent("PUBLISHED");
    expect(within(sample).queryByRole("progressbar")).toBeNull();
    expect(screen.getByRole("heading", { name: "REVIEWER PDFS · 2" })).toBeInTheDocument();
  });

  it("shows a failed one's reason with its fix", () => {
    setup([
      pdf({
        status: "failed",
        upload: { ...UPLOAD, pageCount: null, pagesDone: 0, failure: "password" },
      }),
    ]);

    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("Couldn’t split this PDF");
    expect(row).toHaveTextContent(
      "The PDF is password-protected. Remove the password and upload again.",
    );
    expect(row).toHaveTextContent("Failed");
  });

  it("names the sample data's Reviewer PDFs, which have no file, after their Topic", () => {
    setup([pdf({ upload: null, status: "draft" })]);
    expect(screen.getByRole("listitem")).toHaveTextContent("Sample Reviewer PDF");
    expect(screen.getByRole("listitem")).toHaveTextContent("Draft");
  });

  it("says when there are none", () => {
    setup([]);
    expect(screen.getByText("No Reviewer PDFs yet. Upload one above.")).toBeInTheDocument();
  });

  it("reads itself again every few seconds while one is Processing", () => {
    vi.useFakeTimers();
    setup([pdf()]);

    vi.advanceTimersByTime(REFRESH_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(REFRESH_MS);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("stops reading itself once none is Processing", () => {
    vi.useFakeTimers();
    setup([pdf({ status: "draft", upload: { ...UPLOAD, pagesDone: 312 } })]);

    vi.advanceTimersByTime(REFRESH_MS * 3);
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("listitem")).toHaveTextContent("Draft · 312 pages");
  });
});

describe("deleting", () => {
  it("deletes one once DELETE is typed", async () => {
    const { actions, user } = setup([pdf({ status: "draft" })]);

    await user.click(screen.getByRole("button", { name: "Delete MSTC Reviewer.pdf" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Delete “MSTC Reviewer.pdf”?");
    expect(dialog).toHaveTextContent("The original PDF and every page image are deleted");
    const confirm = within(dialog).getByRole("button", { name: "Delete Reviewer PDF" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "DELETE");
    await user.click(confirm);

    await waitFor(() =>
      expect(actions.removeReviewerPdf).toHaveBeenCalledWith(
        { status: "idle" },
        { input: { id: ID } },
      ),
    );
    expect(toast).toHaveBeenCalledWith("✓ DELETED · MSTC Reviewer.pdf");
    expect(refresh).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("says splitting stops when it's still Processing", async () => {
    const { user } = setup([pdf()]);
    await user.click(screen.getByRole("button", { name: "Delete MSTC Reviewer.pdf" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Splitting it into pages stops.");
  });

  it.each([
    [
      "one that's gone already",
      { status: "refused", error: { kind: "not-found" } } as const,
      "IT’S ALREADY DELETED · RELOAD THE PAGE",
    ],
    ["a failed delete", { status: "failed" } as const, "COULDN’T DELETE IT"],
  ])("says so for %s", async (_, answer, message) => {
    const { user } = setup([pdf()], { removeReviewerPdf: vi.fn(async () => answer) });

    await user.click(screen.getByRole("button", { name: "Delete MSTC Reviewer.pdf" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "DELETE");
    await user.click(within(dialog).getByRole("button", { name: "Delete Reviewer PDF" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(message);
    expect(refresh).not.toHaveBeenCalled();
  });
});
