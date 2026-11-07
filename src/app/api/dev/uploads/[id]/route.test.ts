import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StaffActor } from "@/services/admin.types";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import { createUpload } from "@/services/uploads";
import type { UploadContentType, UploadTicket } from "@/services/uploads.types";

import { imageBytes, textBytes } from "../../../../../../test/image-bytes";

// PUT and GET /api/dev/uploads/[id] (CONVENTIONS §2): the sample arm of the
// upload seam. PUT takes the file once, with the upload's one-time token, when
// it's the declared type and size and really is that image; GET serves it.
// Outside sample mode, both answer 404.
const mode = vi.hoisted(() => ({ current: "sample" as "sample" | "closed" }));
vi.mock("@/lib/admin/mode", () => ({
  get adminMode() {
    return mode.current;
  },
}));

const EDITOR: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};
const ORIGIN = "http://localhost:3000";

async function ticketFor(contentType: UploadContentType = "image/png", size = 64) {
  const result = await createUpload(EDITOR, { purpose: "product-photo", contentType, size });
  if (!result.ok) throw new Error("refused");
  return result.value;
}

const idOf = (ticket: UploadTicket) => ticket.publicUrl.split("/").at(-1) ?? "";
const context = (ticket: UploadTicket) => ({ params: Promise.resolve({ id: idOf(ticket) }) });

function put(url: string, body: Uint8Array, contentType: string) {
  return new Request(new URL(url, ORIGIN), {
    method: "PUT",
    headers: { "content-type": contentType, "content-length": String(body.byteLength) },
    body,
  });
}

const get = (ticket: UploadTicket) => new Request(new URL(ticket.publicUrl, ORIGIN));

async function send(ticket: UploadTicket, body: Uint8Array, contentType: string, url?: string) {
  const { PUT } = await import("./route");
  return PUT(put(url ?? ticket.uploadUrl, body, contentType), context(ticket));
}

/** Whether a file is stored for the upload. */
const stored = (ticket: UploadTicket) => getSampleStore().uploads[idOf(ticket)]?.bytes != null;

describe("/api/dev/uploads/[id]", () => {
  beforeEach(() => {
    mode.current = "sample";
    resetSampleStore();
  });

  it("stores a file PUT with the upload's token, and GET serves it with its type", async () => {
    const ticket = await ticketFor("image/webp");
    const bytes = imageBytes("image/webp");

    const response = await send(ticket, bytes, "image/webp");

    expect(response.status).toBe(201);
    const { GET } = await import("./route");
    const served = await GET(get(ticket), context(ticket));
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/webp");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(bytes);
  });

  it("refuses a second PUT to the same URL, keeping the first file", async () => {
    const ticket = await ticketFor();
    const first = imageBytes("image/png");
    await send(ticket, first, "image/png");

    const second = imageBytes("image/png");
    second[63] = 1;
    const response = await send(ticket, second, "image/png");

    expect(response.status).toBe(409);
    expect(getSampleStore().uploads[idOf(ticket)]?.bytes).toEqual(first);
  });

  it("refuses a PUT without the upload's token", async () => {
    const ticket = await ticketFor();
    const bytes = imageBytes("image/png");

    expect((await send(ticket, bytes, "image/png", ticket.publicUrl)).status).toBe(403);
    expect(
      (await send(ticket, bytes, "image/png", `${ticket.publicUrl}?token=guessed`)).status,
    ).toBe(403);
    expect(stored(ticket)).toBe(false);
  });

  it.each([
    ["a type other than the one declared", imageBytes("image/jpeg"), "image/jpeg", 415],
    ["a smaller file than declared", imageBytes("image/png", 32), "image/png", 400],
    ["a larger file than declared", imageBytes("image/png", 128), "image/png", 400],
    ["a file that isn't really a PNG", textBytes(), "image/png", 415],
    ["a JPEG sent as a PNG", imageBytes("image/jpeg"), "image/png", 415],
  ])("refuses %s, storing nothing, and the URL still works", async (_, body, type, status) => {
    const ticket = await ticketFor("image/png", 64);

    expect((await send(ticket, body, type)).status).toBe(status);
    expect(stored(ticket)).toBe(false);

    expect((await send(ticket, imageBytes("image/png"), "image/png")).status).toBe(201);
  });

  it("refuses a PUT that doesn't declare its length, before reading it", async () => {
    const ticket = await ticketFor();
    const { PUT } = await import("./route");
    const request = new Request(new URL(ticket.uploadUrl, ORIGIN), {
      method: "PUT",
      headers: { "content-type": "image/png" },
      body: imageBytes("image/png"),
    });
    request.headers.delete("content-length");

    expect((await PUT(request, context(ticket))).status).toBe(400);
    expect(stored(ticket)).toBe(false);
  });

  it("answers 404 to an unknown upload, and GET to one not uploaded yet", async () => {
    const ticket = await ticketFor();
    const { GET, PUT } = await import("./route");
    const unknown = { params: Promise.resolve({ id: "no-such-upload" }) };

    expect((await GET(get(ticket), context(ticket))).status).toBe(404);
    expect((await GET(get(ticket), unknown)).status).toBe(404);
    expect(
      (await PUT(put(ticket.uploadUrl, imageBytes("image/png"), "image/png"), unknown)).status,
    ).toBe(404);
  });

  it("answers 404 to both GET and PUT outside sample mode", async () => {
    const ticket = await ticketFor();
    await send(ticket, imageBytes("image/png"), "image/png");
    const other = await ticketFor();
    mode.current = "closed";
    const { GET } = await import("./route");

    expect((await GET(get(ticket), context(ticket))).status).toBe(404);
    expect((await send(other, imageBytes("image/png"), "image/png")).status).toBe(404);
    expect(stored(other)).toBe(false);
  });
});
