import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { setProductFlag } from "./actions";

// The Products list's toggle, called as a browser would call it: a public
// endpoint, so the Staff Guard and the input are checked here on the server.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const IDLE: AdminActionState<never> = { status: "idle" };
const signInAs = (email: string) => jar.set("ayc_admin_sample", email);
const product = (id: string) => getSampleStore().catalogue.products.find((p) => p.id === id);

describe("Products actions: setProductFlag", () => {
  beforeEach(() => {
    jar.clear();
    resetSampleStore();
    vi.mocked(revalidateTag).mockClear();
  });

  it("lets an Editor hide a Product, and clears the products tag so the Website changes", async () => {
    signInAs("content@aceyourcourse.ph");

    const state = await setProductFlag(IDLE, { input: { id: "prd-001", showOnWebsite: false } });

    expect(state).toMatchObject({
      status: "saved",
      value: { id: "prd-001", showOnWebsite: false, stamp: { savedBy: "AYC Content Team" } },
    });
    expect(product("prd-001")?.showOnWebsite).toBe(false);
    expect(revalidateTag).toHaveBeenCalledWith("catalogue:products");
  });

  it("saves with no conflict check, even when sent an old stamp", async () => {
    signInAs("angel@aceyourcourse.ph");
    await setProductFlag(IDLE, { input: { id: "prd-005", availableInApp: true } });

    const state = await setProductFlag(IDLE, {
      input: { id: "prd-005", availableInApp: false },
      expected: { savedAt: "2020-01-01T00:00:00.000Z" },
    });

    expect(state.status).toBe("saved");
    expect(product("prd-005")?.availableInApp).toBe(false);
  });

  it("answers not-found for a Product deleted elsewhere, changing nothing", async () => {
    signInAs("content@aceyourcourse.ph");
    const { catalogue } = getSampleStore();
    catalogue.products = catalogue.products.filter((p) => p.id !== "prd-005");

    expect(await setProductFlag(IDLE, { input: { id: "prd-005", showOnWebsite: false } })).toEqual({
      status: "refused",
      error: { kind: "not-found" },
    });
    expect(getSampleStore().staffActivity).toEqual([]);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("refuses an input without a Product or a flag", async () => {
    signInAs("content@aceyourcourse.ph");

    expect(await setProductFlag(IDLE, { input: { id: "prd-005" } })).toMatchObject({
      status: "refused",
      error: { kind: "invalid", formError: "NOTHING TO SAVE" },
    });
    expect(await setProductFlag(IDLE, { input: { showOnWebsite: false } })).toMatchObject({
      status: "refused",
      error: { kind: "invalid", fieldErrors: { id: [expect.any(String)] } },
    });
    expect(getSampleStore().staffActivity).toEqual([]);
  });

  it("sends a signed-out caller to sign-in, changing nothing", async () => {
    await expect(
      setProductFlag(IDLE, { input: { id: "prd-001", showOnWebsite: false } }),
    ).rejects.toThrow(/^NEXT_REDIRECT \/admin\/sign-in/);
    expect(product("prd-001")?.showOnWebsite).toBe(true);
    expect(getSampleStore().staffActivity).toEqual([]);
  });

  it("sends someone who isn't Staff to the 403 screen, changing nothing", async () => {
    signInAs("juan.delacruz@gmail.com");

    await expect(
      setProductFlag(IDLE, { input: { id: "prd-001", showOnWebsite: false } }),
    ).rejects.toThrow(/^NEXT_REDIRECT \/admin\/denied\?reason=not-staff$/);
    expect(product("prd-001")?.showOnWebsite).toBe(true);
  });
});
