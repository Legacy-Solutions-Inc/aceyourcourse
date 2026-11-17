import { createHash } from "node:crypto";

/**
 * Pure: a UUID made from `text`, the same every time and on every restart:
 * SHA-256, shaped as a version 4 UUID, which is what a Supabase User's id and
 * the database's own ids are. The sample data's ids are made this way, so the
 * sample store and the database seed agree.
 */
export function stableUuid(text: string): string {
  const hex = createHash("sha256").update(text).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}
