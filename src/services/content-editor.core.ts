import type { z } from "zod";

import {
  CARD_IMAGE_TYPES,
  type CardImageType,
  IMAGE_TOO_BIG,
  MAX_CARD_IMAGE_BYTES,
  WRONG_IMAGE_TYPE,
} from "@/lib/cards/card-rules";
import { hasFileSignature } from "@/lib/file-signature";
import { invalidInput, roleRefusal } from "@/services/admin.schema";
import type { AdminError, AdminResult, StaffActivity, StaffActor } from "@/services/admin.types";
import type { ContentFiles } from "@/services/uploads";

// ─────────────────────────────────────────────────────────────────────────────
// What the Admin's content editors share (Phase 3): the card editor (ticket
// 07, deck-editor.core.ts) and the quiz screen with its question editor
// (tickets 09 and 10, quiz-editor.core.ts) each read and save their own
// records, and do these steps the same way:
//   - the Staff Role check and the input's validation,
//   - a Staff Activity record of one change,
//   - a new image (a card's back image, a question's figure) checked and
//     copied out of its upload into the private content bucket,
//   - the save, then deleting the files nothing uses any more, or, when
//     nothing was saved, the image it stored and its upload, and
//   - the new places of the items a reorder or a removal moves.
// ─────────────────────────────────────────────────────────────────────────────

/** A new image, stored in the private content bucket, and the upload it was copied from. */
export interface StoredImage {
  path: string;
  upload: string;
}

/** A refusal, as every step gives one. */
export type Refused = { ok: false; error: AdminError };

const UPLOAD_AGAIN = "UPLOAD THE IMAGE AGAIN";

export const refused = (error: AdminError): Refused => ({ ok: false, error });

export const NOT_FOUND: Refused = refused({ kind: "not-found" });

/** Pure: a refusal of the whole form, with no field to show it next to. */
export const formError = (message: string): AdminError => ({
  kind: "invalid",
  fieldErrors: {},
  formError: message,
});

/** The role check (any Staff User) and the input, validated with zod. */
export function staffInput<Schema extends z.ZodTypeAny>(
  actor: StaffActor,
  schema: Schema,
  input: unknown,
): { ok: true; value: z.output<Schema> } | Refused {
  const refusal = roleRefusal(actor, "staff");
  if (refusal) return refused(refusal);
  const parsed = schema.safeParse(input);
  return parsed.success ? { ok: true, value: parsed.data } : refused(invalidInput(parsed.error));
}

/** A Staff Activity record of one change, keeping copies of the values before and after. */
export function activityRecord(
  actor: StaffActor,
  now: Date,
  entity: string,
  entityId: string,
  action: string,
  before: unknown,
  after: unknown,
): StaffActivity {
  return {
    id: crypto.randomUUID(),
    at: now.toISOString(),
    actor: { email: actor.email, name: actor.name },
    entity,
    entityId,
    action,
    before: structuredClone(before),
    after: structuredClone(after),
  };
}

/**
 * A new image's upload, checked and copied into the private content bucket
 * at `pathOf(fileId, type)`: where it's stored, or why it can't be, told next
 * to the form's `field`. Only the server's own reading of the file counts:
 * its size (at most 5 MB), and what its first bytes say it is (a JPEG, PNG or
 * WebP), whatever the browser said.
 */
export async function storeImageUpload(
  files: ContentFiles,
  upload: string,
  pathOf: (fileId: string, type: CardImageType) => string,
  field: string,
): Promise<{ ok: true; stored: StoredImage } | Refused> {
  const problem = (message: string) =>
    refused({ kind: "invalid", fieldErrors: { [field]: [message] } });
  const bytes = await files.readUpload(upload, "card-image");
  if (!bytes) return problem(UPLOAD_AGAIN);
  if (bytes.byteLength > MAX_CARD_IMAGE_BYTES) return problem(IMAGE_TOO_BIG);
  const type = CARD_IMAGE_TYPES.find((candidate) => hasFileSignature(bytes, candidate));
  if (!type) return problem(WRONG_IMAGE_TYPE);
  const path = pathOf(crypto.randomUUID(), type);
  await files.put(path, bytes, type);
  return { ok: true, stored: { path, upload } };
}

/**
 * Saves, then deletes the files nothing uses: `stale(value)` once it saved;
 * or, when it didn't, the image it stored and the upload it came from (the
 * form uploads the file again to retry). A failed delete is logged by the
 * bucket, and never undoes the save.
 */
export async function saveThenTidy<T>(
  files: ContentFiles,
  save: () => Promise<Refused | { ok: true; value: T }>,
  stored: StoredImage | null,
  stale: (value: T) => (string | null)[],
): Promise<AdminResult<T>> {
  const unsaved = stored ? [stored.path, stored.upload] : [];
  let saved: Refused | { ok: true; value: T };
  try {
    saved = await save();
  } catch (error) {
    if (unsaved.length > 0) await files.remove(unsaved);
    throw error;
  }
  if (!saved.ok) {
    if (unsaved.length > 0) await files.remove(unsaved);
    return saved;
  }
  const unused = stale(saved.value).filter((path): path is string => path !== null);
  if (unused.length > 0) await files.remove(unused);
  return { ok: true, value: saved.value, tags: [] };
}

/** Pure: the items whose place changes when their list takes this order, each with its new place, from 1. */
export const renumbered = <Item extends { position: number | null }>(order: readonly Item[]) =>
  order.flatMap((item, index) =>
    item.position === index + 1 ? [] : [{ ...item, position: index + 1 }],
  );

/** Pure: the list with the item at `index` swapped with the one before it or after it, or null at either end. */
export function swapped<Item>(
  order: readonly Item[],
  index: number,
  direction: "up" | "down",
): Item[] | null {
  const other = direction === "up" ? index - 1 : index + 1;
  const item = order[index];
  const neighbour = order[other];
  if (item === undefined || neighbour === undefined) return null;
  return order.map((candidate, i) => (i === index ? neighbour : i === other ? item : candidate));
}
