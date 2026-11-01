/**
 * A stand-in for Next's data cache, for tests that check what the Catalogue
 * seam caches: `unstable_cache` keeps each result by its key parts and
 * arguments, with its tags, and `revalidateTag` drops every entry carrying the
 * tag. vi.mock is hoisted above imports, so load it inside the factory:
 * `vi.mock("next/cache", async () => (await import("…/fake-next-cache")).fakeNextCache)`.
 * The shared setup (vitest.setup.ts) otherwise passes every read straight through.
 */

type Read = (...args: never[]) => Promise<unknown>;

interface Entry {
  value: unknown;
  tags: readonly string[];
}

const entries = new Map<string, Entry>();

export const fakeNextCache = {
  unstable_cache<T extends Read>(
    read: T,
    keyParts: readonly string[] = [],
    options: { tags?: readonly string[] } = {},
  ): T {
    const cached = async (...args: Parameters<T>) => {
      const key = JSON.stringify([keyParts, args]);
      const hit = entries.get(key);
      if (hit) return structuredClone(hit.value);
      const value = await read(...args);
      entries.set(key, { value: structuredClone(value), tags: options.tags ?? [] });
      return value;
    };
    return cached as T;
  },
  revalidateTag(tag: string): void {
    for (const [key, entry] of entries) if (entry.tags.includes(tag)) entries.delete(key);
  },
  revalidatePath(): void {},
};

/** The tags of every cached entry, one list per entry, in the order they were cached. */
export function cachedTags(): (readonly string[])[] {
  return [...entries.values()].map((entry) => entry.tags);
}

/** Empties the fake cache. */
export function clearFakeCache(): void {
  entries.clear();
}
