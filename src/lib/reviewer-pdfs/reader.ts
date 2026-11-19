// The Reviewer PDF reader's rules (Phase 3, ticket 14; spec, Phase 3 →
// Reviewer PDF reader, and Phase 3 planning decisions → Resume), pure: one
// page at a time, zoomed in the browser from 75% to 150% in 25% steps, and
// reopened at the page and zoom the Member left it at.

/** The zooms the reader offers, smallest first. */
export const READER_ZOOMS = [75, 100, 125, 150] as const;

export type ReaderZoom = (typeof READER_ZOOMS)[number];

/** Where a Reviewer PDF opens the first time. */
export const DEFAULT_ZOOM: ReaderZoom = 100;

/** Where a Member is in a Reviewer PDF: the page (from 1) and the zoom. */
export interface ReaderPlace {
  page: number;
  zoom: ReaderZoom;
}

/**
 * How long a Member's own browser may keep a stamped page, in seconds: long
 * enough that paging back and forth doesn't stamp it again, short enough that
 * no copy lingers. Never a shared cache's (spec, Phase 3 → Burned-in watermark).
 */
export const PAGE_CACHE_SECONDS = 300;

/** Pure: whether a number is one of the reader's zooms. */
export const isReaderZoom = (value: number): value is ReaderZoom =>
  (READER_ZOOMS as readonly number[]).includes(value);

/** Pure: the next zoom up, or this one at 150%. */
export function zoomIn(zoom: ReaderZoom): ReaderZoom {
  return READER_ZOOMS[READER_ZOOMS.indexOf(zoom) + 1] ?? zoom;
}

/** Pure: the next zoom down, or this one at 75%. */
export function zoomOut(zoom: ReaderZoom): ReaderZoom {
  return READER_ZOOMS[READER_ZOOMS.indexOf(zoom) - 1] ?? zoom;
}

/**
 * Pure: where a Reviewer PDF of `pageCount` pages (at least 1) opens: where
 * the Member left it, or page 1 at 100% the first time.
 */
export function openingPlace(left: ReaderPlace | null, pageCount: number): ReaderPlace {
  if (!left) return { page: 1, zoom: DEFAULT_ZOOM };
  return { page: Math.min(Math.max(left.page, 1), pageCount), zoom: left.zoom };
}

/**
 * Pure: a page number as an address gives it ("1", "36"), or null for
 * anything else: no sign, no leading zero, no fraction, at most six digits.
 */
export function pageFromAddress(text: string): number | null {
  return /^[1-9]\d{0,5}$/.test(text) ? Number(text) : null;
}
