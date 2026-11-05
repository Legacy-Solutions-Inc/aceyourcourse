/** The most Exam tiles in one row. */
const ROW_MAX = 6;

/**
 * Pure: how many columns a grid of Exam tiles has (ticket 23; the Website is
 * built for 1–12 Exams): every Exam in one row up to 6, then two balanced
 * rows, so 12 shows as 6 + 6 and 7 as 4 + 3.
 */
export function examGridColumns(count: number): number {
  if (count <= ROW_MAX) return Math.max(count, 1);
  return Math.ceil(count / 2);
}

/**
 * Pure: the grid-template-columns for `count` Exam tiles: examGridColumns'
 * columns, wrapping to fewer on a screen too narrow for tiles of `min`.
 */
export function examGridTemplate(count: number, { min, gap }: { min: string; gap: string }) {
  const columns = examGridColumns(count);
  return `repeat(auto-fill, minmax(max(${min}, calc((100% - ${columns - 1} * ${gap}) / ${columns})), 1fr))`;
}
