// How a card import treats Topics that already have cards (Phase 3, ticket 06;
// story 122). Dependency-free, so the browser's import screen and the Admin
// seam's input schema share it.

/**
 * Replace: cards whose front is unchanged keep their id, and so Members' Card
 * Marks; the rest go. Add: append after the existing cards.
 */
export const IMPORT_MODES = ["replace", "add"] as const;

export type ImportMode = (typeof IMPORT_MODES)[number];
