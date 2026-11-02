"use server";

import { adminAction } from "@/lib/admin/action";
import {
  createProduct,
  deleteProduct,
  previewProductDelete,
  setProductFlags,
  updateProduct,
} from "@/services/admin";
import {
  addProductInputSchema,
  productFlagsInputSchema,
  productIdInputSchema,
  saveProductInputSchema,
} from "@/services/admin.schema";

// The Products screen's Server Actions, for any Staff User. Each one checks
// the input's shape; the seam checks every Product rule, so the form is told
// each field's message.

/**
 * An inline "Site" or "App" toggle: it always saves, with no conflict check,
 * and clears the products tag, so the Website changes on its next load.
 */
export const setProductFlag = adminAction(
  { role: "staff", schema: productFlagsInputSchema },
  async (actor, { id, ...flags }) => setProductFlags(actor, id, flags),
);

/** "Add product": a new Product, Coming Soon until it has photos (ticket 06). */
export const addProduct = adminAction(
  { role: "staff", schema: addProductInputSchema },
  createProduct,
);

/** "Save product": the editor's fields, with the conflict check against the stamp it opened with. */
export const saveProduct = adminAction(
  { role: "staff", schema: saveProductInputSchema },
  async (actor, { id, ...form }, expected) => updateProduct(actor, id, form, expected),
);

/**
 * The typed-DELETE dialog's counts, read as it opens, so they're exact even
 * when Reviews were added since the page loaded. It changes nothing.
 */
export const countProductDelete = adminAction(
  { role: "staff", schema: productIdInputSchema },
  async (actor, { id }) => {
    const preview = await previewProductDelete(actor, id);
    return preview
      ? { ok: true as const, value: preview, tags: [] }
      : { ok: false as const, error: { kind: "not-found" as const } };
  },
);

/** The typed-DELETE dialog's "Delete product": the Product, its Reviews and photos, and their FAQ quotes. */
export const removeProduct = adminAction(
  { role: "staff", schema: productIdInputSchema },
  async (actor, { id }) => deleteProduct(actor, id),
);
