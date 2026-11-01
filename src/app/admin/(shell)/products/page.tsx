import type { Metadata } from "next";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import { requireStaff } from "@/lib/admin/guard";
import { paths } from "@/paths";

export const metadata: Metadata = { title: adminScreen("products").title };

/** Products & store links. Tickets 04 to 06 fill it in. */
export default async function ProductsPage() {
  await requireStaff(paths.admin.products);
  return <AdminScreen screen="products" />;
}
