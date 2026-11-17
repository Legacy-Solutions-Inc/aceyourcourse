import { IMPORT_FILES } from "@/lib/card-import/limits";
import type { ImportProblem } from "@/lib/card-import/plan";
import type { CardImportPreview, CardImportTopic } from "@/services/admin.types";

// The card import screen's pure view helpers (Phase 3, ticket 06): what the
// preview says, and the browser's check of a chosen file before it uploads.
// The server checks everything again.

/** Pure: where a Topic's cards go, as its row says it. */
export function importDeckLabel(deck: CardImportTopic["deck"]): string {
  return deck === "new" ? "NEW DECK · HIDDEN" : `DECK · ${deck.toUpperCase()}`;
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString("en")} ${count === 1 ? one : many}`;

/**
 * Pure: the preview's totals: the file's cards (added, replaced or kept as
 * they were; the existing cards Add keeps aren't the file's), in how many
 * Topics, how many Topics are new, and how many cards Replace removes.
 */
export function importTotals({ topics }: Pick<CardImportPreview, "topics">): string {
  if (topics.length === 0) return "No cards to import";
  const sum = (pick: (topic: CardImportTopic) => number) =>
    topics.reduce((total, topic) => total + pick(topic), 0);
  const saved = sum(
    ({ mode, counts }) => counts.add + counts.replace + (mode === "replace" ? counts.keep : 0),
  );
  const created = topics.filter((topic) => topic.topicId === null).length;
  const removed = sum(({ counts }) => counts.remove);
  return [
    `${plural(saved, "card")} in ${plural(topics.length, "Topic")}`,
    created > 0 ? plural(created, "new Topic") : null,
    removed > 0 ? `${plural(removed, "card")} removed` : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

/** Pure: where a problem is, as the problems table says it: "CSV · ROW 4 · BACK". */
export function importProblemPlace({ file, row, column }: ImportProblem): string {
  const where = [file.toUpperCase()];
  if (row !== null) where.push(row === 1 ? "HEADER ROW" : `ROW ${row}`);
  if (column !== null) where.push(column.toUpperCase());
  return where.join(" · ");
}

/** Pure: why a chosen file can't be uploaded as the import's CSV or zip, or null when it can. */
export function importFileProblem(
  file: { name: string; size: number },
  kind: "csv" | "zip",
): string | null {
  const { extension, max, tooBig } = IMPORT_FILES[kind];
  if (!file.name.toLowerCase().endsWith(`.${extension}`)) {
    return kind === "csv"
      ? "CHOOSE A .CSV FILE (IN SHEETS OR EXCEL: DOWNLOAD AS CSV)"
      : "CHOOSE A .ZIP FILE OF IMAGES";
  }
  if (file.size <= 0) return "THE FILE IS EMPTY";
  return file.size > max ? tooBig : null;
}
