import { beforeEach, describe, expect, it } from "vitest";

import type { StaffActor } from "@/services/admin.types";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import {
  createContentUpload,
  readSampleUpload,
  receiveSampleUpload,
  sampleContentFiles,
} from "@/services/uploads.mock";
import type { ContentUploadTicket } from "@/services/uploads.types";

// The upload seam's private uploads in the sample data (Phase 3, ticket 06):
// an import's CSV and zip go to a one-time URL like a photo, but the upload
// route never serves them; only the server reads them back, by path and
// purpose. The Storage arm's are in uploads.storage.test.ts.

const EDITOR: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};

const CSV = new TextEncoder().encode("topic,front,back,note,image\nT,f,b,,\n");
const ZIP = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...new Array<number>(18).fill(0)]);

function urlParts(ticket: ContentUploadTicket) {
  const url = new URL(ticket.uploadUrl, "http://localhost");
  return { id: url.pathname.split("/").at(-1) ?? "", token: url.searchParams.get("token") ?? "" };
}

async function send(ticket: ContentUploadTicket, bytes: Uint8Array, contentType: string) {
  const { id, token } = urlParts(ticket);
  return receiveSampleUpload(id, token, {
    contentType,
    contentLength: bytes.byteLength,
    body: async () => bytes,
  });
}

async function upload(purpose: "import-csv" | "import-zip", bytes: Uint8Array) {
  const created = await createContentUpload(EDITOR, { purpose, size: bytes.byteLength });
  if (!created.ok) throw new Error(JSON.stringify(created.error));
  return created.value;
}

beforeEach(() => {
  resetSampleStore();
});

describe("createContentUpload (sample data)", () => {
  it.each([
    ["import-csv", CSV, "text/csv"],
    ["import-zip", ZIP, "application/zip"],
  ] as const)(
    "takes a %s once at its one-time URL, and the server reads it back by path",
    async (purpose, bytes, contentType) => {
      const ticket = await upload(purpose, bytes);

      expect(ticket).toEqual({
        uploadUrl: expect.stringMatching(/^\/api\/dev\/uploads\/[0-9a-f-]+\?token=/),
        path: expect.stringMatching(/^uploads\/[0-9a-f-]+$/),
        contentType,
      });
      expect(await sampleContentFiles.readUpload(ticket.path, purpose)).toBeNull();
      expect(await send(ticket, bytes, contentType)).toBe("stored");
      expect(await sampleContentFiles.readUpload(ticket.path, purpose)).toEqual(bytes);
      expect(await send(ticket, bytes, contentType)).toBe("already-uploaded");
    },
  );

  it("never serves a private upload at the upload route", async () => {
    const ticket = await upload("import-csv", CSV);
    await send(ticket, CSV, "text/csv");

    expect(readSampleUpload(urlParts(ticket).id)).toBeNull();
  });

  it("reads an upload only for its own purpose", async () => {
    const ticket = await upload("import-csv", CSV);
    await send(ticket, CSV, "text/csv");

    expect(await sampleContentFiles.readUpload(ticket.path, "import-zip")).toBeNull();
    expect(await sampleContentFiles.readUpload("uploads/not-one", "import-csv")).toBeNull();
    expect(await sampleContentFiles.readUpload("decks/x/y.png", "import-csv")).toBeNull();
  });

  it("refuses a zip that doesn't start as a zip does, or a file sent as another type", async () => {
    const ticket = await upload("import-zip", CSV);

    expect(await send(ticket, CSV, "application/zip")).toBe("not-an-image");
    expect(await send(ticket, CSV, "text/csv")).toBe("wrong-type");
  });

  it.each([
    ["signed out", null, { purpose: "import-csv", size: 10 }, "forbidden"],
    ["a CSV over 10 MB", EDITOR, { purpose: "import-csv", size: 10 * 1024 * 1024 + 1 }, "invalid"],
    [
      "a zip over 200 MB",
      EDITOR,
      { purpose: "import-zip", size: 200 * 1024 * 1024 + 1 },
      "invalid",
    ],
    ["an empty file", EDITOR, { purpose: "import-csv", size: 0 }, "invalid"],
    ["a catalogue photo's purpose", EDITOR, { purpose: "product-photo", size: 10 }, "invalid"],
  ] as const)("refuses %s", async (_, actor, request, kind) => {
    expect(await createContentUpload(actor, request as never)).toMatchObject({
      ok: false,
      error: { kind },
    });
  });

  it("takes a CSV of exactly 10 MB and a zip of exactly 200 MB", async () => {
    const csv = await createContentUpload(EDITOR, {
      purpose: "import-csv",
      size: 10 * 1024 * 1024,
    });
    const zip = await createContentUpload(EDITOR, {
      purpose: "import-zip",
      size: 200 * 1024 * 1024,
    });

    expect([csv.ok, zip.ok]).toEqual([true, true]);
  });
});

describe("a card's back image (ticket 07, sample data)", () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  async function uploadImage(bytes: Uint8Array, contentType = "image/png" as const) {
    const created = await createContentUpload(EDITOR, {
      purpose: "card-image",
      contentType,
      size: bytes.byteLength,
    });
    if (!created.ok) throw new Error(JSON.stringify(created.error));
    return created.value;
  }

  it("takes a PNG once at its one-time URL, and the server reads it back by path", async () => {
    const ticket = await uploadImage(PNG);

    expect(ticket).toEqual({
      uploadUrl: expect.stringMatching(/^\/api\/dev\/uploads\/[0-9a-f-]+\?token=/),
      path: expect.stringMatching(/^uploads\/[0-9a-f-]+$/),
      contentType: "image/png",
    });
    expect(await sampleContentFiles.readUpload(ticket.path, "card-image")).toBeNull();
    expect(await send(ticket, PNG, "image/png")).toBe("stored");
    expect(await sampleContentFiles.readUpload(ticket.path, "card-image")).toEqual(PNG);
    expect(await sampleContentFiles.readUpload(ticket.path, "import-csv")).toBeNull();
    // Private, like an import's files: the upload route never serves it.
    expect(readSampleUpload(urlParts(ticket).id)).toBeNull();
  });

  it("refuses a file that isn't really the image it says", async () => {
    const ticket = await uploadImage(CSV);

    expect(await send(ticket, CSV, "image/png")).toBe("not-an-image");
  });

  it.each([
    ["a GIF", { contentType: "image/gif", size: 10 }],
    ["an image over 5 MB", { contentType: "image/png", size: 5 * 1024 * 1024 + 1 }],
    ["an empty image", { contentType: "image/png", size: 0 }],
  ])("refuses %s before handing out a URL", async (_, file) => {
    expect(
      await createContentUpload(EDITOR, { purpose: "card-image", ...file } as never),
    ).toMatchObject({ ok: false, error: { kind: "invalid" } });
    expect(getSampleStore().uploads).toEqual({});
  });

  it("takes an image of exactly 5 MB", async () => {
    const created = await createContentUpload(EDITOR, {
      purpose: "card-image",
      contentType: "image/webp",
      size: 5 * 1024 * 1024,
    });
    expect(created).toMatchObject({ ok: true, value: { contentType: "image/webp" } });
  });
});

describe("sampleContentFiles", () => {
  it("reads back a stored card image with its type, and nothing else", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    await sampleContentFiles.put("decks/d/a.png", png, "image/png");

    expect(await sampleContentFiles.read("decks/d/a.png")).toEqual({
      contentType: "image/png",
      bytes: png,
    });
    expect(await sampleContentFiles.read("decks/d/missing.png")).toBeNull();
  });

  it("stores card images by path, and deletes them and the import's uploads", async () => {
    const ticket = await upload("import-csv", CSV);
    await send(ticket, CSV, "text/csv");
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    await sampleContentFiles.put("decks/d/a.png", png, "image/png");
    expect(getSampleStore().contentFiles["decks/d/a.png"]).toEqual({
      contentType: "image/png",
      bytes: png,
    });

    await sampleContentFiles.remove(["decks/d/a.png", ticket.path]);
    expect(getSampleStore().contentFiles).toEqual({});
    expect(await sampleContentFiles.readUpload(ticket.path, "import-csv")).toBeNull();
  });
});
