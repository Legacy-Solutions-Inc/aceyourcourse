"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { productListHref } from "@/lib/admin/product-list";
import type { AdminProduct, AdminProductList, ProductDeletePreview } from "@/services/admin.types";
import type { Exam } from "@/services/catalogue.types";

import { EditProduct, NewProduct, type ProductEditorActions } from "./product-editor";

interface ProductPanelProps {
  /** The selected Product's id, "new", or null. */
  selected: string | null;
  /** The selected Product, or null when it isn't in the catalogue. */
  opened: AdminProduct | null;
  /** What deleting the selected Product takes with it. */
  deletePreview: ProductDeletePreview | null;
  exams: Exam[];
  listQuery: AdminProductList["query"];
  actions: ProductEditorActions;
}

const NOTHING_GOES: ProductDeletePreview = { reviews: 0, photos: 0, faqQuotes: 0 };

/**
 * The right-hand panel (mockup 177–228): the selected Product's editor, a new
 * Product's, or a prompt to pick one. A Product just added opens in its editor
 * at its own address, still saying "✓ SAVED".
 */
export function ProductPanel({
  selected,
  opened,
  deletePreview,
  exams,
  listQuery,
  actions,
}: ProductPanelProps) {
  const router = useRouter();
  const [added, setAdded] = useState<AdminProduct | null>(null);
  // "✓ SAVED" is for the editor the new Product opens in; another selection forgets it.
  if (added && selected !== "new" && selected !== added.product.id) setAdded(null);

  let body: React.ReactNode;
  if (selected === "new") {
    body = (
      <NewProduct
        exams={exams}
        actions={actions}
        onAdded={(product) => {
          setAdded(product);
          router.replace(productListHref(listQuery, product.product.id), { scroll: false });
        }}
      />
    );
  } else if (opened) {
    const id = opened.product.id;
    body = (
      <EditProduct
        key={id}
        opened={opened}
        exams={exams}
        deletePreview={deletePreview ?? NOTHING_GOES}
        listQuery={listQuery}
        actions={actions}
        savedOnOpen={added?.product.id === id ? added : undefined}
      />
    );
  } else {
    body = (
      <>
        <p className="font-bold">Select a product</p>
        <p className="text-sm text-muted-foreground">
          Pick one from the list to edit it, or add a new one.
        </p>
      </>
    );
  }

  return (
    <aside
      aria-label="Product editor"
      className="flex min-w-0 flex-col gap-3 border-[1.5px] bg-ayc-paper p-4"
    >
      {body}
    </aside>
  );
}
