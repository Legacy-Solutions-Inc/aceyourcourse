import { sql } from "drizzle-orm";

// The Admin's write locks (ticket 15): transaction-level advisory locks, one
// per part of the data, so writes that change the same part run one at a
// time and each write's checks see every write before it. Shared by the Admin
// seam's database arm (src/services/admin.db.ts) and the card import
// (src/services/admin.card-import.db.ts), which takes the content lock.

/**
 * What a call reads: the catalogue with its save stamps, the Member App's
 * content (its Topics, with their decks, quizzes and Reviewer PDFs, and the
 * decks' cards), the staff list, the Beta Tester list, and the Plans (Phase
 * 4, admin.plans.db.ts).
 */
export type AdminPart = "catalogue" | "content" | "staff" | "betaTesters" | "plans";

/** A part's write lock, held until the transaction ends. */
export const adminWriteLock = (part: AdminPart) =>
  sql`select pg_advisory_xact_lock(hashtext(${`aceyourcourse:admin:${part}`}))`;
