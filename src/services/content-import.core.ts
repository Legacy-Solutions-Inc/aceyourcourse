import { createHash } from "node:crypto";

import type { z } from "zod";

import { type CardImageType, cardImageType } from "@/lib/cards/card-rules";
import { readCsvFile } from "@/lib/content-import/csv";
import type { ImportMode } from "@/lib/content-import/modes";
import {
  type ExistingTopic,
  type ImportRows,
  type ImportPlan,
  type ImportProblem,
  planImport,
} from "@/lib/content-import/plan";
import { listZipFile, readZipEntries } from "@/lib/content-import/zip";
import { hasFileSignature } from "@/lib/file-signature";
import {
  type ConfirmImportInput,
  confirmImportInputSchema,
  type ImportInput,
  importInputSchema,
  invalidInput,
  roleRefusal,
} from "@/services/admin.schema";
import type {
  AdminError,
  AdminResult,
  ImportPreview,
  ImportResult,
  StaffActivity,
  StaffActor,
} from "@/services/admin.types";
import type { Topic } from "@/services/content.types";
import type { ContentFiles } from "@/services/uploads";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's spreadsheet imports (Phase 3; spec, Phase 3 → Spreadsheet
// import; stories 118–124, 133l, 133p): the card import (ticket 06,
// card-import.core.ts) and the quiz import (ticket 09, quiz-import.core.ts),
// shared by both arms. Each kind of import gives a ContentImporter (its rows,
// how it reads a Subject's Topics, and what a plan writes), each arm an
// ImportStore (how it reads a Subject and saves an import all or nothing),
// and this module does the rest the same way for every kind and arm.
//
// "Check file" (plan) reads the uploaded CSV and zip from the private content
// bucket, plans the import against the Subject's Topics
// (src/lib/content-import/plan.ts), checks each row's image or figure really
// is the image its name says, and gives the preview. It saves nothing and
// keeps nothing.
//
// "Import" (confirm), in order:
//   1. checks the actor's Staff Role (any Staff User) and the input,
//   2. reads the Subject, and refuses a conflict if its Topics or what they
//      hold have changed since the preview, or the files or mode aren't the
//      preview's (`basedOn`),
//   3. reads the files again and plans again (each file unpacked and checked
//      to really be that image), refusing a plan with problems,
//   4. stores each image or figure in the private content bucket,
//   5. saves the Topics, the new Hidden decks or quizzes, their items and
//      one Staff Activity record in one go, or nothing, checking again under
//      the content lock that the Subject hasn't changed; should that fail, it
//      deletes the files it stored, and
//   6. once saved, deletes the files nothing uses any more and the import's
//      uploaded files. A failed delete is logged, and never fails the import.
// Nothing cached reads Topics or their content, so it returns no cache tags.
// ─────────────────────────────────────────────────────────────────────────────

/** A Subject, with its Topics in order: every kind of import reads at least this. */
export interface ImportSubject {
  exam: { code: string; name: string };
  subject: { code: string; name: string };
  topics: Topic[];
}

/** What every import's writes have, besides the rows of its own kind. */
export interface ImportWrites {
  /** The Topics it creates, after the existing ones. */
  topics: Topic[];
  /** Each file to store: its path in the bucket, and its file in the zip. */
  images: { path: string; entry: string; contentType: CardImageType }[];
  /** The stored files nothing will use once it's saved. */
  staleImages: string[];
  result: ImportResult;
}

/** A kind of import: what its rows are, how it reads a Subject's Topics, and what a plan writes. */
export interface ContentImporter<
  Subject extends ImportSubject,
  Fields,
  Writes extends ImportWrites,
> {
  rows: ImportRows<Fields>;
  /** The Staff Activity record's entity, and what its Topics call their deck or quiz's id. */
  activity: { entity: string; contentKey: string };
  /** Pure: the Subject's Topics as the planner reads them, each with its deck or quiz and its items in order. */
  existingTopics(subject: Subject): ExistingTopic<Fields>[];
  /**
   * Pure: everything a plan with no problems changes, worked out before
   * anything is saved. New Topics go after the existing ones, and a Topic
   * with no deck or quiz gets a new, Hidden one.
   */
  writesOf(subject: Subject, planned: ImportPlan<Fields>, newId: () => string, now: Date): Writes;
}

/** How an arm reads a Subject for an import and saves one. */
export interface ImportStore<Subject extends ImportSubject, Writes extends ImportWrites> {
  /** The Subject, or null when the Exam or Subject isn't in the catalogue. */
  read(examCode: string, subjectCode: string): Promise<Subject | null>;
  /** The private content bucket. */
  files: ContentFiles;
  /**
   * Saves the writes and their Staff Activity record, all or nothing, if the
   * Subject still has the `state` it was read with (importStateOf) once its
   * writes are held off; otherwise saves nothing and answers "conflict".
   * Throws when the save fails.
   */
  save(
    subject: Subject,
    writes: Writes,
    activity: StaffActivity,
    state: string,
  ): Promise<"saved" | "conflict">;
}

// ── Pure helpers ────────────────────────────────────────────────────────────

const sha256 = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/**
 * Pure: what the Subject's Topics and what they hold are, as one hash, as
 * the importer reads them. Any change to them (a Topic added or renamed, an
 * item edited, another import) changes it.
 */
export function importStateOf<Subject extends ImportSubject, Fields>(
  importer: ContentImporter<Subject, Fields, ImportWrites>,
  subject: Subject,
): string {
  return sha256(importer.existingTopics(subject));
}

/** Pure: a Subject's Topics in their order, as the importers list them. */
export const topicsInOrder = (topics: readonly Topic[]) =>
  [...topics].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));

/**
 * The Topic each planned Topic is: its own id when it exists, or a new one,
 * made in order of first appearance after the Subject's existing Topics,
 * which `created` collects for the writes.
 */
export function topicsFor(subject: ImportSubject, newId: () => string) {
  let last = Math.max(0, ...subject.topics.map((topic) => topic.position));
  const created: Topic[] = [];
  return {
    created,
    idOf({ topicId, name }: { topicId: string | null; name: string }): string {
      if (topicId) return topicId;
      const id = newId();
      last += 1;
      created.push({
        id,
        examCode: subject.exam.code,
        subjectCode: subject.subject.code,
        name,
        position: last,
      });
      return id;
    },
  };
}

/**
 * Pure: what a preview was based on: the Subject as it was, the files and the
 * mode. Confirming anything else (the Subject changed since, other files, or
 * the other mode) is a conflict.
 */
function basedOnOf(
  state: string,
  { csv, zip, mode }: { csv: string; zip: string | null; mode: ImportMode },
): string {
  return sha256({ subject: state, csv, zip, mode });
}

const IMAGE_TYPE_NAMES: Record<CardImageType, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
};

/** A plan for the files, with each row's image unpacked from the zip. */
interface FilesPlan<Fields> {
  planned: ImportPlan<Fields>;
  /** The images the rows use, by their path in the zip. */
  images: Map<string, Uint8Array>;
}

/** Pure: zip problems first, then the rows' problems in row order. */
const inOrder = (problems: ImportProblem[]) =>
  [...problems].sort((a, b) => (a.row ?? 0) - (b.row ?? 0));

/**
 * Pure: the plan for the files. A file the readers refuse is a problem with
 * no row; when it's the zip, the rows' image cells aren't judged as well.
 * Each image a row uses is unpacked, and one that isn't really the image its
 * name says is a problem on each row that names it.
 */
function planFiles<Fields>(
  rows: ImportRows<Fields>,
  existing: ExistingTopic<Fields>[],
  csv: Uint8Array,
  zip: Uint8Array | null,
  mode: ImportMode,
): FilesPlan<Fields> {
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
  const planned = planImport(rows, {
    topics: existing,
    csv: sheet.sheet,
    zip: listed?.ok ? listed.listing : null,
    mode,
  });
  if (zipProblem) {
    const rowProblems = planned.problems.filter((problem) => problem.column !== rows.fileColumn);
    return { planned: { topics: planned.topics, problems: [zipProblem, ...rowProblems] }, images };
  }

  const items = planned.topics.flatMap((topic) => topic.items);
  const entries = [...new Set(items.flatMap((item) => (item.image ? [item.image] : [])))];
  if (!zip || entries.length === 0) return { planned, images };
  try {
    for (const [entry, bytes] of readZipEntries(zip, entries)) images.set(entry, bytes);
  } catch {
    const problem = whole("zip", "has an image that can’t be unpacked: make the zip again");
    return { planned: { ...planned, problems: inOrder([...planned.problems, problem]) }, images };
  }
  const fakes = items.flatMap(({ row, image }): ImportProblem[] => {
    const type = image ? cardImageType(image) : null;
    const bytes = image ? images.get(image) : undefined;
    if (!image || !type || (bytes && hasFileSignature(bytes, type))) return [];
    const message = `“${image}” in the zip isn’t really a ${IMAGE_TYPE_NAMES[type]} image`;
    return [{ file: "csv", row, column: rows.fileColumn, message }];
  });
  if (fakes.length === 0) return { planned, images };
  return { planned: { ...planned, problems: inOrder([...planned.problems, ...fakes]) }, images };
}

/** Pure: the preview of a plan. */
function previewOf<Fields>(
  subject: ImportSubject,
  planned: ImportPlan<Fields>,
  input: { mode: ImportMode },
  basedOn: string,
): ImportPreview {
  return {
    exam: subject.exam,
    subject: subject.subject,
    mode: input.mode,
    topics: planned.topics.map((topic) => ({
      name: topic.name,
      topicId: topic.topicId,
      similarTo: topic.similarTo,
      content: topic.content?.visibility ?? "new",
      mode: topic.mode,
      counts: topic.counts,
    })),
    problems: planned.problems,
    basedOn,
  };
}

/** Pure: the import's one Staff Activity record: per-Topic counts, not every item. */
function activityOf(
  { entity, contentKey }: { entity: string; contentKey: string },
  actor: StaffActor,
  subject: ImportSubject,
  mode: ImportMode,
  result: ImportResult,
  now: Date,
): StaffActivity {
  return {
    id: crypto.randomUUID(),
    at: now.toISOString(),
    actor: { email: actor.email, name: actor.name },
    entity,
    entityId: `${subject.exam.code}:${subject.subject.code}`,
    action: "import",
    before: null,
    after: {
      exam: subject.exam.code,
      subject: subject.subject.code,
      mode,
      topics: result.topics.map(({ topicId, contentId, name, created, counts }) => ({
        topicId,
        [contentKey]: contentId,
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

/** How many files are stored at once: enough to keep a big zip quick, few enough for Storage. */
const IMAGES_AT_ONCE = 6;

/** An import's two calls ("Check file" and "Import"), for one kind of import on an arm's store. */
export function importCalls<Subject extends ImportSubject, Fields, Writes extends ImportWrites>(
  importer: ContentImporter<Subject, Fields, Writes>,
  store: ImportStore<Subject, Writes>,
) {
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
    const csv = await store.files.readUpload(csvPath, "import-csv");
    const zip = zipPath ? await store.files.readUpload(zipPath, "import-zip") : null;
    const fieldErrors: Record<string, string[]> = {};
    if (!csv) fieldErrors.csv = ["UPLOAD THE CSV FILE AGAIN"];
    if (zipPath && !zip) {
      fieldErrors.zip = [`UPLOAD THE ZIP OF ${importer.rows.files.toUpperCase()} AGAIN`];
    }
    if (!csv || (zipPath && !zip)) return refused({ kind: "invalid", fieldErrors });
    return { ok: true as const, csv, zip };
  }

  async function plan(actor: StaffActor, input: ImportInput): Promise<AdminResult<ImportPreview>> {
    const begun = await begin(actor, importInputSchema, input);
    if (!begun.ok) return begun;
    const { value, subject } = begun;
    const files = await readFiles(value.csv, value.zip);
    if (!files.ok) return files;
    const existing = importer.existingTopics(subject);
    const { planned } = planFiles(importer.rows, existing, files.csv, files.zip, value.mode);
    const basedOn = basedOnOf(importStateOf(importer, subject), value);
    return { ok: true, value: previewOf(subject, planned, value, basedOn), tags: [] };
  }

  /**
   * Step 4: stores each file, a few at a time, or none: a failure deletes
   * those already stored, once the others under way have finished, and
   * throws.
   */
  async function storeImages(
    unpacked: Map<string, Uint8Array>,
    images: ImportWrites["images"],
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

  async function confirm(
    actor: StaffActor,
    input: ConfirmImportInput,
  ): Promise<AdminResult<ImportResult>> {
    const begun = await begin(actor, confirmImportInputSchema, input);
    if (!begun.ok) return begun;
    const { value, subject } = begun;
    const now = new Date();
    // The preview's Subject, files or mode changed: there's no one save to name, so it names no one.
    const conflict = refused({ kind: "conflict", savedBy: null, savedAt: now.toISOString() });
    const state = importStateOf(importer, subject);
    if (basedOnOf(state, value) !== value.basedOn) return conflict;

    const files = await readFiles(value.csv, value.zip);
    if (!files.ok) return files;
    const existing = importer.existingTopics(subject);
    const { planned, images } = planFiles(
      importer.rows,
      existing,
      files.csv,
      files.zip,
      value.mode,
    );
    if (planned.problems.length > 0) return refused(formError(IMPORT_HAS_PROBLEMS));

    const writes = importer.writesOf(subject, planned, () => crypto.randomUUID(), now);
    await storeImages(images, writes.images);

    const stored = writes.images.map((image) => image.path);
    const activity = activityOf(importer.activity, actor, subject, value.mode, writes.result, now);
    let outcome: "saved" | "conflict";
    try {
      outcome = await store.save(subject, writes, activity, state);
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

  return { plan, confirm };
}
