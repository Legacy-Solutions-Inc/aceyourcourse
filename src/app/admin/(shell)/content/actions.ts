"use server";

import { adminAction } from "@/lib/admin/action";
import { createTopic, deleteTopic, moveTopic, renameTopic } from "@/services/admin";
import {
  newTopicFormSchema,
  renameTopicFormSchema,
  topicIdInputSchema,
  topicMoveInputSchema,
} from "@/services/admin.schema";

// Member App content's Server Actions (Phase 3, ticket 05; spec, Phase 3
// planning decisions → Topics editor): any Staff User manages a Subject's
// Topics. The Staff Guard runs first, so someone signed out, or signed in but
// not Staff (a Member, say), is refused before the seam is reached; the seam
// checks the Staff Role again. None clears a cache tag: nothing cached reads
// Topics.

/** "+ Add topic": a new, empty Topic, last in its Subject. */
export const addTopic = adminAction({ role: "staff", schema: newTopicFormSchema }, createTopic);

/** Rename: an editor's save, so it sends the stamp the name had when the form opened. */
export const saveTopicName = adminAction(
  { role: "staff", schema: renameTopicFormSchema, requiresStamp: true },
  renameTopic,
);

/** ▲▼: one place earlier or later in its Subject. */
export const moveTopicInSubject = adminAction(
  { role: "staff", schema: topicMoveInputSchema },
  async (actor, { id, direction }) => moveTopic(actor, id, direction),
);

/** Delete: only an empty Topic; the seam refuses one with content, saying why. */
export const removeTopic = adminAction(
  { role: "staff", schema: topicIdInputSchema },
  async (actor, { id }) => deleteTopic(actor, id),
);
