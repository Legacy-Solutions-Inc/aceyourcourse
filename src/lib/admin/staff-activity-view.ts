import { PAYMONGO_SYSTEM_ACTOR } from "@/lib/payments/order-ledger";
import { paths } from "@/paths";
import type { StaffActivityQuery } from "@/services/admin.types";

// ─────────────────────────────────────────────────────────────────────────────
// How the Staff Activity list for Owners shows a record (Phase 4, ticket 15;
// spec, Phase 4 → Orders Admin): the area its entity belongs to, who made it
// (PayMongo's own changes under "PayMongo (system)"), which fields it
// changed, and the list's filters and cursor in the URL. Pure.
// ─────────────────────────────────────────────────────────────────────────────

/** How the list names the system actor PayMongo's outcomes are recorded under. */
export const PAYMONGO_SYSTEM_NAME = PAYMONGO_SYSTEM_ACTOR.name;

/**
 * The areas, each with the Staff Activity entities it covers, in the order of
 * the Admin's menu. An entity none of them covers is its own area.
 */
const AREAS: readonly { key: string; label: string; entities: readonly string[] }[] = [
  { key: "exam-pages", label: "Exam pages", entities: ["exam-page", "exam"] },
  { key: "promo", label: "Promo", entities: ["promo-banner", "announcement"] },
  { key: "site-pages", label: "Site pages", entities: ["site-page"] },
  { key: "products", label: "Products", entities: ["product"] },
  { key: "reviews", label: "Reviews", entities: ["review"] },
  { key: "faqs", label: "FAQs", entities: ["faq"] },
  {
    key: "content",
    label: "Member App content",
    entities: [
      "topic",
      "deck",
      "card",
      "card-import",
      "quiz",
      "quiz-import",
      "question",
      "reviewer-pdf",
    ],
  },
  { key: "courses", label: "Courses", entities: ["course", "course-module", "lesson"] },
  {
    key: "users",
    label: "Users",
    entities: ["member", "access-pass", "beta-tester", "privacy-request"],
  },
  { key: "plans", label: "Plans", entities: ["plan"] },
  { key: "orders", label: "Orders", entities: ["order", "orders"] },
  { key: "settings", label: "Settings", entities: ["settings"] },
  { key: "staff", label: "Admin accounts", entities: ["staff", "invite"] },
];

export interface ActivityArea {
  key: string;
  label: string;
}

/** Pure: the area an entity belongs to; an entity no area covers is its own, under its raw name. */
export function activityAreaOf(entity: string): ActivityArea {
  const area = AREAS.find(({ entities }) => entities.includes(entity));
  return area ? { key: area.key, label: area.label } : { key: entity, label: entity };
}

/** Pure: the entities an area covers; a key no area has is read as one raw entity. */
export function entitiesOfArea(key: string): readonly string[] {
  return AREAS.find((area) => area.key === key)?.entities ?? [key];
}

/** Pure: the area filter's options: each area of the entities recorded, once, by label. */
export function activityAreaOptions(entities: readonly string[]): ActivityArea[] {
  const areas = new Map(
    entities.map((entity) => {
      const area = activityAreaOf(entity);
      return [area.key, area] as const;
    }),
  );
  return [...areas.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Pure: who made a record, as the list shows them: the system actor has a name and no email. */
export function activityActorLabel(actor: { email: string; name: string }): {
  name: string;
  email: string | null;
} {
  if (actor.email === PAYMONGO_SYSTEM_ACTOR.email)
    return { name: PAYMONGO_SYSTEM_NAME, email: null };
  return { name: actor.name.trim() || actor.email, email: actor.email };
}

/** The fields a record's before and after values differ in. */
export interface ActivityChanges {
  added: string[];
  removed: string[];
  changed: string[];
}

type Fields = Record<string, unknown>;

const isRecord = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A value as fields: a record's own, none for nothing, or one field `value` for anything else. */
const fieldsOf = (value: unknown): Fields =>
  isRecord(value) ? value : value === null || value === undefined ? {} : { value };

/** Pure: whether two JSON values are equal by value, whatever their keys' order. */
function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => sameValue(item, b[index]))
    );
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => sameValue(a[key], b[key]));
  }
  return Object.is(a ?? null, b ?? null);
}

/**
 * Pure: the fields a record changed, from its values before and after: those
 * only after has (added), those only before has (removed), and those both
 * have with different values (changed), each in the order the values give.
 * A record created has every field added; one deleted, every field removed.
 */
export function activityChanges(before: unknown, after: unknown): ActivityChanges {
  const was = fieldsOf(before);
  const now = fieldsOf(after);
  const has = (fields: Fields, key: string) => Object.hasOwn(fields, key);
  return {
    added: Object.keys(now).filter((key) => !has(was, key)),
    removed: Object.keys(was).filter((key) => !has(now, key)),
    changed: Object.keys(now).filter((key) => has(was, key) && !sameValue(was[key], now[key])),
  };
}

type SearchParams = Record<string, string | string[] | undefined>;

/** An email is at most 320 characters; no filter value needs more. */
const MAX_FILTER_LENGTH = 320;
/** A cursor is a record's `seq`: a positive whole number a bigint holds safely. */
const CURSOR = /^[1-9]\d{0,14}$/;

/**
 * Pure: the list's filters and cursor from the URL. A filter value no record
 * has simply matches nothing; a cursor that isn't a `seq` reads as the first
 * page.
 */
export function parseActivityParams(params: SearchParams): StaffActivityQuery {
  const value = (key: string) => {
    const raw = params[key];
    return ((Array.isArray(raw) ? raw[0] : raw) ?? "").trim();
  };
  const before = value("before");
  return {
    actor: value("actor").slice(0, MAX_FILTER_LENGTH) || null,
    area: value("area").slice(0, MAX_FILTER_LENGTH) || null,
    before: CURSOR.test(before) ? Number(before) : null,
  };
}

/** Pure: the list's URL for a query, leaving out what's empty. */
export function activityHref({ actor, area, before }: StaffActivityQuery): string {
  const params = new URLSearchParams();
  if (actor) params.set("actor", actor);
  if (area) params.set("area", area);
  if (before !== null) params.set("before", String(before));
  const search = params.toString();
  return search ? `${paths.admin.staffActivity}?${search}` : paths.admin.staffActivity;
}
