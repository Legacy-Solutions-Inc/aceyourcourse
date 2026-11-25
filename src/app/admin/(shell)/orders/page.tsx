import type { Metadata } from "next";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import { ExportCsvButton } from "@/components/admin/orders/export-csv-button";
import { OrderList } from "@/components/admin/orders/order-list";
import { requireOwner } from "@/lib/admin/guard";
import { ordersExportHref, ordersHref, parseOrdersParams } from "@/lib/admin/orders-list";
import { listOrdersForAdmin } from "@/services/admin";

export const metadata: Metadata = { title: adminScreen("orders").title };

interface OrdersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Orders & payments, for Owners only (Phase 4, ticket 07; BUILD-MAP §3.9;
 * story 147): every Order the search and filters in the URL match, with their
 * tiles, read fresh on every request, and "Export CSV" of exactly those. An
 * Editor is sent to the 403 screen; the seam and the export refuse them too.
 */
export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const query = parseOrdersParams(await searchParams);
  const actor = await requireOwner(ordersHref(query));
  const listed = await listOrdersForAdmin(actor, query);
  // The query comes from parseOrdersParams, and an Owner is let in, so it can't be refused.
  if (!listed.ok) throw new Error(`The Orders list refused an Owner: ${listed.error.kind}`);

  return (
    <AdminScreen screen="orders" primaryAction={<ExportCsvButton href={ordersExportHref(query)} />}>
      <OrderList list={listed.value} />
    </AdminScreen>
  );
}
