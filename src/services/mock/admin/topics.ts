import type { z } from "zod";

import {
  alreadyATopic,
  invalidInput,
  type NewTopicForm,
  newTopicFormSchema,
  type RenameTopicForm,
  renameTopicFormSchema,
  roleRefusal,
  topicDeleteBlocker,
  topicIdInputSchema,
  type TopicMove,
  topicMoveInputSchema,
  typedCode,
} from "@/services/admin.schema";
import type {
  AdminError,
  AdminResult,
  AdminTopic,
  AdminTopicList,
  StaffActor,
} from "@/services/admin.types";
import { topicContentOf, topicsOf } from "@/services/content.rules";
import type { ContentRecords, Topic } from "@/services/content.types";
import { getSampleStore, nextStamp, stampOf } from "@/services/mock/sample-store";

import { deleteTopics, recordTopicActivity, topicRecordOf as recordOf } from "./topic-records";

// ─────────────────────────────────────────────────────────────────────────────
// The sample arm of the Admin seam's Topics (spec, Phase 3 planning decisions
// → Topics editor; story 133n): each Subject's Topics list, where any Staff
// User adds, renames, moves and deletes Topics. In order, a write:
//   1. checks the actor's Staff Role (any Staff User),
//   2. validates its input with zod,
//   3. answers not-found when the Topic or its Subject is gone, then runs the
//      conflict check for a rename, then the Topics' own rules: a name unique
//      within its Subject, ignoring case, and delete only when empty,
//   4. applies the change,
//   5. appends one Staff Activity record, entity "topic", and
//   6. stamps a renamed Topic's name.
// Topics aren't on the Website and the Member App reads them fresh, so no
// write returns a cache tag. Progress is tied to a Topic's id, so a rename
// keeps it.
// ─────────────────────────────────────────────────────────────────────────────

/** Every Topic with its content, as the store holds them. */
function contentOfStore(): ContentRecords {
  const { topics, decks, quizzes, reviewerPdfs } = getSampleStore();
  return { topics, decks, quizzes, reviewerPdfs };
}

const findTopic = (id: string) => getSampleStore().topics.find((topic) => topic.id === id);

function adminTopicOf(topic: Topic): AdminTopic {
  const content = topicContentOf(topic.id, contentOfStore());
  return structuredClone({
    id: topic.id,
    name: topic.name,
    position: topic.position,
    content,
    deleteBlocker: topicDeleteBlocker(content),
    stamp: stampOf(getSampleStore(), recordOf(topic.id)),
  });
}

/** The Subject's Topics, in order. */
const subjectTopics = (topic: Pick<Topic, "examCode" | "subjectCode">) =>
  topicsOf(getSampleStore().topics, topic.examCode, topic.subjectCode);

/** Pure: whether another Topic in the Subject already has this name, ignoring case. */
const nameTaken = (topics: readonly Topic[], name: string, except?: string) =>
  topics.some((topic) => topic.id !== except && topic.name.toLowerCase() === name.toLowerCase());

/** Steps 1 and 2: the role check and the input's validation. */
function checked<Schema extends z.ZodTypeAny>(
  actor: StaffActor,
  schema: Schema,
  input: unknown,
): { ok: true; value: z.output<Schema> } | { ok: false; error: AdminError } {
  const refusal = roleRefusal(actor, "staff");
  if (refusal) return { ok: false, error: refusal };
  const parsed = schema.safeParse(input);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: invalidInput(parsed.error) };
}

/** Gives each of the Subject's Topics its place in `order`, from 1. */
function renumber(order: readonly Topic[]): void {
  const store = getSampleStore();
  const positions = new Map(order.map((topic, index) => [topic.id, index + 1]));
  store.topics = store.topics.map((topic) => {
    const position = positions.get(topic.id);
    return position === undefined ? topic : { ...topic, position };
  });
}

const saved = <T>(value: T): AdminResult<T> => ({ ok: true, value, tags: [] });
const invalidName = (message: string): AdminError => ({
  kind: "invalid",
  fieldErrors: { name: [message] },
});
const refusal = (formError: string): AdminError => ({
  kind: "invalid",
  fieldErrors: {},
  formError,
});

export async function listTopicsForAdmin(
  _actor: StaffActor,
  examCode: string,
  subjectCode: string,
): Promise<AdminTopicList | null> {
  const exam = getSampleStore().catalogue.exams.find((e) => e.code === typedCode(examCode));
  const subject = exam?.subjects.find((s) => s.code === typedCode(subjectCode));
  if (!exam || !subject) return null;
  return {
    exam: { code: exam.code, board: exam.board, name: exam.name },
    subject: structuredClone(subject),
    topics: subjectTopics({ examCode: exam.code, subjectCode: subject.code }).map(adminTopicOf),
  };
}

export async function createTopic(
  actor: StaffActor,
  input: NewTopicForm,
): Promise<AdminResult<AdminTopic>> {
  const form = checked(actor, newTopicFormSchema, input);
  if (!form.ok) return form;
  const { exam: examCode, subject: subjectCode, name } = form.value;

  const store = getSampleStore();
  const exam = store.catalogue.exams.find((e) => e.code === examCode);
  if (!exam?.subjects.some((s) => s.code === subjectCode)) {
    return { ok: false, error: { kind: "not-found" } };
  }
  const siblings = subjectTopics({ examCode, subjectCode });
  if (nameTaken(siblings, name)) {
    return { ok: false, error: invalidName(alreadyATopic(name, subjectCode)) };
  }

  const now = new Date();
  // A new Topic goes last in its Subject.
  const topic: Topic = {
    id: crypto.randomUUID(),
    examCode,
    subjectCode,
    name,
    position: Math.max(0, ...siblings.map((t) => t.position)) + 1,
  };
  store.topics = [...store.topics, topic];
  recordTopicActivity(actor, now, {
    entityId: topic.id,
    action: "add",
    before: null,
    after: topic,
  });
  return saved(adminTopicOf(topic));
}

export async function renameTopic(
  actor: StaffActor,
  input: RenameTopicForm,
  expected?: { savedAt: string },
): Promise<AdminResult<AdminTopic>> {
  const form = checked(actor, renameTopicFormSchema, input);
  if (!form.ok) return form;
  const { id, name } = form.value;

  const store = getSampleStore();
  const topic = findTopic(id);
  if (!topic) return { ok: false, error: { kind: "not-found" } };
  const stamp = stampOf(store, recordOf(id));
  if (expected && expected.savedAt !== stamp.savedAt) {
    return { ok: false, error: { kind: "conflict", ...stamp } };
  }
  if (nameTaken(subjectTopics(topic), name, id)) {
    return { ok: false, error: invalidName(alreadyATopic(name, topic.subjectCode)) };
  }

  const now = new Date();
  const renamed: Topic = { ...topic, name };
  store.topics = store.topics.map((t) => (t.id === id ? renamed : t));
  store.stamps = { ...store.stamps, [recordOf(id)]: nextStamp(stamp, actor.name, now) };
  recordTopicActivity(actor, now, {
    entityId: id,
    action: "rename",
    before: { name: topic.name },
    after: { name },
  });
  return saved(adminTopicOf(renamed));
}

export async function moveTopic(
  actor: StaffActor,
  id: string,
  direction: TopicMove,
): Promise<AdminResult<string[]>> {
  // Like a single toggle, ▲▼ always saves: there's no form to go stale.
  const form = checked(actor, topicMoveInputSchema, { id, direction });
  if (!form.ok) return form;

  const topic = findTopic(form.value.id);
  if (!topic) return { ok: false, error: { kind: "not-found" } };
  const order = subjectTopics(topic);
  const index = order.findIndex((t) => t.id === topic.id);
  const other = form.value.direction === "up" ? index - 1 : index + 1;
  if (other < 0) return { ok: false, error: refusal("IT’S ALREADY FIRST IN ITS SUBJECT") };
  if (other >= order.length) {
    return { ok: false, error: refusal("IT’S ALREADY LAST IN ITS SUBJECT") };
  }

  const before = order.map((t) => t.id);
  const swapped = order[other];
  if (!swapped) return { ok: false, error: { kind: "not-found" } };
  const moved = order.map((t, i) => (i === index ? swapped : i === other ? topic : t));
  renumber(moved);
  const after = moved.map((t) => t.id);
  recordTopicActivity(actor, new Date(), { entityId: topic.id, action: "move", before, after });
  return saved(after);
}

export async function deleteTopic(actor: StaffActor, id: string): Promise<AdminResult<Topic>> {
  const form = checked(actor, topicIdInputSchema, { id });
  if (!form.ok) return form;

  const topic = findTopic(form.value.id);
  if (!topic) return { ok: false, error: { kind: "not-found" } };
  const blocker = topicDeleteBlocker(topicContentOf(topic.id, contentOfStore()));
  if (blocker) return { ok: false, error: refusal(blocker) };

  deleteTopics(actor, new Date(), (t) => t.id === topic.id);
  renumber(subjectTopics(topic));
  return saved(structuredClone(topic));
}
