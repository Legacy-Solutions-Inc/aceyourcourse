// What an import brings in, and how it treats Topics that already have some
// (Phase 3, tickets 06 and 09; story 122). Dependency-free, so the browser's
// import screen, its address and the Admin seam's input schema share them.

/** What a spreadsheet import brings in: flashcards (ticket 06) or quiz questions (ticket 09). */
export const IMPORT_KINDS = ["cards", "quizzes"] as const;

export type ImportKind = (typeof IMPORT_KINDS)[number];

/**
 * Replace: cards whose front, or questions whose text, is unchanged keep
 * their id, and so Members' Card Marks and quiz attempts; the rest go (a
 * removed question is kept, marked removed, for old attempts). Add: append
 * after the existing ones.
 */
export const IMPORT_MODES = ["replace", "add"] as const;

export type ImportMode = (typeof IMPORT_MODES)[number];
