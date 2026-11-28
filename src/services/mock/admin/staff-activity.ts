import { getSampleStore } from "@/services/mock/sample-store";
import type { StaffActivityActor } from "@/services/admin.types";
import { staffActivityCalls, type StaffActivityStore } from "@/services/staff-activity.core";

// The sample arm of the Staff Activity list (Phase 4, ticket 15): the shared
// call (src/services/staff-activity.core.ts) over the in-memory sample store.
// The store's Staff Activity is only ever appended to (a deleted Member's
// details are taken out of a record in place), so a record's seq is its
// place in it, from 1, as the database's identity column numbers them.

/** Every record, with its seq. */
const entries = () =>
  getSampleStore().staffActivity.map((activity, index) => ({ ...activity, seq: index + 1 }));

const sampleStaffActivityStore: StaffActivityStore = {
  async listActivity({ actorEmail, entities, beforeSeq, limit }) {
    return structuredClone(
      entries()
        .filter(
          ({ seq, actor, entity }) =>
            (beforeSeq === null || seq < beforeSeq) &&
            (actorEmail === null || actor.email === actorEmail) &&
            (entities === null || entities.includes(entity)),
        )
        .reverse()
        .slice(0, limit),
    );
  },
  async listActivityActors() {
    const actors = new Map<string, StaffActivityActor>();
    for (const { actor } of getSampleStore().staffActivity) {
      actors.set(actor.email, { email: actor.email, name: actor.name });
    }
    return [...actors.values()];
  },
  async listActivityEntities() {
    return [...new Set(getSampleStore().staffActivity.map(({ entity }) => entity))];
  },
};

export const { listStaffActivity } = staffActivityCalls(sampleStaffActivityStore);
