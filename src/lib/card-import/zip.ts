import { unzipSync } from "fflate";

import { MAX_CARD_IMAGE_BYTES } from "@/lib/cards/card-rules";

import { MAX_ZIP_BYTES } from "./limits";

// ─────────────────────────────────────────────────────────────────────────────
// Reading an import's zip of images (spec, Phase 3 → Spreadsheet import). The
// preview only needs each file's name and size, read from the zip's
// directory without unpacking anything; confirming unpacks just the images
// the cards use. Only the file itself is judged here (too big, not a zip);
// the planner (plan.ts) judges the names and sizes inside it.
// ─────────────────────────────────────────────────────────────────────────────

/** One file in the zip: its path inside it, and its unpacked size in bytes. */
export interface ZipEntry {
  name: string;
  size: number;
}

/** A zip as listed: its files (folders left out). */
export interface ZipListing {
  entries: ZipEntry[];
}

export type ZipRead = { ok: true; listing: ZipListing } | { ok: false; problem: string };

const isFolder = (name: string) => name.endsWith("/");

/** Pure: the zip's files and their sizes, from its directory; nothing is unpacked. */
export function listZipFile(bytes: Uint8Array): ZipRead {
  if (bytes.byteLength > MAX_ZIP_BYTES) return { ok: false, problem: "is over 200 MB" };
  const entries: ZipEntry[] = [];
  try {
    unzipSync(bytes, {
      filter: ({ name, originalSize }) => {
        if (!isFolder(name)) entries.push({ name, size: originalSize });
        return false;
      },
    });
  } catch {
    return { ok: false, problem: "isn’t a zip file" };
  }
  return { ok: true, listing: { entries } };
}

/**
 * Pure: the named files, unpacked. Each must be in the zip and no bigger than
 * a card image may be, which the planner has checked: the unpacked size the
 * zip declares is what's set aside for it, so a file can't unpack to more.
 * Throws otherwise, naming the file.
 */
export function readZipEntries(
  bytes: Uint8Array,
  names: readonly string[],
): Map<string, Uint8Array> {
  const wanted = new Set(names);
  const files = unzipSync(bytes, {
    filter: ({ name, originalSize }) => {
      if (!wanted.has(name)) return false;
      if (originalSize > MAX_CARD_IMAGE_BYTES) throw new Error(`“${name}” in the zip is too big.`);
      return true;
    },
  });
  const found = new Map<string, Uint8Array>();
  for (const name of wanted) {
    const file = files[name];
    if (!file) throw new Error(`“${name}” isn’t in the zip.`);
    found.set(name, file);
  }
  return found;
}
