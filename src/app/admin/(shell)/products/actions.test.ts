import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import { newProductForm, productFormValues } from "@/lib/admin/product-form";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import {
  addProduct,
  countProductDelete,
  createPhotoUpload,
  removeProduct,
  saveProduct,
  setProductFlag,
} from "./actions";

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
      value: { id: "prd-001", showOnWebsite: false },
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

describe("Products actions: the Product editor", () => {
  const BOOT_STAMP = () => ({ savedAt: getSampleStore().bootedAt });
  const formOf = (id: string) => {
    const found = product(id);
    if (!found) throw new Error(`No Product ${id}`);
    return { id, ...productFormValues(found) };
  };

  beforeEach(() => {
    jar.clear();
    resetSampleStore();
    vi.mocked(revalidateTag).mockClear();
  });

  it("saves an Editor's change and clears the products tag, so it's live", async () => {
    signInAs("content@aceyourcourse.ph");

    const state = await saveProduct(IDLE, {
      input: { ...formOf("prd-001"), priceFrom: "1,250" },
      expected: BOOT_STAMP(),
    });

    expect(state).toMatchObject({
      status: "saved",
      value: {
        product: { id: "prd-001", priceFrom: 125000 },
        stamp: { savedBy: "AYC Content Team" },
      },
    });
    expect(product("prd-001")?.priceFrom).toBe(125000);
    expect(revalidateTag).toHaveBeenCalledWith("catalogue:products");
  });

  it("refuses a stale save with the conflict, keeping the newer save", async () => {
    signInAs("content@aceyourcourse.ph");
    const opened = formOf("prd-001");
    await saveProduct(IDLE, { input: { ...opened, priceFrom: "1,300" }, expected: BOOT_STAMP() });

    const stale = await saveProduct(IDLE, {
      input: { ...opened, priceFrom: "1,250" },
      expected: BOOT_STAMP(),
    });

    expect(stale).toEqual({
      status: "refused",
      error: { kind: "conflict", savedBy: "AYC Content Team", savedAt: expect.any(String) },
    });
    expect(product("prd-001")?.priceFrom).toBe(130000);
  });

  it("answers the seam's field messages, changing nothing", async () => {
    signInAs("content@aceyourcourse.ph");

    const state = await saveProduct(IDLE, {
      input: { ...formOf("prd-001"), priceFrom: "abc" },
      expected: BOOT_STAMP(),
    });

    expect(state).toEqual({
      status: "refused",
      error: {
        kind: "invalid",
        fieldErrors: { priceFrom: ["ENTER A PRICE IN PESOS, LIKE 1,250"] },
      },
    });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("refuses a form that isn't the editor's shape", async () => {
    signInAs("content@aceyourcourse.ph");

    const state = await saveProduct(IDLE, { input: { id: "prd-001", priceFrom: 1250 } });

    expect(state).toMatchObject({ status: "refused", error: { kind: "invalid" } });
    expect(product("prd-001")?.priceFrom).toBe(120000);
  });

  it("adds a Coming Soon Product, live in the Website's Coming Soon list", async () => {
    signInAs("content@aceyourcourse.ph");

    const state = await addProduct(IDLE, {
      input: {
        ...newProductForm("MT"),
        title: "MT Notebook",
        shortName: "MT Notebook",
        size: "A5",
        subjectCodes: ["HEMA"],
        comingSoon: true,
      },
    });

    expect(state).toMatchObject({
      status: "saved",
      value: { product: { slug: "mt-notebook", state: "coming-soon" } },
    });
    expect(revalidateTag).toHaveBeenCalledWith("catalogue:products");
  });

  it("deletes a Product, clearing the products, reviews and FAQs tags", async () => {
    signInAs("content@aceyourcourse.ph");

    const state = await removeProduct(IDLE, { input: { id: "prd-005" } });

    expect(state).toEqual({
      status: "saved",
      value: {
        id: "prd-005",
        slug: "ultimate-ce-posters-2-0",
        reviews: 3,
        photos: 2,
        faqQuotes: 1,
      },
    });
    expect(product("prd-005")).toBeUndefined();
    for (const tag of ["catalogue:products", "catalogue:reviews", "catalogue:faqs"]) {
      expect(revalidateTag).toHaveBeenCalledWith(tag);
    }
    expect(await removeProduct(IDLE, { input: { id: "prd-005" } })).toEqual({
      status: "refused",
      error: { kind: "not-found" },
    });
  });

  it("counts what a delete takes, changing nothing, and answers not-found once it's gone", async () => {
    signInAs("content@aceyourcourse.ph");

    expect(await countProductDelete(IDLE, { input: { id: "prd-005" } })).toEqual({
      status: "saved",
      value: { reviews: 3, photos: 2, faqQuotes: 1 },
    });
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(product("prd-005")).toBeDefined();
    expect(await countProductDelete(IDLE, { input: { id: "prd-999" } })).toEqual({
      status: "refused",
      error: { kind: "not-found" },
    });
  });

  it("sends a signed-out caller to sign-in, and a User who isn't Staff to the 403 screen", async () => {
    await expect(countProductDelete(IDLE, { input: { id: "prd-005" } })).rejects.toThrow(
      "NEXT_REDIRECT /admin/sign-in",
    );
    await expect(removeProduct(IDLE, { input: { id: "prd-005" } })).rejects.toThrow(
      "NEXT_REDIRECT /admin/sign-in",
    );
    signInAs("juan.delacruz@gmail.com");
    await expect(
      saveProduct(IDLE, { input: formOf("prd-001"), expected: BOOT_STAMP() }),
    ).rejects.toThrow("NEXT_REDIRECT /admin/denied?reason=not-staff");
    expect(product("prd-005")).toBeDefined();
  });
});

describe("Products actions: createPhotoUpload", () => {
  beforeEach(() => {
    jar.clear();
    resetSampleStore();
  });

  const uploads = () => Object.values(getSampleStore().uploads);

  it("gives an Editor a one-time URL for a Product photo", async () => {
    signInAs("content@aceyourcourse.ph");

    const state = await createPhotoUpload(IDLE, {
      input: { contentType: "image/jpeg", size: 2048 },
    });

    expect(state).toEqual({
      status: "saved",
      value: {
        uploadUrl: expect.stringMatching(/^\/api\/dev\/uploads\/[\w-]+\?token=[\w-]+$/),
        path: expect.stringMatching(/^uploads\//),
        publicUrl: expect.stringMatching(/^\/api\/dev\/uploads\//),
      },
    });
    expect(uploads()).toMatchObject([
      { purpose: "product-photo", contentType: "image/jpeg", size: 2048, bytes: null },
    ]);
  });

  it("refuses a GIF or a file over 10 MB, making no upload", async () => {
    signInAs("content@aceyourcourse.ph");

    expect(
      await createPhotoUpload(IDLE, { input: { contentType: "image/gif", size: 2048 } }),
    ).toEqual({
      status: "refused",
      error: { kind: "invalid", fieldErrors: { contentType: ["USE A JPEG, PNG OR WEBP IMAGE"] } },
    });
    expect(
      await createPhotoUpload(IDLE, {
        input: { contentType: "image/png", size: 12 * 1024 * 1024 },
      }),
    ).toEqual({
      status: "refused",
      error: { kind: "invalid", fieldErrors: { size: ["KEEP EACH PHOTO TO 10 MB"] } },
    });
    expect(uploads()).toEqual([]);
  });

  it("sends a signed-out caller to sign-in, and a User who isn't Staff to the 403 screen", async () => {
    const input = { contentType: "image/png", size: 2048 };
    await expect(createPhotoUpload(IDLE, { input })).rejects.toThrow(
      "NEXT_REDIRECT /admin/sign-in",
    );
    signInAs("juan.delacruz@gmail.com");
    await expect(createPhotoUpload(IDLE, { input })).rejects.toThrow(
      "NEXT_REDIRECT /admin/denied?reason=not-staff",
    );
    expect(uploads()).toEqual([]);
  });
});
