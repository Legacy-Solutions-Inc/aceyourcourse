import {
  CARD_TEXT_LIMITS,
  cardImageType,
  matchingFront,
  MAX_CARD_IMAGE_BYTES,
  textLength,
} from "@/lib/cards/card-rules";
import { formulaProblem } from "@/lib/formula/check";
import { TOPIC_NAME_MAX } from "@/services/admin.schema";
import type { ContentVisibility } from "@/services/content.types";

import type { CsvSheet } from "./csv";
import type { ImportMode } from "./modes";
import type { ZipListing } from "./zip";

// ─────────────────────────────────────────────────────────────────────────────
// The card import planner (spec, Phase 3 → Spreadsheet import; Testing
// Decisions → Pure modules; stories 118, 120–124, 133p). Pure: the Subject's
// Topics with their cards, the CSV's rows, the zip's listing and the mode in;
// the preview out:
//   - each Topic the CSV names, in order of first appearance: an existing one
//     (matched by name, ignoring case and extra spaces) or one to create,
//     after the existing Topics, with a "did you rename it?" hint when its
//     name is close to an existing Topic's,
//   - the cards to add, replace, keep or remove in each, and
//   - every problem, naming the file, row and column.
// Nothing is saved while there are problems; the Admin seam confirms a plan
// with none, and checks it again first.
// ─────────────────────────────────────────────────────────────────────────────

/** The template's columns, in its order. Each must be in the header row, and no other. */
export const IMPORT_COLUMNS = ["topic", "front", "back", "note", "image"] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

/** The most cards one CSV may hold. */
export const MAX_IMPORT_ROWS = 10_000;

/** Something wrong with the files: where (the file, its row and column, when it has them), and what. */
export interface ImportProblem {
  file: "csv" | "zip";
  /** The spreadsheet's row number (the header is row 1), or null for the whole file. */
  row: number | null;
  column: string | null;
  message: string;
}

/** A card the Subject already has, as a re-import compares it. */
export interface ExistingCard {
  id: string;
  front: string;
  back: string;
  note: string | null;
  /** Where its back image is stored, or null. */
  image: string | null;
}

/** One of the Subject's Topics, with its deck and that deck's cards in order. */
export interface ExistingTopic {
  id: string;
  name: string;
  deck: { id: string; visibility: ContentVisibility } | null;
  cards: ExistingCard[];
}

export interface PlanInput {
  /** The Subject's Topics, in its order. */
  topics: readonly ExistingTopic[];
  csv: CsvSheet;
  /** The zip's listing, or null when no zip was chosen. */
  zip: ZipListing | null;
  mode: ImportMode;
}

/** What importing a row does to its Topic's deck. */
export type CardChange = "add" | "replace" | "keep";

/** A card as the import will save it. */
export interface PlannedCard {
  /** The CSV row it comes from. */
  row: number;
  /** The existing card it keeps or replaces, which keeps its id; null for a new card. */
  cardId: string | null;
  change: CardChange;
  front: string;
  back: string;
  note: string | null;
  /** The back image's path inside the zip, or null. */
  image: string | null;
}

/** How many cards a Topic's import adds, replaces, keeps and removes. */
export interface ImportCounts {
  add: number;
  replace: number;
  keep: number;
  remove: number;
}

/** What the import does to one Topic the CSV names. */
export interface TopicPlan {
  /** The existing Topic's name, or the new one's as first written, with single spaces. */
  name: string;
  /** The existing Topic, or null for one the import creates. */
  topicId: string | null;
  /** For a new Topic: the existing Topic whose name is close to it ("did you rename it?"). */
  similarTo: string | null;
  /** The Topic's deck, or null when the import makes it a new, Hidden one. */
  deck: { id: string; visibility: ContentVisibility } | null;
  /** Replace only when the Topic has cards and the import replaces; otherwise its rows are added. */
  mode: ImportMode;
  /**
   * The cards the import saves: for Replace, the deck's whole new order; for
   * Add, the new cards, which go after the existing ones.
   */
  cards: PlannedCard[];
  /** The existing cards Replace removes. */
  removed: string[];
  counts: ImportCounts;
}

export interface CardImportPlan {
  topics: TopicPlan[];
  problems: ImportProblem[];
}

const LIMITS: Record<Exclude<ImportColumn, "image">, number> = {
  topic: TOPIC_NAME_MAX,
  ...CARD_TEXT_LIMITS,
};

const REQUIRED: readonly ImportColumn[] = ["topic", "front", "back"];

/** The text fields in the formula notation. */
const FORMULA_COLUMNS: readonly ImportColumn[] = ["front", "back", "note"];

const withCommas = (value: number) => value.toLocaleString("en");

/** Pure: a Topic's name as saved: trimmed, with single spaces. */
const topicName = (name: string) => name.trim().replace(/\s+/g, " ");

/** Pure: how names are matched: as saved, ignoring case. */
const topicKey = (name: string) => topicName(name).toLowerCase();

// ── The files ───────────────────────────────────────────────────────────────

/** The header row's problems: a column missing, unknown or there twice. */
function headerProblems(headers: readonly string[]): ImportProblem[] {
  const problems: ImportProblem[] = [];
  const at = (column: string, message: string): ImportProblem => ({
    file: "csv",
    row: 1,
    column,
    message,
  });
  for (const column of IMPORT_COLUMNS) {
    if (!headers.includes(column)) problems.push(at(column, "is missing from the header row"));
  }
  const seen = new Set<string>();
  for (const header of headers) {
    if (header === "") continue;
    if (!(IMPORT_COLUMNS as readonly string[]).includes(header)) {
      problems.push(at(header, `isn’t a column the template has (${IMPORT_COLUMNS.join(", ")})`));
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

// ── Images ──────────────────────────────────────────────────────────────────

/** The last part of a path, with either slash. */
const baseName = (path: string) => path.split(/[/\\]/).pop() ?? path;

/**
 * Where a row's image is in the zip: the file with that path, or else the one
 * file with that name in any folder, ignoring case. The __MACOSX folder a Mac
 * adds holds no images.
 */
function findImage(
  cell: string,
  zip: ZipListing | null,
): { ok: true; entry: string } | { ok: false; message: string } {
  if (!zip) return { ok: false, message: `names “${cell}”, but no zip of images was chosen` };
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

/** A row read into a card, or its problems. */
interface ReadRow {
  row: number;
  /** The Topic's name, when that cell is fine. */
  topic: string | null;
  card: Omit<PlannedCard, "cardId" | "change"> | null;
  problems: ImportProblem[];
}

function readRow(
  row: number,
  cells: readonly string[],
  headers: readonly string[],
  zip: ZipListing | null,
  checkImages: boolean,
): ReadRow {
  const problems: ImportProblem[] = [];
  const problem = (column: string | null, message: string) =>
    problems.push({ file: "csv", row, column, message });
  const cell = (column: ImportColumn) => (cells[headers.indexOf(column)] ?? "").trim();

  if (cells.slice(headers.length).some((extra) => extra.trim() !== "")) {
    problem(
      null,
      "has more cells than the header row has columns (is there a comma outside quotes?)",
    );
  }

  const text: Partial<Record<ImportColumn, string>> = {};
  for (const column of IMPORT_COLUMNS) {
    if (column === "image") continue;
    const value = column === "topic" ? topicName(cell(column)) : cell(column);
    if (value === "") {
      if (REQUIRED.includes(column)) problem(column, "is blank");
      continue;
    }
    const length = textLength(value);
    const limit = LIMITS[column];
    if (length > limit) {
      problem(column, `is ${withCommas(length)} characters; keep it to ${withCommas(limit)}`);
      continue;
    }
    const formula = FORMULA_COLUMNS.includes(column) ? formulaProblem(value) : null;
    if (formula) {
      problem(column, formula);
      continue;
    }
    text[column] = value;
  }

  let image: string | null = null;
  const imageCell = cell("image");
  if (imageCell !== "" && checkImages) {
    const found = findImage(imageCell, zip);
    if (found.ok) image = found.entry;
    else problem("image", found.message);
  }

  const { topic = null, front, back, note = null } = text;
  const card =
    problems.length === 0 && front !== undefined && back !== undefined
      ? { row, front, back, note, image }
      : null;
  return { row, topic, card, problems };
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
function similarTopic(name: string, topics: readonly ExistingTopic[]): string | null {
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

/** Pure: what keeping or replacing an existing card with a row does. */
function changeOf(
  card: Omit<PlannedCard, "cardId" | "change">,
  existing: ExistingCard,
): CardChange {
  const same =
    card.front === existing.front &&
    card.back === existing.back &&
    card.note === existing.note &&
    card.image === null &&
    existing.image === null;
  return same ? "keep" : "replace";
}

/**
 * Pure: a Topic's cards under Replace. Each row takes the first existing card
 * with the same front (trimmed, single spaces, case kept) that no earlier row
 * took; the cards no row took are removed.
 */
function replaced(rows: readonly ReadRow[], existing: readonly ExistingCard[]) {
  const taken = new Set<string>();
  const cards = rows.flatMap(({ card }): PlannedCard[] => {
    if (!card) return [];
    const match = existing.find(
      (candidate) =>
        !taken.has(candidate.id) && matchingFront(candidate.front) === matchingFront(card.front),
    );
    if (!match) return [{ ...card, cardId: null, change: "add" }];
    taken.add(match.id);
    return [{ ...card, cardId: match.id, change: changeOf(card, match) }];
  });
  const removed = existing.filter((card) => !taken.has(card.id)).map((card) => card.id);
  return { cards, removed };
}

function planTopic(
  name: string,
  rows: readonly ReadRow[],
  existing: ExistingTopic | undefined,
  topics: readonly ExistingTopic[],
  mode: ImportMode,
): TopicPlan {
  const hadCards = existing?.cards ?? [];
  const replacing = mode === "replace" && hadCards.length > 0;
  const { cards, removed } = replacing
    ? replaced(rows, hadCards)
    : {
        cards: rows.flatMap(({ card }): PlannedCard[] =>
          card ? [{ ...card, cardId: null, change: "add" }] : [],
        ),
        removed: [],
      };
  const count = (change: CardChange) => cards.filter((card) => card.change === change).length;
  return {
    name: existing?.name ?? name,
    topicId: existing?.id ?? null,
    similarTo: existing ? null : similarTopic(name, topics),
    deck: existing?.deck ?? null,
    mode: replacing ? "replace" : "add",
    cards,
    removed,
    counts: {
      add: count("add"),
      replace: count("replace"),
      keep: replacing ? count("keep") : hadCards.length,
      remove: removed.length,
    },
  };
}

/** Pure: the import's plan and problems. A file problem stops the rows from being read. */
export function planCardImport({ topics, csv, zip, mode }: PlanInput): CardImportPlan {
  const headers = headerProblems(csv.headers);
  if (headers.length > 0) return { topics: [], problems: headers };
  const whole = (message: string): CardImportPlan => ({
    topics: [],
    problems: [{ file: "csv", row: null, column: null, message }],
  });
  if (csv.rows.length === 0)
    return whole("has no cards: add one row per card under the header row");
  if (csv.rows.length > MAX_IMPORT_ROWS) {
    return whole(`has more than ${withCommas(MAX_IMPORT_ROWS)} cards: split it into smaller files`);
  }

  const fromZip = zip ? zipProblems(zip) : [];
  const rows = csv.rows.map(({ row, cells }) =>
    readRow(row, cells, csv.headers, zip, fromZip.length === 0),
  );

  // Each Topic named, in order of first appearance, with its rows.
  const named = new Map<string, { name: string; rows: ReadRow[] }>();
  for (const row of rows) {
    if (row.topic === null) continue;
    const key = topicKey(row.topic);
    const entry = named.get(key) ?? { name: row.topic, rows: [] };
    entry.rows.push(row);
    named.set(key, entry);
  }
  const byKey = new Map(topics.map((topic) => [topicKey(topic.name), topic]));
  const planned = [...named].map(([key, { name, rows: topicRows }]) =>
    planTopic(name, topicRows, byKey.get(key), topics, mode),
  );

  return { topics: planned, problems: [...fromZip, ...rows.flatMap((row) => row.problems)] };
}
