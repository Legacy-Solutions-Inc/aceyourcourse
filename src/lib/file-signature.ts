// What a file's first bytes say it is (the upload seam's sample route, and the
// card import before it stores an image from a zip). Pure.

/** The types checked, and their first bytes. WebP is RIFF, a 4-byte length, then WEBP; a zip starts PK; a PDF %PDF-. */
const SIGNATURES = {
  "image/jpeg": [{ at: 0, bytes: [0xff, 0xd8, 0xff] }],
  "image/png": [{ at: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }],
  "image/webp": [
    { at: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
    { at: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  ],
  "application/zip": [{ at: 0, bytes: [0x50, 0x4b] }],
  // %PDF-
  "application/pdf": [{ at: 0, bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }],
  // Text, with no signature.
  "text/csv": [],
} satisfies Record<string, { at: number; bytes: number[] }[]>;

export type SignedType = keyof typeof SIGNATURES;

/** Pure: whether the file starts as a file of this type does. A CSV, being text, always does. */
export function hasFileSignature(bytes: Uint8Array, type: SignedType): boolean {
  return SIGNATURES[type].every(({ at, bytes: expected }) =>
    expected.every((byte, index) => bytes[at + index] === byte),
  );
}
