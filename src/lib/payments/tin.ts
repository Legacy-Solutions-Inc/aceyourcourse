/**
 * A Philippine Taxpayer Identification Number (Phase 4, tickets 06 and 08):
 * 9 digits, optionally followed by a 3- or 5-digit branch code, typed with or
 * without dashes between the groups ("123-456-789", "123456789000").
 */
const TIN = /^(\d{3})-?(\d{3})-?(\d{3})(?:-?(\d{5}|\d{3}))?$/;

/** Pure: a TIN as it's kept and printed, with dashes ("123-456-789-000"), or null when it isn't one. */
export function normaliseTin(typed: string): string | null {
  const match = TIN.exec(typed.trim());
  if (!match) return null;
  return match.slice(1).filter(Boolean).join("-");
}
