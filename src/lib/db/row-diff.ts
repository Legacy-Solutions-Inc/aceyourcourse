import { isDeepStrictEqual } from "node:util";

/**
 * What a write changes in one table: the rows to delete, insert and update.
 * Rows to write have every missing value as null, so an update clears the
 * column rather than leaving it as it was.
 */
export interface RowDiff<Before, After> {
  deleted: Before[];
  inserted: After[];
  updated: After[];
}

type AnyRow = Record<string, unknown>;

// The cast: Object.fromEntries loses the row's type, and only values change.
const withNulls = <Row extends AnyRow>(row: Row): Row =>
  Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value ?? null])) as Row;

function keyed<Row>(rows: readonly Row[], keyOf: (row: Row) => string): Map<string, Row> {
  const map = new Map<string, Row>();
  for (const row of rows) {
    const key = keyOf(row);
    if (map.has(key)) throw new Error(`Two rows have the key "${key}".`);
    map.set(key, row);
  }
  return map;
}

/** Whether `before` holds `after`'s values. Columns only `before` has (an identity) don't count. */
function same(before: AnyRow, after: AnyRow): boolean {
  return Object.entries(after).every(([key, value]) =>
    isDeepStrictEqual(before[key] ?? null, value ?? null),
  );
}

/**
 * Pure: how to turn a table's rows `before` into `after`, matching rows by
 * their primary key (`keyOf`). Rows compare by value, a missing value reading
 * as null.
 */
export function diffRows<Before extends AnyRow, After extends AnyRow>(
  before: readonly Before[],
  after: readonly After[],
  keyOf: (row: Before | After) => string,
): RowDiff<Before, After> {
  const was = keyed(before, keyOf);
  const now = keyed(after, keyOf);
  const deleted = [...was].filter(([key]) => !now.has(key)).map(([, row]) => row);
  const inserted: After[] = [];
  const updated: After[] = [];
  for (const [key, row] of now) {
    const previous = was.get(key);
    if (!previous) inserted.push(withNulls(row));
    else if (!same(previous, row)) updated.push(withNulls(row));
  }
  return { deleted, inserted, updated };
}
