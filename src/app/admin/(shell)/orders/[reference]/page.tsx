import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminScreen } from "@/components/admin/admin-screen";
import { OrderDetail } from "@/components/admin/orders/order-detail";
import { requireOwner } from "@/lib/admin/guard";
import { paths } from "@/paths";
import { getOrderForAdmin } from "@/services/admin";

import { checkStatus, saveNote } from "../actions";

export const metadata: Metadata = { title: "Order" };

interface OrderPageProps {
  params: Promise<{ reference: string }>;
}

/**
 * One Order's detail page, for Owners only (Phase 4, ticket 07; BUILD-MAP
 * §3.9; story 148), read fresh on every request: its timeline, PayMongo
 * reference, internal note and "Check status with PayMongo". An Editor is
 * sent to the 403 screen; the seam refuses them too. A reference no Order
 * has is a 404.
 */
export default async function OrderPage({ params }: OrderPageProps) {
  const { reference } = await params;
  const actor = await requireOwner(paths.admin.order(reference));
  const found = await getOrderForAdmin(actor, reference);
  if (!found.ok) {
    if (found.error.kind === "not-found") notFound();
    throw new Error(`An Order's detail refused an Owner: ${found.error.kind}`);
  }

  return (
    <AdminScreen screen="orders">
      <Link
        href={paths.admin.orders}
        className="w-fit text-[13px] font-semibold text-ayc-blue underline-offset-2 hover:underline"
      >
        ← All orders
      </Link>
      <OrderDetail detail={found.value} saveNote={saveNote} checkStatus={checkStatus} />
    </AdminScreen>
  );
}
