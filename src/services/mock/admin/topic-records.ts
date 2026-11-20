import type { StaffActor } from "@/services/admin.types";
import type { Topic } from "@/services/content.types";
import { getSampleStore } from "@/services/mock/sample-store";

// The sample arm's Topic records, shared by the Topics area (topics.ts) and
// the Exam pages area (exam-pages.ts), whose Exam and Subject deletes take
// their empty Topics with them. Not part of the seam itself.

/** A Topic's name record, for the stamp its rename checks. */
export const topicRecordOf = (id: string) => `topic:${id}`;

/** One Staff Activity record for a change to a Topic. */
export function recordTopicActivity(
  actor: StaffActor,
  now: Date,
  change: { entityId: string; action: string; before: unknown; after: unknown },
): void {
  const store = getSampleStore();
  store.staffActivity = [
    ...store.staffActivity,
    {
      id: crypto.randomUUID(),
      at: now.toISOString(),
      actor: { email: actor.email, name: actor.name },
      entity: "topic",
      entityId: change.entityId,
      action: change.action,
      before: structuredClone(change.before),
      after: structuredClone(change.after),
    },
  ];
}

/**
 * Deletes the Topics that match, with their names' stamps, each recorded in
 * Staff Activity with every value it had. For an Exam or Subject delete, like
 * the database's cascade: its Topics are empty, or the delete was refused.
 */
export function deleteTopics(
  actor: StaffActor,
  now: Date,
  matches: (topic: Topic) => boolean,
): Topic[] {
  const store = getSampleStore();
  const gone = store.topics.filter(matches);
  if (gone.length === 0) return [];
  store.topics = store.topics.filter((topic) => !matches(topic));
  const stamps = { ...store.stamps };
  for (const topic of gone) delete stamps[topicRecordOf(topic.id)];
  store.stamps = stamps;
  for (const topic of gone) {
    // Staff Activity keeps every value the delete removes (spec, Phase 2 → Deleting).
    recordTopicActivity(actor, now, {
      entityId: topic.id,
      action: "delete",
      before: topic,
      after: null,
    });
  }
  return structuredClone(gone);
}
