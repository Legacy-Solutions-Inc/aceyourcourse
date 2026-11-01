import type { z } from "zod";

import { invalidInput, roleRefusal } from "@/services/admin.schema";
import type { AdminResult, RecordStamp, RequiredRole, StaffActor } from "@/services/admin.types";
import { type CatalogueSeed, validateCatalogueSeed } from "@/services/catalogue.schema";
import type { CatalogueAreaTag } from "@/services/catalogue.tags";
import { getSampleStore, nextStamp, stampOf } from "@/services/mock/sample-store";

// ─────────────────────────────────────────────────────────────────────────────
// The sample arm's write path (CONVENTIONS §3), shared by every Admin area that
// edits the catalogue. In order, a write:
//   1. checks the actor's Staff Role,
//   2. validates its input with the area's zod schema,
//   3. runs the conflict check against the stamp the editor opened with,
//   4. applies the change to a draft copy of the catalogue, and commits it only
//      if the whole catalogue still validates, so no save can break the Website,
//   5. appends one Staff Activity record, with the values before and after,
//   6. stamps the record, and
//   7. returns the cache tags the calling Server Action clears.
// ─────────────────────────────────────────────────────────────────────────────

const WOULD_BREAK = "THIS WOULD BREAK THE WEBSITE, SO IT WASN’T SAVED";

export interface CatalogueWrite<Schema extends z.ZodTypeAny, Snapshot, Value> {
  /** Who may make it, and what an actor without that Staff Role is told. */
  role: RequiredRole;
  forbidden?: string;
  schema: Schema;
  /** The record's key for its stamp, e.g. "settings". */
  record: string;
  /** How Staff Activity names the change. */
  activity: { entity: string; entityId: string; action: string };
  /** The record's values, for Staff Activity's before and after. */
  snapshot: (catalogue: CatalogueSeed) => Snapshot;
  /** Applies the validated input to a draft copy of the catalogue. */
  apply: (draft: CatalogueSeed, input: z.output<Schema>, now: Date) => void;
  /** What a successful write returns, read after it commits. */
  result: (catalogue: CatalogueSeed, stamp: RecordStamp) => Value;
  tags: readonly CatalogueAreaTag[];
}

/** Runs one write through the steps above. */
export function writeCatalogue<Schema extends z.ZodTypeAny, Snapshot, Value>(
  actor: StaffActor,
  input: unknown,
  expected: { savedAt: string } | undefined,
  write: CatalogueWrite<Schema, Snapshot, Value>,
): AdminResult<Value> {
  const refusal = roleRefusal(actor, write.role, write.forbidden);
  if (refusal) return { ok: false, error: refusal };

  const parsed = write.schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: invalidInput(parsed.error) };

  const store = getSampleStore();
  const stamp = stampOf(store, write.record);
  if (expected && expected.savedAt !== stamp.savedAt) {
    return { ok: false, error: { kind: "conflict", ...stamp } };
  }

  const now = new Date();
  const draft = structuredClone(store.catalogue);
  write.apply(draft, parsed.data, now);
  const validation = validateCatalogueSeed(draft);
  if (!validation.success) {
    return { ok: false, error: { kind: "invalid", fieldErrors: {}, formError: WOULD_BREAK } };
  }

  const before = write.snapshot(store.catalogue);
  const saved = nextStamp(stamp, actor.name, now);
  store.catalogue = validation.data;
  store.stamps = { ...store.stamps, [write.record]: saved };
  store.staffActivity = [
    ...store.staffActivity,
    {
      id: crypto.randomUUID(),
      at: now.toISOString(),
      actor: { email: actor.email, name: actor.name },
      ...write.activity,
      before: structuredClone(before),
      after: structuredClone(write.snapshot(store.catalogue)),
    },
  ];
  return { ok: true, value: write.result(store.catalogue, saved), tags: [...write.tags] };
}
