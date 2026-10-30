/** Pure: cut at a word boundary so the result, with its "…", is at most `max` long. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const atWord = cut.slice(0, Math.max(cut.lastIndexOf(" "), 1));
  return `${atWord.trimEnd()}…`;
}
