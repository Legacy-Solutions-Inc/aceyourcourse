import { entitiesOfArea } from "@/lib/admin/staff-activity-view";
import { roleRefusal } from "@/services/admin.schema";
import type {
  AdminResult,
  StaffActivityActor,
  StaffActivityEntry,
  StaffActivityList,
  StaffActor,
  StaffActivityQuery,
} from "@/services/admin.types";
import { refused } from "@/services/content-editor.core";

// ─────────────────────────────────────────────────────────────────────────────
// The Staff Activity list for Owners (Phase 4, ticket 15; spec, Phase 4 →
// Orders Admin; Testing Decisions → Phase 4 seams), shared by both arms of
// the Admin seam.
//
// - Owners only: the before and after values can hold personal data, so an
//   Editor is refused and gets none of it.
// - Read-only: nothing here writes Staff Activity, and reading it is not
//   itself recorded.
// - Newest first, PAGE_SIZE to a page, by keyset on `seq` (never an offset):
//   a page's cursor is its last record's seq, and the next page is the
//   records older than it, so records added while an Owner pages are never
//   repeated or skipped.
// - The area filter reads as the entities it covers
//   (src/lib/admin/staff-activity-view.ts); a filter value no record has
//   matches nothing.
// ─────────────────────────────────────────────────────────────────────────────

/** Records to a page. */
export const STAFF_ACTIVITY_PAGE_SIZE = 50;

const FORBIDDEN = "ONLY AN OWNER CAN SEE STAFF ACTIVITY";

/** Which records a page reads. */
export interface StaffActivityFilter {
  /** Only this actor's records, by the email recorded, or everyone's. */
  actorEmail: string | null;
  /** Only records of these entities, or of every entity. */
  entities: readonly string[] | null;
  /** Only records with a lower seq, or all. */
  beforeSeq: number | null;
  limit: number;
}

/** How an arm reads Staff Activity. */
export interface StaffActivityStore {
  /** Up to `limit` records the filter matches, highest seq first. */
  listActivity(filter: StaffActivityFilter): Promise<StaffActivityEntry[]>;
  /** Every actor recorded, each email once with the name of its latest record, in any order. */
  listActivityActors(): Promise<StaffActivityActor[]>;
  /** Every entity recorded, each once, in any order. */
  listActivityEntities(): Promise<string[]>;
}

const byName = (a: StaffActivityActor, b: StaffActivityActor) =>
  a.name.localeCompare(b.name) || a.email.localeCompare(b.email);

/** The Staff Activity list call, over an arm's store. */
export function staffActivityCalls(store: StaffActivityStore) {
  /** One page of the records the query matches, newest first, for an Owner. */
  async function listStaffActivity(
    actor: StaffActor,
    query: StaffActivityQuery,
  ): Promise<AdminResult<StaffActivityList>> {
    const role = roleRefusal(actor, "owner", FORBIDDEN);
    if (role) return refused(role);
    const [rows, actors, entities] = await Promise.all([
      store.listActivity({
        actorEmail: query.actor,
        entities: query.area === null ? null : entitiesOfArea(query.area),
        beforeSeq: query.before,
        // One more than a page, to know whether an older page follows.
        limit: STAFF_ACTIVITY_PAGE_SIZE + 1,
      }),
      store.listActivityActors(),
      store.listActivityEntities(),
    ]);
    const entries = rows.slice(0, STAFF_ACTIVITY_PAGE_SIZE);
    const last = entries.at(-1);
    return {
      ok: true,
      value: {
        query,
        entries,
        next: rows.length > STAFF_ACTIVITY_PAGE_SIZE && last ? last.seq : null,
        actors: [...actors].sort(byName),
        entities: [...entities].sort(),
      },
      tags: [],
    };
  }

  return { listStaffActivity };
}
