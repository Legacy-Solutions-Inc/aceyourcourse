import type { Metadata } from "next";
import Link from "next/link";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import { ProductList } from "@/components/admin/products/product-list";
import { ProductPanel } from "@/components/admin/products/product-panel";
import { requireStaff } from "@/lib/admin/guard";
import { parseProductListParams, productListHref } from "@/lib/admin/product-list";
import { paths } from "@/paths";
import {
  getProductForAdmin,
  listExamsForAdmin,
  listProductsForAdmin,
  previewProductDelete,
} from "@/services/admin";

import {
  addProduct,
  countProductDelete,
  removeProduct,
  saveProduct,
  setProductFlag,
} from "./actions";

export const metadata: Metadata = { title: adminScreen("products").title };

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Products & store links (BUILD-MAP §3.3): every Product, Coming Soon and
 * hidden ones included, with the filters and the selection in the URL, and
 * the selected Product's editor beside them, all read fresh on every request.
 */
export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const actor = await requireStaff(paths.admin.products);
  const { query, product } = parseProductListParams(await searchParams);
  // The selected Product is read by id: the filters may leave it out of the list.
  const editing = product && product !== "new" ? product : null;
  const [list, exams, opened, deletePreview] = await Promise.all([
    listProductsForAdmin(actor, query),
    listExamsForAdmin(actor),
    editing ? getProductForAdmin(actor, editing) : null,
    editing ? previewProductDelete(actor, editing) : null,
  ]);
  return (
    <AdminScreen
      screen="products"
      primaryAction={
        <Link
          href={productListHref(list.query, "new")}
          scroll={false}
          className="flex min-h-10 items-center border-[1.5px] bg-ayc-orange px-4 text-sm font-bold text-ayc-navy shadow-hard-sm"
        >
          + Add product
        </Link>
      }
    >
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <ProductList list={list} selected={product} setFlag={setProductFlag} />
        <ProductPanel
          selected={product}
          opened={opened}
          deletePreview={deletePreview}
          exams={exams}
          listQuery={list.query}
          actions={{
            save: saveProduct,
            add: addProduct,
            remove: removeProduct,
            countDelete: countProductDelete,
            setFlag: setProductFlag,
          }}
        />
      </div>
    </AdminScreen>
  );
}
