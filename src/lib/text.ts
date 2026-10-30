/** Pure: cut at a word boundary so the result, with its "…", is at most `max` long. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const atWord = cut.slice(0, Math.max(cut.lastIndexOf(" "), 1));
  return `${atWord.trimEnd()}…`;
}

/** Pure: a list item's number as shown beside it, from a zero-based index: 0 → "01". */
export function listNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}
