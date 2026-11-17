import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type { CardImportPreview, CardImportResult } from "@/services/admin.types";
import type { ContentUploadTicket } from "@/services/uploads.types";

import { CardImport, type CardImportActions } from "./card-import";

// The card import screen (Phase 3, ticket 06; stories 118, 120–124), with stub
// Server Actions. The browser's PUT to the upload URL is the network boundary,
// so put-file is replaced.
const network = vi.hoisted(() => ({
  sent: [] as { url: string; name: string; contentType: string }[],
  fail: false,
}));
vi.mock("@/components/admin/products/put-file", () => ({
  putFile: async (
    url: string,
    file: File,
    onProgress: (sent: number) => void,
    contentType: string,
  ) => {
    onProgress(0.5);
    if (network.fail) throw new Error("offline");
    network.sent.push({ url, name: file.name, contentType });
  },
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));

const EXAM = { code: "CE", name: "Civil Engineering" };
const SUBJECT = { code: "MSTC", name: "Mathematics, Surveying & Transportation Engineering" };
const BASED_ON = "a".repeat(64);

const PREVIEW: CardImportPreview = {
  exam: EXAM,
  subject: SUBJECT,
  mode: "add",
  topics: [
    {
      name: "Simple Curves",
      topicId: "t-simple",
      similarTo: null,
      deck: "visible",
      mode: "add",
      counts: { add: 1, replace: 0, keep: 0, remove: 0 },
    },
    {
      name: "Simple Curve",
      topicId: null,
      similarTo: "Simple Curves",
      deck: "new",
      mode: "add",
      counts: { add: 2, replace: 0, keep: 0, remove: 0 },
    },
  ],
  problems: [],
  basedOn: BASED_ON,
};

const RESULT: CardImportResult = {
  topics: [
    {
      topicId: "t-new",
      deckId: "d-new",
      name: "Simple Curve",
      created: true,
      counts: { add: 2, replace: 0, keep: 0, remove: 0 },
    },
  ],
};

type Submission = { input: unknown; expected?: { savedAt: string } };

/** A stub Server Action that answers each call in turn. */
function answering<T>(...answers: AdminActionState<T>[]) {
  return vi.fn(async (_previous: AdminActionState<T>, _submission: Submission) => {
    const next = answers.shift();
    if (!next) throw new Error("no more answers");
    return next;
  });
}

/** createImportUpload answering with a new ticket each time. */
function tickets() {
  let count = 0;
  return vi.fn(
    async (
      _previous: AdminActionState<ContentUploadTicket>,
      submission: Submission,
    ): Promise<AdminActionState<ContentUploadTicket>> => {
      count += 1;
      const { purpose } = submission.input as { purpose: string };
      return {
        status: "saved",
        value: {
          uploadUrl: `/api/dev/uploads/${count}?token=t`,
          path: `uploads/${count}`,
          contentType: purpose === "card-import-csv" ? "text/csv" : "application/zip",
        },
      };
    },
  );
}

const csvFile = (name = "cards.csv") =>
  new File(["topic,front,back,note,image\n"], name, { type: "application/vnd.ms-excel" });
const zipFile = () => new File([new Uint8Array([0x50, 0x4b, 3, 4])], "images.zip");

function renderImport(actions: Partial<CardImportActions> = {}) {
  const all: CardImportActions = {
    createImportUpload: tickets(),
    checkCardImport: answering<CardImportPreview>({ status: "saved", value: PREVIEW }),
    importCards: answering<CardImportResult>({ status: "saved", value: RESULT }),
    ...actions,
  };
  render(<CardImport exam={EXAM} subject={SUBJECT} actions={all} />);
  return all;
}

async function chooseAndCheck(
  files: { csv?: File; zip?: File } = { csv: csvFile(), zip: zipFile() },
) {
  const user = userEvent.setup();
  if (files.csv) await user.upload(screen.getByLabelText("CSV FILE"), files.csv);
  if (files.zip) await user.upload(screen.getByLabelText("ZIP OF IMAGES (OPTIONAL)"), files.zip);
  await user.click(screen.getByRole("button", { name: "Check file" }));
  return user;
}

beforeEach(() => {
  network.sent = [];
  network.fail = false;
});

describe("CardImport", () => {
  it("offers the template and its example image to download", () => {
    renderImport();

    expect(screen.getByRole("link", { name: "Download the template (CSV)" })).toHaveAttribute(
      "href",
      "/admin/content/import/template",
    );
    expect(screen.getByRole("link", { name: "Its example image (zip)" })).toHaveAttribute(
      "href",
      "/admin/content/import/example-images",
    );
  });

  it("uploads the CSV and zip to their one-time URLs, then shows the preview of each Topic", async () => {
    const actions = renderImport();
    await chooseAndCheck();

    await screen.findByRole("heading", { name: "PREVIEW · NOTHING IS SAVED YET" });
    expect(actions.createImportUpload).toHaveBeenNthCalledWith(1, expect.anything(), {
      input: { purpose: "card-import-csv", size: csvFile().size },
    });
    expect(actions.createImportUpload).toHaveBeenNthCalledWith(2, expect.anything(), {
      input: { purpose: "card-import-zip", size: zipFile().size },
    });
    // The CSV goes as text/csv, whatever the browser called it.
    expect(network.sent).toEqual([
      { url: "/api/dev/uploads/1?token=t", name: "cards.csv", contentType: "text/csv" },
      { url: "/api/dev/uploads/2?token=t", name: "images.zip", contentType: "application/zip" },
    ]);
    expect(actions.checkCardImport).toHaveBeenCalledWith(expect.anything(), {
      input: { exam: "CE", subject: "MSTC", csv: "uploads/1", zip: "uploads/2", mode: "add" },
    });

    expect(screen.getByText("3 cards in 2 Topics · 1 new Topic")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "CARDS PER TOPIC" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole("cell")
          .map((c) => c.textContent),
      ),
    ).toEqual([
      ["DECK · VISIBLE", "1", "0", "0", "0"],
      ["NEW DECK · HIDDEN", "2", "0", "0", "0"],
    ]);
    expect(within(rows[1] as HTMLElement).getByText("NEW TOPIC")).toBeInTheDocument();
    expect(
      within(rows[1] as HTMLElement).getByText(
        "No Topic in MSTC is called this, so importing creates it. Did you rename “Simple Curves”? Use its current name to add to it.",
      ),
    ).toBeInTheDocument();
    expect(
      within(rows[0] as HTMLElement).getByText(
        "Its deck is Visible: Members see these changes as soon as you import.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeEnabled();
  });

  it("asks “did you rename it?” only of a new Topic whose name is close to an existing one", async () => {
    renderImport({
      checkCardImport: answering<CardImportPreview>({
        status: "saved",
        value: {
          ...PREVIEW,
          topics: [{ ...PREVIEW.topics[1]!, name: "Statics", similarTo: null }],
        },
      }),
    });
    await chooseAndCheck();

    expect(
      await screen.findByText("No Topic in MSTC is called this, so importing creates it."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Did you rename/)).not.toBeInTheDocument();
  });

  it("checks again without uploading files it already sent, and uploads a file chosen anew", async () => {
    const actions = renderImport({
      checkCardImport: answering<CardImportPreview>(
        { status: "saved", value: PREVIEW },
        { status: "saved", value: PREVIEW },
        { status: "saved", value: PREVIEW },
      ),
    });
    const user = await chooseAndCheck();
    await screen.findByRole("button", { name: "Import" });

    await user.click(screen.getByRole("button", { name: "Check again" }));
    await waitFor(() => expect(actions.checkCardImport).toHaveBeenCalledTimes(2));
    expect(actions.createImportUpload).toHaveBeenCalledTimes(2);

    await user.upload(screen.getByLabelText("CSV FILE"), csvFile("fixed.csv"));
    await user.click(screen.getByRole("button", { name: "Check file" }));
    await waitFor(() => expect(actions.checkCardImport).toHaveBeenCalledTimes(3));
    expect(actions.createImportUpload).toHaveBeenCalledTimes(3);
    expect(actions.checkCardImport).toHaveBeenLastCalledWith(expect.anything(), {
      input: expect.objectContaining({ csv: "uploads/3", zip: "uploads/2" }),
    });
  });

  it("locks Replace and Add while it checks", async () => {
    let answer: (state: AdminActionState<CardImportPreview>) => void = () => {};
    renderImport({
      checkCardImport: vi.fn(
        () => new Promise<AdminActionState<CardImportPreview>>((resolve) => (answer = resolve)),
      ),
    });
    await chooseAndCheck();

    await waitFor(() => expect(screen.getByRole("radio", { name: /^Replace/ })).toBeDisabled());
    answer({ status: "saved", value: PREVIEW });
    await waitFor(() => expect(screen.getByRole("radio", { name: /^Replace/ })).toBeEnabled());
  });

  it("imports in the mode the preview showed", async () => {
    const actions = renderImport({
      checkCardImport: answering<CardImportPreview>({
        status: "saved",
        value: { ...PREVIEW, mode: "replace" },
      }),
    });
    const user = await chooseAndCheck();
    await user.click(await screen.findByRole("button", { name: "Import" }));

    await screen.findByText("✓ IMPORTED");
    expect(actions.importCards).toHaveBeenCalledWith(expect.anything(), {
      input: expect.objectContaining({ mode: "replace" }),
    });
  });

  it("imports without a zip when there's none", async () => {
    const actions = renderImport();
    await chooseAndCheck({ csv: csvFile() });

    await screen.findByRole("button", { name: "Import" });
    expect(actions.createImportUpload).toHaveBeenCalledTimes(1);
    expect(actions.checkCardImport).toHaveBeenCalledWith(expect.anything(), {
      input: expect.objectContaining({ csv: "uploads/1", zip: null }),
    });
  });

  it("lists the problems where they are, and keeps Import off while there are any", async () => {
    renderImport({
      checkCardImport: answering<CardImportPreview>({
        status: "saved",
        value: {
          ...PREVIEW,
          problems: [
            { file: "csv", row: 4, column: "back", message: "has a $ with no closing $" },
            { file: "zip", row: null, column: null, message: "isn’t a zip file" },
          ],
        },
      }),
    });
    await chooseAndCheck();

    const heading = await screen.findByRole("heading", {
      name: "2 PROBLEMS · FIX THEM IN THE SPREADSHEET, THEN CHECK AGAIN",
    });
    const table = within(heading.parentElement as HTMLElement).getByRole("table");
    expect(
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.textContent),
    ).toEqual(["CSV · ROW 4 · BACKhas a $ with no closing $", "ZIPisn’t a zip file"]);
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
    expect(
      screen.getByText("Fix the problems first: nothing is imported while there are any."),
    ).toBeInTheDocument();
  });

  it("imports the checked files with what the preview was based on, then says what it did", async () => {
    const actions = renderImport();
    const user = await chooseAndCheck();
    await user.click(await screen.findByRole("button", { name: "Import" }));

    await screen.findByText("✓ IMPORTED");
    expect(actions.importCards).toHaveBeenCalledWith(expect.anything(), {
      input: {
        exam: "CE",
        subject: "MSTC",
        csv: "uploads/1",
        zip: "uploads/2",
        mode: "add",
        basedOn: BASED_ON,
      },
    });
    expect(screen.getByRole("list", { name: "Imported Topics" })).toHaveTextContent(
      "Simple Curve · new Topic, with a Hidden deck · 2 added",
    );
    expect(screen.getByRole("link", { name: "See MSTC’s Topics" })).toHaveAttribute(
      "href",
      "/admin/content?exam=ce&subject=mstc",
    );
  });

  it("checks the same files again in Replace, without uploading them again", async () => {
    const actions = renderImport({
      checkCardImport: answering<CardImportPreview>(
        { status: "saved", value: PREVIEW },
        { status: "saved", value: { ...PREVIEW, mode: "replace" } },
      ),
    });
    const user = await chooseAndCheck();
    await screen.findByRole("button", { name: "Import" });

    await user.click(screen.getByRole("radio", { name: /^Replace/ }));

    await waitFor(() => expect(actions.checkCardImport).toHaveBeenCalledTimes(2));
    expect(actions.checkCardImport).toHaveBeenLastCalledWith(expect.anything(), {
      input: expect.objectContaining({ csv: "uploads/1", zip: "uploads/2", mode: "replace" }),
    });
    expect(actions.createImportUpload).toHaveBeenCalledTimes(2);
  });

  it("refuses a file that isn't a CSV, or no CSV at all, before uploading anything", async () => {
    const actions = renderImport();
    const user = userEvent.setup({ applyAccept: false });
    await user.click(screen.getByRole("button", { name: "Check file" }));
    expect(screen.getByText("CHOOSE THE CSV FILE")).toBeInTheDocument();

    await user.upload(screen.getByLabelText("CSV FILE"), csvFile("cards.xlsx"));
    await user.click(screen.getByRole("button", { name: "Check file" }));

    expect(
      screen.getByText("CHOOSE A .CSV FILE (IN SHEETS OR EXCEL: DOWNLOAD AS CSV)"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("CSV FILE")).toHaveAttribute("aria-invalid", "true");
    expect(actions.createImportUpload).not.toHaveBeenCalled();
  });

  it("says so when an upload fails, and checks nothing", async () => {
    network.fail = true;
    const actions = renderImport();
    await chooseAndCheck();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "THE CSV DIDN’T UPLOAD · CHECK YOUR CONNECTION AND TRY AGAIN",
    );
    expect(actions.checkCardImport).not.toHaveBeenCalled();
  });

  it("asks for the files again when the server no longer has them", async () => {
    renderImport({
      checkCardImport: answering<CardImportPreview>({
        status: "refused",
        error: { kind: "invalid", fieldErrors: { csv: ["UPLOAD THE CSV FILE AGAIN"] } },
      }),
    });
    await chooseAndCheck();

    expect(await screen.findByText("UPLOAD THE CSV FILE AGAIN")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import" })).not.toBeInTheDocument();
  });

  it("explains a conflict, and checks the file again on request", async () => {
    const actions = renderImport({
      checkCardImport: answering<CardImportPreview>(
        { status: "saved", value: PREVIEW },
        { status: "saved", value: { ...PREVIEW, basedOn: "b".repeat(64) } },
      ),
      importCards: answering<CardImportResult>({
        status: "refused",
        error: { kind: "conflict", savedBy: null, savedAt: "2026-11-17T03:42:00.000Z" },
      }),
    });
    const user = await chooseAndCheck();
    await user.click(await screen.findByRole("button", { name: "Import" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "THE TOPICS OR CARDS CHANGED SINCE YOU CHECKED THE FILE · CHECK IT AGAIN",
    );
    await user.click(within(alert).getByRole("button", { name: "Check the file again" }));

    await waitFor(() => expect(actions.checkCardImport).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("says nothing was saved when the import breaks down", async () => {
    renderImport({ importCards: answering<CardImportResult>({ status: "failed" }) });
    const user = await chooseAndCheck();
    await user.click(await screen.findByRole("button", { name: "Import" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "COULDN’T IMPORT · NOTHING WAS SAVED · TRY AGAIN",
    );
  });

  it("refuses the server's formError, such as problems found on import", async () => {
    renderImport({
      importCards: answering<CardImportResult>({
        status: "refused",
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "FIX THE PROBLEMS IN THE FILE, THEN CHECK IT AGAIN",
        },
      }),
    });
    const user = await chooseAndCheck();
    await user.click(await screen.findByRole("button", { name: "Import" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "FIX THE PROBLEMS IN THE FILE, THEN CHECK IT AGAIN",
    );
  });
});
