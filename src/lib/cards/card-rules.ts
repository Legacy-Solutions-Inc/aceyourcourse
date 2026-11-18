// ─────────────────────────────────────────────────────────────────────────────
// A flashcard's rules (spec, Phase 3 → Content model; story 118): front text,
// a back, an optional note, each in the formula notation, and an optional
// back image. Pure and dependency-free, so the import planner, the card
// editor (ticket 07) and the upload seam's shared rules
// judge a card the same way, and the cards table checks the same limits.
// ─────────────────────────────────────────────────────────────────────────────

/** The longest each text field may be, in characters. */
export const CARD_TEXT_LIMITS = { front: 500, back: 2000, note: 1000 } as const;

/** The biggest back image: 5 MB. */
export const MAX_CARD_IMAGE_BYTES = 5 * 1024 * 1024;

/** The image types a card's back image may be, by file extension. */
const IMAGE_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export type CardImageType = (typeof IMAGE_TYPES)[keyof typeof IMAGE_TYPES];

/** The image types a card's back image may be. */
export const CARD_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const satisfies readonly CardImageType[];

/** Each image type's file extension, for the path it's stored at. */
export const CARD_IMAGE_EXTENSIONS: Record<CardImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const WRONG_IMAGE_TYPE = "USE A JPEG, PNG OR WEBP IMAGE";
export const IMAGE_TOO_BIG = "KEEP THE IMAGE TO 5 MB";
export const EMPTY_IMAGE = "THE IMAGE FILE IS EMPTY";

/**
 * Pure: why a file can't be a card's back image, by its type and size, or
 * null when it can (the card editor, ticket 07): a JPEG, PNG or WebP of at
 * most 5 MB. The browser checks before uploading, and the upload seam again.
 */
export function cardImageProblem({ type, size }: { type: string; size: number }): string | null {
  if (!isCardImageType(type)) return WRONG_IMAGE_TYPE;
  if (size <= 0) return EMPTY_IMAGE;
  return size > MAX_CARD_IMAGE_BYTES ? IMAGE_TOO_BIG : null;
}

/**
 * Pure: where a card's back image is stored in the private content bucket:
 * under its deck, as a new file each time, so a stored image is never
 * overwritten. The card import (ticket 06) and the card editor (ticket 07)
 * both store images here.
 */
export const cardImagePath = (deckId: string, fileId: string, type: CardImageType) =>
  `decks/${deckId}/${fileId}.${CARD_IMAGE_EXTENSIONS[type]}`;

/** Pure: whether a type is one a card's back image may be. */
export const isCardImageType = (type: string): type is CardImageType =>
  Object.hasOwn(CARD_IMAGE_EXTENSIONS, type);

/** Pure: a file's image type from its name, or null when it isn't a JPEG, PNG or WebP. */
export function cardImageType(filename: string): CardImageType | null {
  const extension = /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase() ?? "";
  return Object.hasOwn(IMAGE_TYPES, extension)
    ? IMAGE_TYPES[extension as keyof typeof IMAGE_TYPES]
    : null;
}

/** Pure: text's length in characters, as Postgres's char_length counts them (an emoji is one). */
export const textLength = (text: string) => [...text].length;

/**
 * Pure: the front text a re-import matches cards by: trimmed, with each run
 * of whitespace as one space, and case kept. A card whose front matches keeps
 * its id, and so every Member's Card Mark on it.
 */
export const matchingFront = (front: string) => front.trim().replace(/\s+/g, " ");
