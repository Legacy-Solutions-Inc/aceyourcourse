import { IMPORT_FILES } from "@/lib/content-import/limits";
import type { ImportKind } from "@/lib/content-import/modes";
import type { ImportProblem } from "@/lib/content-import/plan";
import { paths } from "@/paths";
import type { ImportPreview, ImportTopicPreview } from "@/services/admin.types";

// The import screen's pure view helpers (Phase 3, tickets 06 and 09): what
// each kind of import calls its rows and their deck or quiz, what the preview
// says, and the browser's check of a chosen file before it uploads. The
// server checks everything again.

/** How an import's screen names what it brings in, and where a Topic's deck or quiz opens. */
export interface ImportWords {
  /** One row's item, and more than one: "card", "cards". */
  item: { one: string; many: string };
  /** What a Topic's items are in, and more than one: "deck", "decks". */
  content: string;
  contents: string;
  /** What the zip holds: "images", "figures". */
  files: string;
  /** The Admin screen of a Topic's deck or quiz. */
  contentScreen: (topicId: string) => string;
}

export const IMPORT_WORDS: Record<ImportKind, ImportWords> = {
  cards: {
    item: { one: "card", many: "cards" },
    content: "deck",
    contents: "decks",
    files: "images",
    contentScreen: (topicId) => paths.admin.deck(topicId),
  },
  quizzes: {
    item: { one: "question", many: "questions" },
    content: "quiz",
    contents: "quizzes",
    files: "figures",
    contentScreen: paths.admin.quiz,
  },
};

/** Pure: where a Topic's rows go, as its row says it: "NEW QUIZ · HIDDEN", "DECK · VISIBLE". */
export function importContentLabel(
  kind: ImportKind,
  content: ImportTopicPreview["content"],
): string {
  const name = IMPORT_WORDS[kind].content.toUpperCase();
  return content === "new" ? `NEW ${name} · HIDDEN` : `${name} · ${content.toUpperCase()}`;
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString("en")} ${count === 1 ? one : many}`;

/**
 * Pure: the preview's totals: the file's items (added, replaced or kept as
 * they were; the existing items Add keeps aren't the file's), in how many
 * Topics, how many Topics are new, and how many items Replace takes out.
 */
export function importTotals(kind: ImportKind, { topics }: Pick<ImportPreview, "topics">): string {
  const { one, many } = IMPORT_WORDS[kind].item;
  if (topics.length === 0) return `No ${many} to import`;
  const sum = (pick: (topic: ImportTopicPreview) => number) =>
    topics.reduce((total, topic) => total + pick(topic), 0);
  const saved = sum(
    ({ mode, counts }) => counts.add + counts.replace + (mode === "replace" ? counts.keep : 0),
  );
  const created = topics.filter((topic) => topic.topicId === null).length;
  const removed = sum(({ counts }) => counts.remove);
  return [
    `${plural(saved, one, many)} in ${plural(topics.length, "Topic")}`,
    created > 0 ? plural(created, "new Topic") : null,
    removed > 0 ? `${plural(removed, one, many)} removed` : null,
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
  which: "csv" | "zip",
  kind: ImportKind,
): string | null {
  const { extension, max, tooBig } = IMPORT_FILES[which];
  if (!file.name.toLowerCase().endsWith(`.${extension}`)) {
    return which === "csv"
      ? "CHOOSE A .CSV FILE (IN SHEETS OR EXCEL: DOWNLOAD AS CSV)"
      : `CHOOSE A .ZIP FILE OF ${IMPORT_WORDS[kind].files.toUpperCase()}`;
  }
  if (file.size <= 0) return "THE FILE IS EMPTY";
  return file.size > max ? tooBig : null;
}
