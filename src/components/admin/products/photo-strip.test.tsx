import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type {
  AdminProduct,
  AdminProductRow,
  DeletedProduct,
  ProductDeletePreview,
} from "@/services/admin.types";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import type { UploadTicket } from "@/services/uploads.types";

import { EditProduct, NewProduct, type ProductEditorActions } from "./product-editor";

// The editor's photo strip (BUILD-MAP §3.3, "PHOTOS · FIRST IS THE COVER";
// spec, Phase 2 → Products: Photos), in the Product editor, with stub Server
// Actions. The browser's PUT to the upload URL is the network boundary, so
// put-file is replaced with uploads the test finishes or fails by hand.
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  unstable_rethrow: () => {},
}));

const network = vi.hoisted(() => ({
  sent: [] as { url: string; name: string; finish: () => void; fail: () => void }[],
  sizes: new Map<string, { width: number; height: number }>(),
}));
vi.mock("./put-file", () => ({
  putFile: (url: string, file: File, onProgress: (sent: number) => void) =>
    new Promise<void>((resolve, reject) => {
      onProgress(0.4);
      network.sent.push({ url, name: file.name, finish: resolve, fail: reject });
    }),
  measureImage: async (file: File) => network.sizes.get(file.name) ?? null,
}));

const OPENED_AT = "2026-10-22T03:42:00.000Z";
const POSTERS = (() => {
  const found = CATALOGUE_SEED.products.find((p) => p.id === "prd-005");
  if (!found) throw new Error("No Posters");
  return structuredClone(found);
})();
const [FIRST = "", SECOND = ""] = POSTERS.photos.map((photo) => photo.src);
const PREVIEW: ProductDeletePreview = { reviews: 3, photos: 2, faqQuotes: 1 };

type Submission = { input: unknown; expected?: { savedAt: string } };

/** A stub Server Action that answers each call in turn. */
function answering<T>(...answers: AdminActionState<T>[]) {
  return vi.fn(async (_previous: AdminActionState<T>, _submission: Submission) => {
    const next = answers.shift();
    if (!next) throw new Error("no more answers");
    return next;
  });
}

/** createUpload answering with a new ticket each time: uploads/1, uploads/2… */
function tickets() {
  let count = 0;
  return vi.fn(async (): Promise<AdminActionState<UploadTicket>> => {
    count += 1;
    return {
      status: "saved",
      value: {
        uploadUrl: `/api/dev/uploads/${count}?token=t${count}`,
        path: `uploads/${count}`,
        publicUrl: `/api/dev/uploads/${count}`,
      },
    };
  });
}

function actionsWith(actions: Partial<ProductEditorActions> = {}): ProductEditorActions {
  return {
    save: answering<AdminProduct>(),
    add: answering<AdminProduct>(),
    remove: answering<DeletedProduct>(),
    countDelete: vi.fn(async () => ({ status: "saved" as const, value: PREVIEW })),
    setFlag: answering<AdminProductRow>(),
    createUpload: tickets(),
    ...actions,
  };
}

function renderPosters(actions: Partial<ProductEditorActions> = {}) {
  const user = userEvent.setup({ applyAccept: false });
  const all = actionsWith(actions);
  render(
    <EditProduct
      opened={{ product: POSTERS, stamp: { savedAt: OPENED_AT, savedBy: null }, reviewCount: 3 }}
      exams={CATALOGUE_SEED.exams}
      deletePreview={PREVIEW}
      listQuery={{ q: null, exam: null, missing: false }}
      actions={all}
    />,
  );
  return { user, actions: all };
}

const png = (name: string, size = 2048) =>
  new File([new Uint8Array(size)], name, { type: "image/png" });

const strip = () => within(screen.getByRole("list", { name: "PHOTOS · FIRST IS THE COVER" }));
const tiles = () => strip().getAllByRole("listitem").slice(0, -1);
const tileText = () => tiles().map((tile) => tile.textContent);
const addPhotos = () => screen.getByLabelText("Add photos");
const saveState = () => screen.getByRole("status");

/** Checks the photos the last save sent. */
function expectSavedPhotos(save: ReturnType<typeof vi.fn>, photos: string[]) {
  expect(save).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({ input: expect.objectContaining({ photos }) }),
  );
}

beforeEach(() => {
  network.sent = [];
  network.sizes.clear();
  URL.createObjectURL = vi.fn((file: Blob) => `blob:${(file as File).name}`);
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PhotoStrip: what it shows", () => {
  it("shows every photo, the first as the COVER, a + tile and the caption", () => {
    renderPosters();

    expect(tileText()).toEqual(["Photo 1COVER‹›×", "Photo 2‹›×"]);
    expect(addPhotos()).toHaveAttribute("type", "file");
    expect(screen.getByText("2 photos · drag to reorder")).toBeInTheDocument();
  });

  it("says what works best for a new Product with no photos", () => {
    render(<NewProduct exams={CATALOGUE_SEED.exams} actions={actionsWith()} onAdded={() => {}} />);

    expect(tiles()).toEqual([]);
    expect(
      screen.getByText("Add photos. Square images work best, at least 1000 × 1000."),
    ).toBeInTheDocument();
  });
});

describe("PhotoStrip: uploading", () => {
  it("uploads chosen files one by one with progress; they show as unsaved, and Save sends them", async () => {
    const save = answering<AdminProduct>({ status: "refused", error: { kind: "not-found" } });
    const { user, actions } = renderPosters({ save });

    await user.upload(addPhotos(), [png("front.png"), png("back.png")]);

    await waitFor(() => expect(network.sent).toHaveLength(1));
    expect(screen.getByRole("progressbar", { name: "Uploading front.png" })).toHaveAttribute(
      "aria-valuenow",
      "40",
    );
    expect(
      within(screen.getByRole("list", { name: "Uploads" })).getByText("WAITING"),
    ).toBeVisible();
    expect(screen.getByText("4 photos · drag to reorder")).toBeInTheDocument();
    expect(actions.createUpload).toHaveBeenCalledTimes(1);
    expect(actions.createUpload).toHaveBeenCalledWith(expect.anything(), {
      input: { contentType: "image/png", size: 2048 },
    });

    network.sent[0]?.finish();
    await waitFor(() => expect(network.sent).toHaveLength(2));
    expect(network.sent.map((sent) => [sent.url, sent.name])).toEqual([
      ["/api/dev/uploads/1?token=t1", "front.png"],
      ["/api/dev/uploads/2?token=t2", "back.png"],
    ]);
    network.sent[1]?.finish();
    await waitFor(() => expect(screen.queryByRole("list", { name: "Uploads" })).toBeNull());

    expect(tileText()).toEqual([
      "Photo 1COVER‹›×",
      "Photo 2‹›×",
      "Photo 3: front.pngUNSAVED‹›×",
      "Photo 4: back.pngUNSAVED‹›×",
    ]);
    expect(saveState()).toHaveTextContent("UNSAVED CHANGES");

    await user.click(screen.getByRole("button", { name: "Save product" }));
    expectSavedPhotos(save, [FIRST, SECOND, "uploads/1", "uploads/2"]);
  });

  it("adds files dropped on the strip", async () => {
    renderPosters();

    fireEvent.drop(screen.getByText("PHOTOS · FIRST IS THE COVER"), {
      dataTransfer: { files: [png("dropped.png")], types: ["Files"] },
    });

    await waitFor(() => expect(network.sent.map((sent) => sent.name)).toEqual(["dropped.png"]));
    expect(tiles()).toHaveLength(3);
  });

  it("refuses a file that isn't a JPEG, PNG or WebP, or is over 10 MB, before uploading, naming it", async () => {
    const { user, actions } = renderPosters();
    const gif = new File(["GIF89a"], "spinner.gif", { type: "image/gif" });
    const huge = png("huge.png");
    Object.defineProperty(huge, "size", { value: 12 * 1024 * 1024 });

    await user.upload(addPhotos(), [gif, huge]);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("“spinner.gif” isn’t a JPEG, PNG or WebP image.");
    expect(alert).toHaveTextContent("“huge.png” is over 10 MB.");
    expect(tiles()).toHaveLength(2);
    expect(actions.createUpload).not.toHaveBeenCalled();
  });

  it("warns of a photo below 1000 × 1000 or not square, and still saves it", async () => {
    network.sizes.set("small.png", { width: 900, height: 900 });
    network.sizes.set("wide.png", { width: 1200, height: 800 });
    const save = answering<AdminProduct>({ status: "refused", error: { kind: "not-found" } });
    const { user } = renderPosters({ save });

    await user.upload(addPhotos(), [png("small.png"), png("wide.png")]);
    await waitFor(() => expect(network.sent).toHaveLength(1));
    network.sent[0]?.finish();
    await waitFor(() => expect(network.sent).toHaveLength(2));
    network.sent[1]?.finish();

    const uploads = within(await screen.findByRole("list", { name: "Uploads" }));
    expect(
      await uploads.findByText("900 × 900 · BELOW 1000 × 1000 · IT CAN STILL BE SAVED"),
    ).toBeVisible();
    expect(
      uploads.getByText("1200 × 800 · BELOW 1000 × 1000 · NOT SQUARE · IT CAN STILL BE SAVED"),
    ).toBeVisible();
    expect(strip().getByText("Warning: 900 × 900 · BELOW 1000 × 1000")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save product" }));
    expectSavedPhotos(save, [FIRST, SECOND, "uploads/1", "uploads/2"]);
  });

  it("shows Upload failed · Try again on a file whose upload broke, the others going on; Try again works", async () => {
    const { user, actions } = renderPosters();

    await user.upload(addPhotos(), [png("front.png"), png("back.png")]);
    await waitFor(() => expect(network.sent).toHaveLength(1));
    network.sent[0]?.fail();
    await waitFor(() => expect(network.sent).toHaveLength(2));
    network.sent[1]?.finish();

    const uploads = within(await screen.findByRole("list", { name: "Uploads" }));
    await waitFor(() => expect(uploads.getAllByRole("listitem")).toHaveLength(1));
    expect(uploads.getByRole("listitem")).toHaveTextContent("front.pngUpload failed · Try again");
    expect(tileText()[3]).toBe("Photo 4: back.pngUNSAVED‹›×");

    await user.click(uploads.getByRole("button", { name: "Try again: front.png" }));
    await waitFor(() => expect(network.sent).toHaveLength(3));
    expect(actions.createUpload).toHaveBeenCalledTimes(3);
    network.sent[2]?.finish();
    await waitFor(() => expect(screen.queryByRole("list", { name: "Uploads" })).toBeNull());
    expect(tileText()[2]).toBe("Photo 3: front.pngUNSAVED‹›×");
  });

  it("shows the server's reason when it won't give an upload URL", async () => {
    const createUpload = answering<UploadTicket>({
      status: "refused",
      error: { kind: "invalid", fieldErrors: { contentType: ["USE A JPEG, PNG OR WEBP IMAGE"] } },
    });
    const { user } = renderPosters({ createUpload });

    await user.upload(addPhotos(), [png("front.png")]);

    // Trying again won't help, so the server's reason shows instead.
    expect(await screen.findByText("Upload refused · USE A JPEG, PNG OR WEBP IMAGE")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Try again/ })).toBeNull();
    expect(screen.getByText("front.png: upload failed.")).toBeInTheDocument();
    expect(network.sent).toEqual([]);
  });

  it("won't save while an upload is on its way: Wait for uploads to finish.", async () => {
    const save = answering<AdminProduct>({ status: "refused", error: { kind: "not-found" } });
    const { user } = renderPosters({ save });

    await user.upload(addPhotos(), [png("front.png")]);
    await waitFor(() => expect(network.sent).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: "Save product" }));

    expect(saveState()).toHaveTextContent("Wait for uploads to finish.");
    expect(save).not.toHaveBeenCalled();

    network.sent[0]?.finish();
    await waitFor(() => expect(saveState()).toHaveTextContent("UNSAVED CHANGES"));
    await user.click(screen.getByRole("button", { name: "Save product" }));
    expectSavedPhotos(save, [FIRST, SECOND, "uploads/1"]);
  });

  it("won't save with a failed upload until it's tried again or removed", async () => {
    const save = answering<AdminProduct>({ status: "refused", error: { kind: "not-found" } });
    const { user } = renderPosters({ save });

    await user.upload(addPhotos(), [png("front.png")]);
    await waitFor(() => expect(network.sent).toHaveLength(1));
    network.sent[0]?.fail();
    await screen.findByText(/Upload failed/);
    await user.click(screen.getByRole("button", { name: "Save product" }));

    expect(saveState()).toHaveTextContent("An upload failed. Try it again, or remove it.");
    expect(save).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remove photo 3" }));
    await user.click(screen.getByRole("button", { name: "Save product" }));
    expectSavedPhotos(save, [FIRST, SECOND]);
  });

  it("keeps the unsaved photos in the strip when the save is a conflict", async () => {
    const save = answering<AdminProduct>({
      status: "refused",
      error: { kind: "conflict", savedBy: "Angel Rose L. Lepaña", savedAt: OPENED_AT },
    });
    const { user } = renderPosters({ save });
    await user.upload(addPhotos(), [png("front.png")]);
    await waitFor(() => expect(network.sent).toHaveLength(1));
    network.sent[0]?.finish();
    await screen.findByText("UNSAVED");

    await user.click(screen.getByRole("button", { name: "Save product" }));

    expect(await screen.findByText(/Angel Rose L\. Lepaña saved this Product/)).toBeVisible();
    expect(tileText()[2]).toBe("Photo 3: front.pngUNSAVED‹›×");
  });

  it("shows the last save's message about the photos", async () => {
    const save = answering<AdminProduct>({
      status: "refused",
      error: {
        kind: "invalid",
        fieldErrors: { photos: ["A PHOTO ISN’T UPLOADED · ADD IT AGAIN"] },
      },
    });
    const { user } = renderPosters({ save });

    await user.click(screen.getByRole("button", { name: "Save product" }));

    expect(await screen.findByText("A PHOTO ISN’T UPLOADED · ADD IT AGAIN")).toBeVisible();
  });
});

describe("PhotoStrip: order and removing", () => {
  it("moves a photo with Move left and Move right; the first is the COVER, and Save sends the order", async () => {
    const save = answering<AdminProduct>({ status: "refused", error: { kind: "not-found" } });
    const { user } = renderPosters({ save });

    await user.click(screen.getByRole("button", { name: "Move left, photo 2" }));

    expect(tileText()).toEqual(["Photo 1COVER‹›×", "Photo 2‹›×"]);
    await user.click(screen.getByRole("button", { name: "Save product" }));
    expectSavedPhotos(save, [SECOND, FIRST]);
    expect(screen.getByText("Moved to first: it's the cover.")).toBeInTheDocument();
  });

  it("can't move the first photo left or the last right, and keeps those buttons focusable", async () => {
    const { user } = renderPosters();
    const left = screen.getByRole("button", { name: "Move left, photo 1" });

    await user.click(left);

    expect(left).toHaveAttribute("aria-disabled", "true");
    expect(left).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Move right, photo 2" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent("UP TO DATE");
  });

  it("moves a photo dragged onto another", async () => {
    const save = answering<AdminProduct>({ status: "refused", error: { kind: "not-found" } });
    const { user } = renderPosters({ save });
    const [first, second] = tiles();
    if (!first || !second) throw new Error("two tiles");
    const dataTransfer = { setData: vi.fn(), types: ["text/plain"], files: [] };

    fireEvent.dragStart(second, { dataTransfer });
    fireEvent.dragOver(first, { dataTransfer });
    fireEvent.drop(first, { dataTransfer });

    await user.click(screen.getByRole("button", { name: "Save product" }));
    expectSavedPhotos(save, [SECOND, FIRST]);
  });

  it("removes a photo, and the next becomes the cover", async () => {
    const save = answering<AdminProduct>({ status: "refused", error: { kind: "not-found" } });
    const { user } = renderPosters({ save });

    await user.click(screen.getByRole("button", { name: "Remove photo 1" }));

    expect(tileText()).toEqual(["Photo 1COVER‹›×"]);
    expect(screen.getByText("1 photo · drag to reorder")).toBeInTheDocument();
    // Focus moves to the Remove button now in its place, not to the page.
    expect(screen.getByRole("button", { name: "Remove photo 1" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Save product" }));
    expectSavedPhotos(save, [SECOND]);
  });

  it("moves focus to Add photos when the last photo is removed", async () => {
    const { user } = renderPosters();

    await user.click(screen.getByRole("button", { name: "Remove photo 2" }));
    expect(screen.getByRole("button", { name: "Remove photo 1" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Remove photo 1" }));

    expect(addPhotos()).toHaveFocus();
  });

  it("removes an upload on its way, which then never joins the strip", async () => {
    const { user } = renderPosters();
    await user.upload(addPhotos(), [png("front.png")]);
    await waitFor(() => expect(network.sent).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "Remove photo 3" }));
    network.sent[0]?.finish();

    await waitFor(() => expect(tiles()).toHaveLength(2));
    expect(screen.getByRole("status")).toHaveTextContent("UP TO DATE");
  });
});
