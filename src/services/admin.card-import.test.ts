import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CARD_IMPORT_TEMPLATE_CSV, importExampleZip } from "@/lib/content-import/template";
import type { ConfirmImportInput } from "@/services/admin.schema";
import type { ImportPreview } from "@/services/admin.types";
import { sampleTopicId } from "@/services/mock/content";

import { ADMIN_ARMS } from "../../test/admin-arms";
import { sampleActor } from "../../test/admin-inputs";
import { importCsv, importZip } from "../../test/import-files";
import { imageBytes, textBytes } from "../../test/image-bytes";

// The Admin seam's card import (Phase 3, ticket 06; spec, Phase 3 →
// Spreadsheet import; stories 118, 120–124, 133p), run against every arm. The
// sample data's CE MSTC Topics: Simple Curves (a Visible deck, no cards),
// Spiral Curves (a Visible deck), Surveying (empty) and Algebra (a Hidden
// deck); PSAD has none.

const EDITOR = sampleActor("editor");
const PNG = imageBytes("image/png", 80);
const JPEG = imageBytes("image/jpeg", 90);
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const SIMPLE_CURVES = sampleTopicId("CE", "MSTC", "Simple Curves");
const SURVEYING = sampleTopicId("CE", "MSTC", "Surveying");

const MSTC = { exam: "ce", subject: "mstc", mode: "add" } as const;

describe.each(ADMIN_ARMS)("Admin seam: card import ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    await arm.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** MSTC's Topics, in order: each one's name and what its deck is. */
  async function mstcTopics() {
    const list = await seam.listTopicsForAdmin(EDITOR, "CE", "MSTC");
    return list?.topics.map((topic) => [topic.name, topic.content.deck]);
  }

  /** Uploads the files and checks them, as "Check file" does. */
  async function check(
    rows: string[],
    options: { zip?: Uint8Array | null; mode?: "replace" | "add"; subject?: string } = {},
  ) {
    const paths = await arm.uploadImport({ csv: importCsv(rows), zip: options.zip ?? null });
    const input = {
      ...MSTC,
      subject: options.subject ?? MSTC.subject,
      mode: options.mode ?? MSTC.mode,
      ...paths,
    };
    const planned = await seam.planCardImport(EDITOR, input);
    if (!planned.ok) throw new Error(`refused: ${JSON.stringify(planned.error)}`);
    return { input, preview: planned.value };
  }

  /** Checks the files, then imports them, as "Import" does. */
  async function importRows(
    rows: string[],
    options: { zip?: Uint8Array | null; mode?: "replace" | "add"; subject?: string } = {},
  ) {
    const { input, preview } = await check(rows, options);
    const confirmed = await seam.confirmCardImport(EDITOR, { ...input, basedOn: preview.basedOn });
    if (!confirmed.ok) throw new Error(`refused: ${JSON.stringify(confirmed.error)}`);
    return confirmed;
  }

  const ROWS = [
    "Simple Curves,Degree of curve,$D = \\dfrac{1145.916}{R}$,Arc basis,",
    "Highways,Superelevation,$e + f = \\dfrac{v^2}{gR}$,,curve.png",
    "Simple Curve,Length of curve,$L_c = \\dfrac{20I}{D}$,,",
    "Highways,Stopping sight distance,Reaction plus braking distance,,images/brake.jpg",
  ];
  const ZIP = () => importZip({ "curve.png": PNG, "images/brake.jpg": JPEG });

  describe("planCardImport", () => {
    it("previews each Topic with its counts and deck, a rename hint, and saves nothing", async () => {
      const before = await mstcTopics();
      const { preview } = await check(ROWS, { zip: ZIP() });

      expect(preview).toEqual({
        exam: { code: "CE", name: "Civil Engineering" },
        subject: { code: "MSTC", name: "Mathematics, Surveying & Transportation Engineering" },
        mode: "add",
        topics: [
          {
            name: "Simple Curves",
            topicId: SIMPLE_CURVES,
            similarTo: null,
            content: "visible",
            mode: "add",
            counts: { add: 1, replace: 0, keep: 0, remove: 0 },
          },
          {
            name: "Highways",
            topicId: null,
            similarTo: null,
            content: "new",
            mode: "add",
            counts: { add: 2, replace: 0, keep: 0, remove: 0 },
          },
          {
            name: "Simple Curve",
            topicId: null,
            similarTo: "Simple Curves",
            content: "new",
            mode: "add",
            counts: { add: 1, replace: 0, keep: 0, remove: 0 },
          },
        ],
        problems: [],
        basedOn: expect.stringMatching(/^[0-9a-f]{64}$/),
      } satisfies ImportPreview);
      expect(await mstcTopics()).toEqual(before);
      expect(await arm.cards()).toEqual([]);
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("reports each row's problems with its row and column", async () => {
      const { preview } = await check(
        ["T,Half,$\\frac{1}{$,,", "T,,b,,", "T,Price,It costs \\$5,,", "T,Beam,b,,beam.png"],
        { zip: ZIP() },
      );

      expect(preview.problems).toEqual([
        {
          file: "csv",
          row: 2,
          column: "back",
          message:
            "has a formula that won’t render, “\\frac{1}{”: Unexpected end of input in a macro argument, expected '}'",
        },
        { file: "csv", row: 3, column: "front", message: "is blank" },
        { file: "csv", row: 5, column: "image", message: "“beam.png” isn’t in the zip" },
      ]);
    });

    it("reports a CSV with a missing header, naming the column", async () => {
      const paths = await arm.uploadImport({ csv: importCsv(["T,f,b,"], "topic,front,back,note") });
      const planned = await seam.planCardImport(EDITOR, { ...MSTC, ...paths });

      expect(planned.ok && planned.value.problems).toEqual([
        { file: "csv", row: 1, column: "image", message: "is missing from the header row" },
      ]);
    });

    it("reports a file that isn't a CSV, and a zip that isn't a zip", async () => {
      const paths = await arm.uploadImport({
        csv: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0xfe, 0x00]),
        zip: new Uint8Array([0x50, 0x4b, 0x01, 0x02, 0x03]),
      });
      const planned = await seam.planCardImport(EDITOR, { ...MSTC, ...paths });

      expect(planned.ok && planned.value.problems).toEqual([
        { file: "csv", row: null, column: null, message: "isn’t a CSV file saved as UTF-8 text" },
        { file: "zip", row: null, column: null, message: "isn’t a zip file" },
      ]);
    });

    it("reports a zip with a file outside its folder, which it refuses rather than skips", async () => {
      const { preview } = await check(["T,f,b,,x.png"], {
        zip: importZip({ "x.png": PNG, "../x.png": PNG }),
      });

      expect(preview.problems).toEqual([
        {
          file: "zip",
          row: null,
          column: null,
          message: "has files outside its folder, which isn’t allowed: ../x.png",
        },
      ]);
    });

    it("refuses files that haven't been uploaded yet", async () => {
      const paths = await arm.uploadImport({
        csv: importCsv(["T,f,b,,"]),
        zip: ZIP(),
        send: false,
      });

      expect(await seam.planCardImport(EDITOR, { ...MSTC, ...paths })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {
            csv: ["UPLOAD THE CSV FILE AGAIN"],
            zip: ["UPLOAD THE ZIP OF IMAGES AGAIN"],
          },
        },
      });
    });

    it("refuses a path that isn't an import's upload, such as a photo's", async () => {
      const photo = await arm.uploadPhoto();

      expect(
        await seam.planCardImport(EDITOR, { ...MSTC, csv: photo.path, zip: null }),
      ).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { csv: expect.any(Array) } },
      });
    });

    it("answers not found for a Subject that isn't in the catalogue", async () => {
      const paths = await arm.uploadImport({ csv: importCsv(["T,f,b,,"]) });

      expect(await seam.planCardImport(EDITOR, { ...MSTC, subject: "zzz", ...paths })).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });

    it("refuses a mode that isn't Replace or Add", async () => {
      const paths = await arm.uploadImport({ csv: importCsv(["T,f,b,,"]) });

      expect(
        // @ts-expect-error Not a mode, as a forged request might send.
        await seam.planCardImport(EDITOR, { ...MSTC, ...paths, mode: "merge" }),
      ).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { mode: ["CHOOSE REPLACE OR ADD"] } },
      });
    });
  });

  describe("confirmCardImport", () => {
    it("creates the missing Topics after the existing ones, with Hidden decks, cards in order and their images stored privately", async () => {
      const confirmed = await importRows(ROWS, { zip: ZIP() });

      expect(confirmed.tags).toEqual([]);
      expect(await mstcTopics()).toEqual([
        // Its deck was already Visible, and stays so.
        ["Simple Curves", "visible"],
        ["Spiral Curves", "visible"],
        ["Surveying", null],
        ["Algebra", "hidden"],
        ["Highways", "hidden"],
        ["Simple Curve", "hidden"],
      ]);
      const [simple, highways, simpleCurve] = confirmed.value.topics;
      expect(confirmed.value.topics.map((t) => [t.name, t.created, t.counts.add])).toEqual([
        ["Simple Curves", false, 1],
        ["Highways", true, 2],
        ["Simple Curve", true, 1],
      ]);

      const cards = await arm.cards();
      const inDeck = (deckId: string | undefined) => cards.filter((card) => card.deckId === deckId);
      expect(inDeck(simple?.contentId).map((c) => [c.position, c.front, c.note])).toEqual([
        [1, "Degree of curve", "Arc basis"],
      ]);
      expect(inDeck(simpleCurve?.contentId).map((c) => c.front)).toEqual(["Length of curve"]);
      const [superelevation, sightDistance] = inDeck(highways?.contentId);
      expect([superelevation?.position, sightDistance?.position]).toEqual([1, 2]);
      expect(superelevation?.image).toMatch(
        new RegExp(`^decks/${highways?.contentId}/${UUID}\\.png$`),
      );
      expect(sightDistance?.image).toMatch(
        new RegExp(`^decks/${highways?.contentId}/${UUID}\\.jpg$`),
      );
      expect(await arm.storedFile(superelevation?.image ?? "")).toEqual(PNG);
      expect(await arm.storedFile(sightDistance?.image ?? "")).toEqual(JPEG);
    });

    it("records one Staff Activity entry with each Topic's counts, not every card", async () => {
      const confirmed = await importRows(ROWS, { zip: ZIP() });

      expect(await arm.staffActivity()).toEqual([
        {
          id: expect.any(String),
          at: expect.any(String),
          actor: { email: EDITOR.email, name: EDITOR.name },
          entity: "card-import",
          entityId: "CE:MSTC",
          action: "import",
          before: null,
          after: {
            exam: "CE",
            subject: "MSTC",
            mode: "add",
            topics: confirmed.value.topics.map(({ topicId, contentId, name, created, counts }) => ({
              topicId,
              deckId: contentId,
              name,
              created,
              ...counts,
            })),
          },
        },
      ]);
    });

    it("deletes the uploaded files once the import is saved", async () => {
      const { input, preview } = await check(ROWS, { zip: ZIP() });
      await seam.confirmCardImport(EDITOR, { ...input, basedOn: preview.basedOn });

      expect(await seam.planCardImport(EDITOR, input)).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { csv: expect.any(Array), zip: expect.any(Array) } },
      });
    });

    it("Replace keeps the id of each card whose front is unchanged, and removes the rest with their images", async () => {
      const first = await importRows(
        [
          "Surveying,Bearing,From north or south,,",
          "Surveying,Azimuth,From north,,",
          "Surveying,Traverse,A series of lines,,curve.png",
        ],
        { zip: ZIP() },
      );
      const deckId = first.value.topics[0]?.contentId;
      const before = await arm.cards();
      const id = (front: string) => before.find((card) => card.front === front)?.id;
      const removedImage = before.find((card) => card.front === "Traverse")?.image ?? "";
      expect(await arm.storedFile(removedImage)).toEqual(PNG);

      const second = await importRows(
        [
          "Surveying,Azimuth,From north,,",
          "Surveying,  Bearing ,From north or south (corrected),,",
          "Surveying,Stadia,Measuring distance with a rod,,",
        ],
        { mode: "replace" },
      );

      expect(second.value.topics[0]).toMatchObject({
        topicId: SURVEYING,
        contentId: deckId,
        created: false,
        counts: { add: 1, replace: 1, keep: 1, remove: 1 },
      });
      const after = await arm.cards();
      expect(after.map((c) => [c.position, c.id === id(c.front.trim()), c.front, c.back])).toEqual([
        [1, true, "Azimuth", "From north"],
        [2, true, "Bearing", "From north or south (corrected)"],
        [3, false, "Stadia", "Measuring distance with a rod"],
      ]);
      expect(after.some((card) => card.id === id("Traverse"))).toBe(false);
      expect(await arm.storedFile(removedImage)).toBeNull();
    });

    it("Add appends after the existing cards, keeping them all", async () => {
      await importRows(["Surveying,Bearing,b1,,", "Surveying,Azimuth,a1,,"]);
      const before = await arm.cards();

      const added = await importRows(["Surveying,Bearing,b2,,"], { mode: "add" });

      expect(added.value.topics[0]?.counts).toEqual({ add: 1, replace: 0, keep: 2, remove: 0 });
      const after = await arm.cards();
      expect(after.map((c) => [c.position, c.front, c.back])).toEqual([
        [1, "Bearing", "b1"],
        [2, "Azimuth", "a1"],
        [3, "Bearing", "b2"],
      ]);
      expect(after.slice(0, 2).map((c) => c.id)).toEqual(before.map((c) => c.id));
    });

    it("refuses a preview with problems on the server, saving nothing", async () => {
      const { input, preview } = await check(["T,f,$x,,"]);
      expect(preview.problems).toHaveLength(1);

      expect(await seam.confirmCardImport(EDITOR, { ...input, basedOn: preview.basedOn })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "FIX THE PROBLEMS IN THE FILE, THEN CHECK IT AGAIN",
        },
      });
      expect(await arm.cards()).toEqual([]);
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses a conflict when the Subject's cards changed since the preview, saving nothing", async () => {
      const { input, preview } = await check(["Surveying,Bearing,b,,"]);
      await importRows(["Algebra,Quadratic formula,$x = \\dfrac{-b}{2a}$,,"]);
      const between = await arm.cards();

      const confirmed = await seam.confirmCardImport(EDITOR, {
        ...input,
        basedOn: preview.basedOn,
      });

      expect(confirmed).toEqual({
        ok: false,
        error: { kind: "conflict", savedBy: null, savedAt: expect.any(String) },
      });
      expect(await arm.cards()).toEqual(between);
    });

    it("refuses a conflict when a Topic was renamed since the preview", async () => {
      const { input, preview } = await check(["Surveying,Bearing,b,,"]);
      const renamed = await seam.renameTopic(EDITOR, { id: SURVEYING, name: "Leveling" });
      expect(renamed.ok).toBe(true);

      expect(
        await seam.confirmCardImport(EDITOR, { ...input, basedOn: preview.basedOn }),
      ).toMatchObject({ ok: false, error: { kind: "conflict" } });
      expect(await arm.cards()).toEqual([]);
    });

    it("refuses a preview it never gave", async () => {
      const { input } = await check(["Surveying,Bearing,b,,"]);

      expect(
        await seam.confirmCardImport(EDITOR, { ...input, basedOn: "0".repeat(64) }),
      ).toMatchObject({ ok: false, error: { kind: "conflict" } });
      expect(
        await seam.confirmCardImport(EDITOR, { ...input, basedOn: "not a preview" }),
      ).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { basedOn: expect.any(Array) } },
      });
      expect(await arm.cards()).toEqual([]);
    });

    it("saves nothing when the save fails halfway, and deletes the images it stored", async () => {
      const { input, preview } = await check(ROWS, { zip: ZIP() });
      const topics = await mstcTopics();
      const put = vi.spyOn(arm.contentFiles, "put");
      const remove = vi.spyOn(arm.contentFiles, "remove");
      const restore = await arm.breakStaffActivity();
      try {
        await expect(
          seam.confirmCardImport(EDITOR, { ...input, basedOn: preview.basedOn }),
        ).rejects.toThrow();
      } finally {
        await restore();
      }

      expect(await mstcTopics()).toEqual(topics);
      expect(await arm.cards()).toEqual([]);
      expect(await arm.staffActivity()).toEqual([]);
      const stored = put.mock.calls.map(([path]) => path);
      expect(stored).toHaveLength(2);
      expect(remove).toHaveBeenCalledWith(stored);
      for (const path of stored) expect(await arm.storedFile(path)).toBeNull();
    });

    it("saves nothing when an image can't be stored, and deletes those already stored", async () => {
      const { input, preview } = await check(ROWS, { zip: ZIP() });
      const original = arm.contentFiles.put.bind(arm.contentFiles);
      const put = vi
        .spyOn(arm.contentFiles, "put")
        .mockImplementationOnce(original)
        .mockRejectedValueOnce(new Error("Storage is down"));

      await expect(
        seam.confirmCardImport(EDITOR, { ...input, basedOn: preview.basedOn }),
      ).rejects.toThrow("Storage is down");

      expect(await arm.cards()).toEqual([]);
      expect(await arm.staffActivity()).toEqual([]);
      const [first] = put.mock.calls.map(([path]) => path);
      expect(await arm.storedFile(first ?? "")).toBeNull();
    });

    it("reports an image in the zip that isn't really the image its name says, and won't import it", async () => {
      const { input, preview } = await check(["T,f,b,,fake.png", "T,f2,b2,,images/real.png"], {
        zip: importZip({ "fake.png": textBytes(40), "images/real.png": PNG }),
      });
      expect(preview.problems).toEqual([
        {
          file: "csv",
          row: 2,
          column: "image",
          message: "“fake.png” in the zip isn’t really a PNG image",
        },
      ]);

      expect(await seam.confirmCardImport(EDITOR, { ...input, basedOn: preview.basedOn })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "FIX THE PROBLEMS IN THE FILE, THEN CHECK IT AGAIN",
        },
      });
      expect(await arm.cards()).toEqual([]);
    });

    it("refuses a conflict when Import names another mode, or other files, than the preview", async () => {
      await importRows(["Surveying,Bearing,b,,", "Surveying,Azimuth,a,,"]);
      const { input, preview } = await check(["Surveying,Bearing,b2,,"], { mode: "add" });
      const other = await arm.uploadImport({ csv: importCsv(["Surveying,Bearing,b2,,"]) });
      const before = await arm.cards();

      // The preview showed Add; Replace would remove Azimuth.
      for (const changed of [{ mode: "replace" as const }, { csv: other.csv }]) {
        expect(
          await seam.confirmCardImport(EDITOR, { ...input, ...changed, basedOn: preview.basedOn }),
        ).toMatchObject({ ok: false, error: { kind: "conflict" } });
      }
      expect(await arm.cards()).toEqual(before);
    });

    it("Replace gives a kept card its new image, or none, and deletes the old one", async () => {
      await importRows(
        ["Surveying,Bearing,b,,curve.png", "Surveying,Azimuth,a,,images/brake.jpg"],
        {
          zip: ZIP(),
        },
      );
      const before = await arm.cards();
      const [bearing, azimuth] = before;

      await importRows(["Surveying,Bearing,b,,new.png", "Surveying,Azimuth,a,,"], {
        mode: "replace",
        zip: importZip({ "new.png": PNG }),
      });

      const after = await arm.cards();
      expect(after.map((card) => card.id)).toEqual([bearing?.id, azimuth?.id]);
      const [newBearing, newAzimuth] = after;
      expect(newBearing?.image).not.toBe(bearing?.image);
      expect(await arm.storedFile(newBearing?.image ?? "")).toEqual(PNG);
      expect(newAzimuth?.image).toBeNull();
      expect(await arm.storedFile(bearing?.image ?? "")).toBeNull();
      expect(await arm.storedFile(azimuth?.image ?? "")).toBeNull();
    });

    it("imports the template unchanged, with its example image", async () => {
      const paths = await arm.uploadImport({
        csv: new TextEncoder().encode(CARD_IMPORT_TEMPLATE_CSV),
        zip: importExampleZip(),
      });
      const input = { exam: "ce", subject: "psad", mode: "add", ...paths } as const;
      const planned = await seam.planCardImport(EDITOR, input);
      if (!planned.ok) throw new Error(JSON.stringify(planned.error));
      expect(planned.value.problems).toEqual([]);

      const confirmed = await seam.confirmCardImport(EDITOR, {
        ...input,
        basedOn: planned.value.basedOn,
      } satisfies ConfirmImportInput);

      expect(confirmed.ok).toBe(true);
      const cards = await arm.cards();
      expect(cards).toHaveLength(2);
      expect(cards.filter((card) => card.image !== null)).toHaveLength(1);
    });
  });
});
