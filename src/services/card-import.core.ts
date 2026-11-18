import { createHash } from "node:crypto";

import type { z } from "zod";

import { readCsvFile } from "@/lib/card-import/csv";
import type { ImportMode } from "@/lib/card-import/modes";
import {
  type CardImportPlan,
  type ExistingTopic,
  type ImportProblem,
  planCardImport as planImport,
} from "@/lib/card-import/plan";
import { listZipFile, readZipEntries } from "@/lib/card-import/zip";
import { cardImagePath, type CardImageType, cardImageType } from "@/lib/cards/card-rules";
import { hasFileSignature } from "@/lib/file-signature";
import {
  type CardImportInput,
  cardImportInputSchema,
  type ConfirmCardImportInput,
  confirmCardImportInputSchema,
  invalidInput,
  roleRefusal,
} from "@/services/admin.schema";
import type {
  AdminError,
  AdminResult,
  CardImportPreview,
  CardImportResult,
  CardImportTopicResult,
  StaffActivity,
  StaffActor,
} from "@/services/admin.types";
import type { Card, Deck, Topic } from "@/services/content.types";
import type { ContentFiles } from "@/services/uploads";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's card import (Phase 3, ticket 06; spec, Phase 3 →
// Spreadsheet import; stories 118, 120–124, 133p), shared by both arms: each
// arm gives a CardImportStore (how it reads a Subject's Topics and cards, and
// saves an import all or nothing), and this module does the rest the same
// way for both.
//
// "Check file" (planCardImport) reads the uploaded CSV and zip from the
// private content bucket, plans the import against the Subject's Topics and
// cards (src/lib/card-import/plan.ts), checks each card's image really is
// the image its name says, and gives the preview. It saves nothing and keeps
// nothing.
//
// "Import" (confirmCardImport), in order:
//   1. checks the actor's Staff Role (any Staff User) and the input,
//   2. reads the Subject, and refuses a conflict if its Topics or cards have
//      changed since the preview, or the files or mode aren't the preview's
//      (`basedOn`),
//   3. reads the files again and plans again (each card's image unpacked and
//      checked to really be that image), refusing a plan with problems,
//   4. stores each card's image in the private content bucket under its deck,
//   5. saves the Topics, Hidden decks, cards and one Staff Activity record in
//      one go, or nothing, checking again under the content lock that the
//      Subject hasn't changed; should that fail, it deletes the images it
//      stored, and
//   6. once saved, deletes the images no card uses any more and the import's
//      uploaded files. A failed delete is logged, and never fails the import.
// Nothing cached reads Topics or cards, so it returns no cache tags.
// ─────────────────────────────────────────────────────────────────────────────

/** A Subject, with its Topics in order, their decks, and those decks' cards. */
export interface SubjectCards {
  exam: { code: string; name: string };
  subject: { code: string; name: string };
  topics: Topic[];
  decks: Deck[];
  cards: Card[];
}

/** Everything a confirmed import changes, worked out before anything is saved. */
export interface CardImportWrites {
  /** The Topics it creates, after the existing ones. */
  topics: Topic[];
  /** The decks it creates, all Hidden. */
  decks: Deck[];
  inserted: Card[];
  updated: Card[];
  /** The ids of the cards Replace removes. */
  removed: string[];
  /** Each image to store: its path in the bucket, and its file in the zip. */
  images: { path: string; entry: string; contentType: CardImageType }[];
  /** The images no card will use once it's saved: removed cards', and replaced cards' old ones. */
  staleImages: string[];
  result: CardImportResult;
}

/** How an arm reads a Subject's cards and saves an import. */
export interface CardImportStore {
  /** The Subject with its Topics and cards, or null when the Exam or Subject isn't in the catalogue. */
  read(examCode: string, subjectCode: string): Promise<SubjectCards | null>;
  /** The private content bucket. */
  files: ContentFiles;
  /**
   * Saves the writes and their Staff Activity record, all or nothing, if the
   * Subject still has the `state` it was read with (subjectStateOf) once its
   * writes are held off; otherwise saves nothing and answers "conflict".
   * Throws when the save fails.
   */
  save(
    subject: SubjectCards,
    writes: CardImportWrites,
    activity: StaffActivity,
    state: string,
  ): Promise<"saved" | "conflict">;
}

// ── Pure helpers ────────────────────────────────────────────────────────────

/** Pure: a Subject's Topics as the planner reads them, each with its deck and cards in order. */
function existingTopicsOf(subject: SubjectCards): ExistingTopic[] {
  return [...subject.topics]
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((topic) => {
      const deck = subject.decks.find((candidate) => candidate.topicId === topic.id) ?? null;
      const cards = deck
        ? subject.cards
            .filter((card) => card.deckId === deck.id)
            .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
        : [];
      return {
        id: topic.id,
        name: topic.name,
        deck: deck ? { id: deck.id, visibility: deck.visibility } : null,
        cards: cards.map(({ id, front, back, note, image }) => ({ id, front, back, note, image })),
      };
    });
}

const sha256 = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/**
 * Pure: what the Subject's Topics and cards are, as one hash. Any change to
 * them (a Topic added or renamed, a card edited, another import) changes it.
 */
export function subjectStateOf(subject: SubjectCards): string {
  return sha256(existingTopicsOf(subject));
}

/**
 * Pure: what a preview was based on: the Subject as it was, the files and the
 * mode. Confirming anything else (the Subject changed since, other files, or
 * the other mode) is a conflict.
 */
function basedOnOf(
  subject: SubjectCards,
  { csv, zip, mode }: { csv: string; zip: string | null; mode: ImportMode },
): string {
  return sha256({ subject: subjectStateOf(subject), csv, zip, mode });
}

const IMAGE_TYPE_NAMES: Record<CardImageType, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
};

/** A plan for the files, with each card's image unpacked from the zip. */
interface FilesPlan {
  planned: CardImportPlan;
  /** The images the cards use, by their path in the zip. */
  images: Map<string, Uint8Array>;
}

/** Pure: zip problems first, then the rows' problems in row order. */
const inOrder = (problems: ImportProblem[]) =>
  [...problems].sort((a, b) => (a.row ?? 0) - (b.row ?? 0));

/**
 * Pure: the plan for the files. A file the readers refuse is a problem with
 * no row; when it's the zip, the rows' image cells aren't judged as well.
 * Each image a card uses is unpacked, and one that isn't really the image its
 * name says is a problem on each row that names it.
 */
function planFiles(
  subject: SubjectCards,
  csv: Uint8Array,
  zip: Uint8Array | null,
  mode: ImportMode,
): FilesPlan {
  const images = new Map<string, Uint8Array>();
  const whole = (file: "csv" | "zip", message: string): ImportProblem => ({
    file,
    row: null,
    column: null,
    message,
  });
  const sheet = readCsvFile(csv);
  const listed = zip ? listZipFile(zip) : null;
  const zipProblem = listed && !listed.ok ? whole("zip", listed.problem) : null;
  if (!sheet.ok) {
    const problems = [whole("csv", sheet.problem), ...(zipProblem ? [zipProblem] : [])];
    return { planned: { topics: [], problems }, images };
  }
  const planned = planImport({
    topics: existingTopicsOf(subject),
    csv: sheet.sheet,
    zip: listed?.ok ? listed.listing : null,
    mode,
  });
  if (zipProblem) {
    const rowProblems = planned.problems.filter((problem) => problem.column !== "image");
    return { planned: { topics: planned.topics, problems: [zipProblem, ...rowProblems] }, images };
  }

  const cards = planned.topics.flatMap((topic) => topic.cards);
  const entries = [...new Set(cards.flatMap((card) => (card.image ? [card.image] : [])))];
  if (!zip || entries.length === 0) return { planned, images };
  try {
    for (const [entry, bytes] of readZipEntries(zip, entries)) images.set(entry, bytes);
  } catch {
    const problem = whole("zip", "has an image that can’t be unpacked: make the zip again");
    return { planned: { ...planned, problems: inOrder([...planned.problems, problem]) }, images };
  }
  const fakes = cards.flatMap(({ row, image }): ImportProblem[] => {
    const type = image ? cardImageType(image) : null;
    const bytes = image ? images.get(image) : undefined;
    if (!image || !type || (bytes && hasFileSignature(bytes, type))) return [];
    const message = `“${image}” in the zip isn’t really a ${IMAGE_TYPE_NAMES[type]} image`;
    return [{ file: "csv", row, column: "image", message }];
  });
  if (fakes.length === 0) return { planned, images };
  return { planned: { ...planned, problems: inOrder([...planned.problems, ...fakes]) }, images };
}

/** Pure: the preview of a plan. */
function previewOf(
  subject: SubjectCards,
  planned: CardImportPlan,
  input: { csv: string; zip: string | null; mode: ImportMode },
): CardImportPreview {
  return {
    exam: subject.exam,
    subject: subject.subject,
    mode: input.mode,
    topics: planned.topics.map((topic) => ({
      name: topic.name,
      topicId: topic.topicId,
      similarTo: topic.similarTo,
      deck: topic.deck?.visibility ?? "new",
      mode: topic.mode,
      counts: topic.counts,
    })),
    problems: planned.problems,
    basedOn: basedOnOf(subject, input),
  };
}

/**
 * Pure: everything a plan with no problems changes. New Topics go after the
 * existing ones; Replace gives a deck the CSV's order, Add puts the new cards
 * after the existing ones. Each image gets a new path under its deck, so a
 * stored file is never overwritten.
 */
function writesOf(
  subject: SubjectCards,
  planned: CardImportPlan,
  newId: () => string,
): CardImportWrites {
  const writes: CardImportWrites = {
    topics: [],
    decks: [],
    inserted: [],
    updated: [],
    removed: [],
    images: [],
    staleImages: [],
    result: { topics: [] },
  };
  const cardsById = new Map(subject.cards.map((card) => [card.id, card]));
  let lastTopic = Math.max(0, ...subject.topics.map((topic) => topic.position));

  for (const topicPlan of planned.topics) {
    let topicId = topicPlan.topicId;
    if (!topicId) {
      topicId = newId();
      lastTopic += 1;
      writes.topics.push({
        id: topicId,
        examCode: subject.exam.code,
        subjectCode: subject.subject.code,
        name: topicPlan.name,
        position: lastTopic,
      });
    }
    let deckId = topicPlan.deck?.id ?? null;
    if (!deckId) {
      deckId = newId();
      writes.decks.push({ id: deckId, topicId, visibility: "hidden", freePreview: false });
    }
    const last = subject.cards.reduce(
      (highest, card) => (card.deckId === deckId ? Math.max(highest, card.position) : highest),
      0,
    );
    const first = topicPlan.mode === "replace" ? 1 : last + 1;

    topicPlan.cards.forEach((planned, index) => {
      let image: string | null = null;
      if (planned.image) {
        const contentType = cardImageType(planned.image);
        if (!contentType) throw new Error(`“${planned.image}” isn’t an image the planner allows.`);
        image = cardImagePath(deckId, newId(), contentType);
        writes.images.push({ path: image, entry: planned.image, contentType });
      }
      const card: Card = {
        id: planned.cardId ?? newId(),
        deckId,
        position: first + index,
        front: planned.front,
        back: planned.back,
        note: planned.note,
        image,
      };
      const before = planned.cardId ? cardsById.get(planned.cardId) : undefined;
      if (!before) {
        writes.inserted.push(card);
        return;
      }
      if (before.image) writes.staleImages.push(before.image);
      const unchanged =
        planned.change === "keep" && before.position === card.position && !before.image;
      if (!unchanged) writes.updated.push(card);
    });
    for (const id of topicPlan.removed) {
      writes.removed.push(id);
      const image = cardsById.get(id)?.image;
      if (image) writes.staleImages.push(image);
    }
    writes.result.topics.push({
      topicId,
      deckId,
      name: topicPlan.name,
      created: topicPlan.topicId === null,
      counts: topicPlan.counts,
    } satisfies CardImportTopicResult);
  }
  return writes;
}

/** Pure: the import's one Staff Activity record: per-Topic counts, not every card. */
function activityOf(
  actor: StaffActor,
  subject: SubjectCards,
  mode: ImportMode,
  writes: CardImportWrites,
  now: Date,
): StaffActivity {
  return {
    id: crypto.randomUUID(),
    at: now.toISOString(),
    actor: { email: actor.email, name: actor.name },
    entity: "card-import",
    entityId: `${subject.exam.code}:${subject.subject.code}`,
    action: "import",
    before: null,
    after: {
      exam: subject.exam.code,
      subject: subject.subject.code,
      mode,
      topics: writes.result.topics.map(({ topicId, deckId, name, created, counts }) => ({
        topicId,
        deckId,
        name,
        created,
        ...counts,
      })),
    },
  };
}

// ── The seam's two calls ────────────────────────────────────────────────────

const refused = (error: AdminError): { ok: false; error: AdminError } => ({ ok: false, error });
const formError = (message: string): AdminError => ({
  kind: "invalid",
  fieldErrors: {},
  formError: message,
});

export const IMPORT_HAS_PROBLEMS = "FIX THE PROBLEMS IN THE FILE, THEN CHECK IT AGAIN";

/** How many images are stored at once: enough to keep a big zip quick, few enough for Storage. */
const IMAGES_AT_ONCE = 6;

/** The card import's two calls, on an arm's store. */
export function cardImportCalls(store: CardImportStore) {
  /** Steps 1–2: the role check, the input, and the Subject. */
  async function begin<T extends { exam: string; subject: string }>(
    actor: StaffActor,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    input: unknown,
  ) {
    const refusal = roleRefusal(actor, "staff");
    if (refusal) return refused(refusal);
    const parsed = schema.safeParse(input);
    if (!parsed.success) return refused(invalidInput(parsed.error));
    const subject = await store.read(parsed.data.exam, parsed.data.subject);
    if (!subject) return refused({ kind: "not-found" });
    return { ok: true as const, value: parsed.data, subject };
  }

  /** The uploaded files, or which of them hasn't arrived. */
  async function readFiles(csvPath: string, zipPath: string | null) {
    const csv = await store.files.readUpload(csvPath, "card-import-csv");
    const zip = zipPath ? await store.files.readUpload(zipPath, "card-import-zip") : null;
    const fieldErrors: Record<string, string[]> = {};
    if (!csv) fieldErrors.csv = ["UPLOAD THE CSV FILE AGAIN"];
    if (zipPath && !zip) fieldErrors.zip = ["UPLOAD THE ZIP OF IMAGES AGAIN"];
    if (!csv || (zipPath && !zip)) return refused({ kind: "invalid", fieldErrors });
    return { ok: true as const, csv, zip };
  }

  async function planCardImport(
    actor: StaffActor,
    input: CardImportInput,
  ): Promise<AdminResult<CardImportPreview>> {
    const begun = await begin(actor, cardImportInputSchema, input);
    if (!begun.ok) return begun;
    const { value, subject } = begun;
    const files = await readFiles(value.csv, value.zip);
    if (!files.ok) return files;
    const { planned } = planFiles(subject, files.csv, files.zip, value.mode);
    return { ok: true, value: previewOf(subject, planned, value), tags: [] };
  }

  /**
   * Step 4: stores each image, a few at a time, or none: a failure deletes
   * those already stored, once the others under way have finished, and
   * throws.
   */
  async function storeImages(
    unpacked: Map<string, Uint8Array>,
    images: CardImportWrites["images"],
  ): Promise<void> {
    const stored: string[] = [];
    for (let start = 0; start < images.length; start += IMAGES_AT_ONCE) {
      const batch = images.slice(start, start + IMAGES_AT_ONCE);
      const settled = await Promise.allSettled(
        batch.map(async ({ path, entry, contentType }) => {
          const bytes = unpacked.get(entry);
          if (!bytes) throw new Error(`“${entry}” wasn’t unpacked from the zip.`);
          await store.files.put(path, bytes, contentType);
        }),
      );
      settled.forEach((outcome, index) => {
        const image = batch[index];
        if (outcome.status === "fulfilled" && image) stored.push(image.path);
      });
      const failed = settled.find((outcome) => outcome.status === "rejected");
      if (failed) {
        await store.files.remove(stored);
        throw failed.reason;
      }
    }
  }

  async function confirmCardImport(
    actor: StaffActor,
    input: ConfirmCardImportInput,
  ): Promise<AdminResult<CardImportResult>> {
    const begun = await begin(actor, confirmCardImportInputSchema, input);
    if (!begun.ok) return begun;
    const { value, subject } = begun;
    const now = new Date();
    // The preview's Subject, files or mode changed: there's no one save to name, so it names no one.
    const conflict = refused({ kind: "conflict", savedBy: null, savedAt: now.toISOString() });
    if (basedOnOf(subject, value) !== value.basedOn) return conflict;

    const files = await readFiles(value.csv, value.zip);
    if (!files.ok) return files;
    const { planned, images } = planFiles(subject, files.csv, files.zip, value.mode);
    if (planned.problems.length > 0) return refused(formError(IMPORT_HAS_PROBLEMS));

    const writes = writesOf(subject, planned, () => crypto.randomUUID());
    await storeImages(images, writes.images);

    const stored = writes.images.map((image) => image.path);
    const activity = activityOf(actor, subject, value.mode, writes, now);
    let outcome: "saved" | "conflict";
    try {
      outcome = await store.save(subject, writes, activity, subjectStateOf(subject));
    } catch (error) {
      await store.files.remove(stored);
      throw error;
    }
    if (outcome === "conflict") {
      await store.files.remove(stored);
      return conflict;
    }
    const uploads = [value.csv, ...(value.zip ? [value.zip] : [])];
    await store.files.remove([...new Set(writes.staleImages), ...uploads]);
    return { ok: true, value: writes.result, tags: [] };
  }

  return { planCardImport, confirmCardImport };
}
