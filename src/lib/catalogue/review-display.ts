export type ReviewDisplayMode = "marquee" | "grid" | "empty";

/** The fewest Reviews that fill a scrolling marquee. */
const MARQUEE_MIN = 4;

/** Pure: how a list of Reviews shows: a marquee for 4 or more, a grid for 1–3, or the empty message. */
export function reviewDisplayMode(count: number): ReviewDisplayMode {
  if (count >= MARQUEE_MIN) return "marquee";
  return count > 0 ? "grid" : "empty";
}
