import type { Metadata } from "next";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import { requireStaff } from "@/lib/admin/guard";
import { paths } from "@/paths";

export const metadata: Metadata = { title: adminScreen("reviews").title };

/** Reviews & FAQs. Tickets 07 and 08 fill it in. */
export default async function ReviewsPage() {
  await requireStaff(paths.admin.reviews);
  return <AdminScreen screen="reviews" />;
}
