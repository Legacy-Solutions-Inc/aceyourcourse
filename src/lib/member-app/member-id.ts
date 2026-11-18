// The short Member ID (spec, Phase 3 → Burned-in watermark; Privacy Policy
// §2: "Each account also has a short Member ID"): the first 8 characters of
// the Member's User id, uppercase. It's derived, never stored, so it's the
// same wherever it shows: the flashcard and quiz overlay now, and the stamp on
// Reviewer PDF pages (ticket 14). Staff trace a copied card or page back to
// its account by the User ids that start with it.

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pure: a Member's short Member ID. Throws a RangeError for anything but a User id. */
export function shortMemberId(userId: string): string {
  if (!USER_ID.test(userId)) throw new RangeError("Expected a User id");
  return userId.slice(0, 8).toUpperCase();
}

/** Pure: what the overlay watermark tiles over a Member's cards: their email and short Member ID. */
export function memberWatermark(email: string, userId: string): string {
  return `${email} · ${shortMemberId(userId)}`;
}
