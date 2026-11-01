import type { Metadata } from "next";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import { requireStaff } from "@/lib/admin/guard";
import { paths } from "@/paths";

export const metadata: Metadata = { title: adminScreen("exam-pages").title };

/** Exam pages & promo. Tickets 09 and 10 fill it in. */
export default async function ExamPagesPage() {
  await requireStaff(paths.admin.examPages);
  return <AdminScreen screen="exam-pages" />;
}
