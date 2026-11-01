/**
 * An Admin form's values: plain data shaped like the seam's input, with each
 * field named by its dotted path ("shopLinks.lazada"), the same path the seam's
 * field errors use.
 */
export type FormValues = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Pure: the value of the field at `path`, or undefined when there's none. */
export function valueAt(values: FormValues, path: string): unknown {
  let current: unknown = values;
  for (const key of path.split(".")) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

/** Pure: a copy of `values` with the field at `path` set. Throws for a path that isn't a field. */
export function withValueAt<V extends FormValues>(values: V, path: string, value: unknown): V {
  const copy = structuredClone(values);
  const keys = path.split(".");
  const last = keys.pop();
  let parent: unknown = copy;
  for (const key of keys) parent = isRecord(parent) ? parent[key] : undefined;
  if (last === undefined || !isRecord(parent) || !(last in parent)) {
    throw new Error(`The form has no field "${path}"`);
  }
  parent[last] = value;
  return copy;
}

/** Pure: whether two forms' values are the same. */
export function sameValues(a: FormValues, b: FormValues): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
