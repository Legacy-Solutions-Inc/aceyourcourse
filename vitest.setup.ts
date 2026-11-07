import "@testing-library/jest-dom/vitest";

import { vi } from "vitest";

// Next's data cache doesn't exist under Vitest: unstable_cache passes every read
// straight through, and revalidateTag and revalidatePath are spies, so a test
// can check which tags a save clears. A test of the caching itself mocks
// next/cache with test/fake-next-cache.ts instead.
vi.mock("next/cache", () => ({
  unstable_cache: <T>(read: T) => read,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));
