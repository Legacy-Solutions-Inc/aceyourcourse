import { cardImageType, MAX_CARD_IMAGE_BYTES, textLength } from "@/lib/cards/card-rules";
import { formulaProblem } from "@/lib/formula/check";
import { TOPIC_NAME_MAX } from "@/services/admin.schema";
import type { ContentVisibility } from "@/services/content.types";

import type { CsvSheet } from "./csv";
import type { ImportMode } from "./modes";
import type { ZipListing } from "./zip";

// ─────────────────────────────────────────────────────────────────────────────
// The import planner (spec, Phase 3 → Spreadsheet import; Testing Decisions →
// Pure modules; stories 118–124, 133l, 133p), shared by the card import
// (ticket 06, cards.ts) and the quiz import (ticket 09, quizzes.ts). Pure: a
// kind of row (ImportRows: its columns and how one row reads), the Subject's
// Topics with what they already hold, the CSV's rows, the zip's listing and
// the mode in; the preview out:
//   - each Topic the CSV names, in order of first appearance: an existing one
//     (matched by name, ignoring case and extra spaces) or one to create,
//     after the existing Topics, with a "did you rename it?" hint when its
//     name is close to an existing Topic's,
//   - the items (cards or questions) to add, replace, keep or remove in each,
//   - every problem, naming the file, row and column.
// Nothing is saved while there are problems; the Admin seam confirms a plan
// with none, and checks it again first.
// ─────────────────────────────────────────────────────────────────────────────

/** The most rows one CSV may hold. */
export const MAX_IMPORT_ROWS = 10_000;

/** Something wrong with the files: where (the file, its row and column, when it has them), and what. */
export interface ImportProblem {
  file: "csv" | "zip";
  /** The spreadsheet's row number (the header is row 1), or null for the whole file. */
  row: number | null;
  column: string | null;
  message: string;
}

/** A row's own fields, as its kind reads them, or each problem with its column. */
export interface RowRead<Fields> {
  /** The fields, when every cell is fine; otherwise null. */
  fields: Fields | null;
  problems: { column: string; message: string }[];
}

/**
 * A kind of row an import reads: a flashcard (cards.ts) or a quiz question
 * (quizzes.ts). Every kind has a "topic" column, which the planner reads, and
 * a column naming a file in the zip (a card's back image, a question's
 * figure), which it finds; the kind reads the rest.
 */
export interface ImportRows<Fields> {
  /** The template's columns, in its order: "topic" first. Each must be in the header row, and no other. */
  columns: readonly string[];
  /** The column naming the row's file in the zip, which may be blank. */
  fileColumn: string;
  /** What one row is, in messages: "card" and "cards". */
  item: { one: string; many: string };
  /** What the zip holds, in messages: "images" or "figures". */
  files: string;
  /** Reads a row's own cells (each trimmed) into its fields. */
  read(cell: (column: string) => string): RowRead<Fields>;
  /** What Replace matches an existing item by, from its fields. */
  matchKey(fields: Fields): string;
  /** Whether two items' fields are the same. */
  sameFields(a: Fields, b: Fields): boolean;
}

/** An item a Topic already has, as a re-import compares it. */
export type ExistingItem<Fields> = Fields & {
  id: string;
  /** Where its file (back image or figure) is stored, or null. */
  image: string | null;
};

/** The deck or quiz a Topic's items are in: Hidden or Visible. */
export interface ImportContent {
  id: string;
  visibility: ContentVisibility;
}

/** One of the Subject's Topics, with its deck or quiz and that one's items in order. */
export interface ExistingTopic<Fields> {
  id: string;
  name: string;
  content: ImportContent | null;
  items: ExistingItem<Fields>[];
}

export interface PlanInput<Fields> {
  /** The Subject's Topics, in its order. */
  topics: readonly ExistingTopic<Fields>[];
  csv: CsvSheet;
  /** The zip's listing, or null when no zip was chosen. */
  zip: ZipListing | null;
  mode: ImportMode;
}

/** What importing a row does to its Topic's deck or quiz. */
export type ItemChange = "add" | "replace" | "keep";

/** An item as the import will save it. */
export type PlannedItem<Fields> = Fields & {
  /** The CSV row it comes from. */
  row: number;
  /** The existing item it keeps or replaces, which keeps its id; null for a new one. */
  existingId: string | null;
  change: ItemChange;
  /** Its file's path inside the zip, or null. */
  image: string | null;
};

/** How many items a Topic's import adds, replaces, keeps and removes. */
export interface ImportCounts {
  add: number;
  replace: number;
  keep: number;
  remove: number;
}

/** What the import does to one Topic the CSV names. */
export interface TopicPlan<Fields> {
  /** The existing Topic's name, or the new one's as first written, with single spaces. */
  name: string;
  /** The existing Topic, or null for one the import creates. */
  topicId: string | null;
  /** For a new Topic: the existing Topic whose name is close to it ("did you rename it?"). */
  similarTo: string | null;
  /** The Topic's deck or quiz, or null when the import makes it a new, Hidden one. */
  content: ImportContent | null;
  /** Replace only when the Topic has items and the import replaces; otherwise its rows are added. */
  mode: ImportMode;
  /**
   * The items the import saves: for Replace, the whole new order; for Add,
   * the new items, which go after the existing ones.
   */
  items: PlannedItem<Fields>[];
  /** The existing items Replace takes out. */
  removed: string[];
  counts: ImportCounts;
}

export interface ImportPlan<Fields> {
  topics: TopicPlan<Fields>[];
  problems: ImportProblem[];
}

const withCommas = (value: number) => value.toLocaleString("en");

/** Pure: a Topic's name as saved: trimmed, with single spaces. */
const topicName = (name: string) => name.trim().replace(/\s+/g, " ");

/** Pure: how names are matched: as saved, ignoring case. */
const topicKey = (name: string) => topicName(name).toLowerCase();

// ── A kind's cells ──────────────────────────────────────────────────────────

/** How one text cell is judged: whether it may be blank, its longest length, and its message when blank. */
export interface TextCellRule {
  required: boolean;
  limit: number;
  /** What a blank required cell says; "is blank" unless given. */
  blank?: string;
}

/**
 * Pure: text cells in the formula notation, each judged by its rule: blank
 * (only an optional one may be), over its length as Postgres counts
 * characters, or a formula that won't render. Gives the text of each cell
 * that's fine and isn't blank, and each problem, in the rules' order.
 */
export function readTextCells<Column extends string>(
  cell: (column: string) => string,
  rules: Record<Column, TextCellRule>,
): { text: Partial<Record<Column, string>>; problems: RowRead<unknown>["problems"] } {
  const text: Partial<Record<Column, string>> = {};
  const problems: RowRead<unknown>["problems"] = [];
  for (const [column, rule] of Object.entries(rules) as [Column, TextCellRule][]) {
    const value = cell(column);
    if (value === "") {
      if (rule.required) problems.push({ column, message: rule.blank ?? "is blank" });
      continue;
    }
    const length = textLength(value);
    if (length > rule.limit) {
      const message = `is ${withCommas(length)} characters; keep it to ${withCommas(rule.limit)}`;
      problems.push({ column, message });
      continue;
    }
    const formula = formulaProblem(value);
    if (formula) {
      problems.push({ column, message: formula });
      continue;
    }
    text[column] = value;
  }
  return { text, problems };
}

// ── The files ───────────────────────────────────────────────────────────────

/** The header row's problems: a column missing, unknown or there twice. */
function headerProblems(columns: readonly string[], headers: readonly string[]): ImportProblem[] {
  const problems: ImportProblem[] = [];
  const at = (column: string, message: string): ImportProblem => ({
    file: "csv",
    row: 1,
    column,
    message,
  });
  for (const column of columns) {
    if (!headers.includes(column)) problems.push(at(column, "is missing from the header row"));
  }
  const seen = new Set<string>();
  for (const header of headers) {
    if (header === "") continue;
    if (!columns.includes(header)) {
      problems.push(at(header, `isn’t a column the template has (${columns.join(", ")})`));
    } else if (seen.has(header)) {
      problems.push(at(header, "is in the header row twice"));
    }
    seen.add(header);
  }
  return problems;
}

/** Pure: whether a path in the zip climbs out of it (".."), or starts at a root or a drive. */
function outsideFolder(name: string): boolean {
  return /^[/\\]/.test(name) || /^[A-Za-z]:/.test(name) || name.split(/[/\\]/).includes("..");
}

/** The zip's own problems: files that climb out of its folder (refused, not skipped). */
function zipProblems(zip: ZipListing): ImportProblem[] {
  const outside = zip.entries.filter((entry) => outsideFolder(entry.name)).map((e) => e.name);
  if (outside.length === 0) return [];
  const named = outside.slice(0, 3).join(", ");
  const more = outside.length > 3 ? ` and ${outside.length - 3} more` : "";
  return [
    {
      file: "zip",
      row: null,
      column: null,
      message: `has files outside its folder, which isn’t allowed: ${named}${more}`,
    },
  ];
}

// ── Files in the zip ────────────────────────────────────────────────────────

/** The last part of a path, with either slash. */
const baseName = (path: string) => path.split(/[/\\]/).pop() ?? path;

/**
 * Where a row's file is in the zip: the file with that path, or else the one
 * file with that name in any folder, ignoring case. It must be a JPEG, PNG or
 * WebP of at most 5 MB, a card image's rules, which a quiz figure shares. The
 * __MACOSX folder a Mac adds holds no images.
 */
function findImage(
  cell: string,
  zip: ZipListing | null,
  files: string,
): { ok: true; entry: string } | { ok: false; message: string } {
  if (!zip) return { ok: false, message: `names “${cell}”, but no zip of ${files} was chosen` };
  const images = zip.entries.filter((entry) => !entry.name.startsWith("__MACOSX/"));
  const wanted = cell.toLowerCase();
  const byPath = images.filter((entry) => entry.name.toLowerCase() === wanted);
  const matches = byPath.length
    ? byPath
    : images.filter((entry) => baseName(entry.name).toLowerCase() === baseName(wanted));
  const [entry] = matches;
  if (!entry) return { ok: false, message: `“${cell}” isn’t in the zip` };
  if (matches.length > 1) return { ok: false, message: `“${cell}” is in the zip more than once` };
  if (!cardImageType(entry.name)) {
    return { ok: false, message: `“${cell}” isn’t a JPEG, PNG or WebP image` };
  }
  if (entry.size > MAX_CARD_IMAGE_BYTES) return { ok: false, message: `“${cell}” is over 5 MB` };
  return { ok: true, entry: entry.name };
}

// ── Rows ────────────────────────────────────────────────────────────────────

/** A row read into an item, or its problems. */
interface ReadRow<Fields> {
  row: number;
  /** The Topic's name, when that cell is fine. */
  topic: string | null;
  item: (Fields & { row: number; image: string | null }) | null;
  problems: ImportProblem[];
}

function readRow<Fields>(
  kind: ImportRows<Fields>,
  { row, cells }: CsvSheet["rows"][number],
  headers: readonly string[],
  zip: ZipListing | null,
  checkImages: boolean,
): ReadRow<Fields> {
  const problems: ImportProblem[] = [];
  const problem = (column: string | null, message: string) =>
    problems.push({ file: "csv", row, column, message });
  const cell = (column: string) => (cells[headers.indexOf(column)] ?? "").trim();

  if (cells.slice(headers.length).some((extra) => extra.trim() !== "")) {
    problem(
      null,
      "has more cells than the header row has columns (is there a comma outside quotes?)",
    );
  }

  let topic: string | null = null;
  const name = topicName(cell("topic"));
  if (name === "") problem("topic", "is blank");
  else if (textLength(name) > TOPIC_NAME_MAX) {
    problem(
      "topic",
      `is ${withCommas(textLength(name))} characters; keep it to ${withCommas(TOPIC_NAME_MAX)}`,
    );
  } else topic = name;

  const read = kind.read(cell);
  for (const { column, message } of read.problems) problem(column, message);

  let image: string | null = null;
  const imageCell = cell(kind.fileColumn);
  if (imageCell !== "" && checkImages) {
    const found = findImage(imageCell, zip, kind.files);
    if (found.ok) image = found.entry;
    else problem(kind.fileColumn, found.message);
  }

  const item = problems.length === 0 && read.fields ? { ...read.fields, row, image } : null;
  return { row, topic, item, problems };
}

// ── Topics ──────────────────────────────────────────────────────────────────

/** Pure: how many single-character edits turn one string into the other. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const swap = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      current.push(Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, swap));
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** Names this close count as "did you rename it?": the same ignoring spaces, or within two edits. */
const SIMILAR_EDITS = 2;
/** Shorter names are too alike to hint at. */
const SIMILAR_MIN_LENGTH = 4;

/** Pure: the existing Topic whose name is closest to a new one, when it's close enough to ask about. */
function similarTopic(name: string, topics: readonly { name: string }[]): string | null {
  const squash = (value: string) => value.toLowerCase().replace(/\s+/g, "");
  const wanted = squash(name);
  let best: { name: string; distance: number } | null = null;
  for (const topic of topics) {
    const other = squash(topic.name);
    if (Math.min(wanted.length, other.length) < SIMILAR_MIN_LENGTH) continue;
    const distance = editDistance(wanted, other);
    if (distance <= SIMILAR_EDITS && (!best || distance < best.distance)) {
      best = { name: topic.name, distance };
    }
  }
  return best?.name ?? null;
}

/**
 * Pure: a Topic's items under Replace. Each row takes the first existing item
 * with the same match key that no earlier row took; the items no row took are
 * removed. A row keeps its item only when every field is the same and neither
 * has a file (a file in the zip is always stored again).
 */
function replaced<Fields>(
  kind: ImportRows<Fields>,
  rows: readonly ReadRow<Fields>[],
  existing: readonly ExistingItem<Fields>[],
) {
  const taken = new Set<string>();
  const items = rows.flatMap(({ item }): PlannedItem<Fields>[] => {
    if (!item) return [];
    const match = existing.find(
      (candidate) => !taken.has(candidate.id) && kind.matchKey(candidate) === kind.matchKey(item),
    );
    if (!match) return [{ ...item, existingId: null, change: "add" }];
    taken.add(match.id);
    const same = kind.sameFields(item, match) && item.image === null && match.image === null;
    return [{ ...item, existingId: match.id, change: same ? "keep" : "replace" }];
  });
  const removed = existing.filter((item) => !taken.has(item.id)).map((item) => item.id);
  return { items, removed };
}

function planTopic<Fields>(
  kind: ImportRows<Fields>,
  name: string,
  rows: readonly ReadRow<Fields>[],
  existing: ExistingTopic<Fields> | undefined,
  topics: readonly ExistingTopic<Fields>[],
  mode: ImportMode,
): TopicPlan<Fields> {
  const had = existing?.items ?? [];
  const replacing = mode === "replace" && had.length > 0;
  const { items, removed } = replacing
    ? replaced(kind, rows, had)
    : {
        items: rows.flatMap(({ item }): PlannedItem<Fields>[] =>
          item ? [{ ...item, existingId: null, change: "add" }] : [],
        ),
        removed: [],
      };
  const count = (change: ItemChange) => items.filter((item) => item.change === change).length;
  return {
    name: existing?.name ?? name,
    topicId: existing?.id ?? null,
    similarTo: existing ? null : similarTopic(name, topics),
    content: existing?.content ?? null,
    mode: replacing ? "replace" : "add",
    items,
    removed,
    counts: {
      add: count("add"),
      replace: count("replace"),
      keep: replacing ? count("keep") : had.length,
      remove: removed.length,
    },
  };
}

/** Pure: the import's plan and problems. A file problem stops the rows from being read. */
export function planImport<Fields>(
  kind: ImportRows<Fields>,
  { topics, csv, zip, mode }: PlanInput<Fields>,
): ImportPlan<Fields> {
  const headers = headerProblems(kind.columns, csv.headers);
  if (headers.length > 0) return { topics: [], problems: headers };
  const whole = (message: string): ImportPlan<Fields> => ({
    topics: [],
    problems: [{ file: "csv", row: null, column: null, message }],
  });
  const { one, many } = kind.item;
  if (csv.rows.length === 0) {
    return whole(`has no ${many}: add one row per ${one} under the header row`);
  }
  if (csv.rows.length > MAX_IMPORT_ROWS) {
    return whole(
      `has more than ${withCommas(MAX_IMPORT_ROWS)} ${many}: split it into smaller files`,
    );
  }

  const fromZip = zip ? zipProblems(zip) : [];
  const rows = csv.rows.map((row) => readRow(kind, row, csv.headers, zip, fromZip.length === 0));

  // Each Topic named, in order of first appearance, with its rows.
  const named = new Map<string, { name: string; rows: ReadRow<Fields>[] }>();
  for (const row of rows) {
    if (row.topic === null) continue;
    const key = topicKey(row.topic);
    const entry = named.get(key) ?? { name: row.topic, rows: [] };
    entry.rows.push(row);
    named.set(key, entry);
  }
  const byKey = new Map(topics.map((topic) => [topicKey(topic.name), topic]));
  const planned = [...named].map(([key, { name, rows: topicRows }]) =>
    planTopic(kind, name, topicRows, byKey.get(key), topics, mode),
  );

  return { topics: planned, problems: [...fromZip, ...rows.flatMap((row) => row.problems)] };
}
