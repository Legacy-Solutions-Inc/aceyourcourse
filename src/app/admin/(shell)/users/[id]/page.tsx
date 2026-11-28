import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminScreen } from "@/components/admin/admin-screen";
import { MemberDetail } from "@/components/admin/users/member-detail";
import { requireOwner } from "@/lib/admin/guard";
import { paths } from "@/paths";
import { getMemberForAdmin, listExamsForAdmin, listOneTimePurchases } from "@/services/admin";

import {
  endAccessPass,
  extendAccessPass,
  forceSignOutMember,
  giveMemberCourse,
  grantAccessPass,
  removeMemberCourse,
} from "../actions";

export const metadata: Metadata = { title: "Member" };

interface MemberPageProps {
  params: Promise<{ id: string }>;
}

/**
 * A Member's detail page in Users, for Owners only (ticket 16; story 130;
 * BUILD-MAP §3.10), read fresh on every request, with force sign-out (story
 * 132), Grant, Extend and End access now (ticket 17; stories 131 and
 * 133j), and Give and Remove Course (Phase 5, ticket 07; story 172). An Editor is sent to the 403 screen; the seam refuses them too. An
 * id that isn't a Member's, or isn't a User id at all, is a 404.
 */
export default async function MemberPage({ params }: MemberPageProps) {
  const { id } = await params;
  const actor = await requireOwner(paths.admin.user(id));
  const [detail, exams, purchases] = await Promise.all([
    getMemberForAdmin(actor, id),
    listExamsForAdmin(actor),
    listOneTimePurchases(actor),
  ]);
  if (!detail.ok) {
    if (detail.error.kind === "not-found") notFound();
    throw new Error(`A Member's detail refused an Owner: ${detail.error.kind}`);
  }
  if (!purchases.ok)
    throw new Error(`One-time purchases refused an Owner: ${purchases.error.kind}`);

  return (
    <AdminScreen screen="users">
      <Link
        href={paths.admin.users}
        className="w-fit text-[13px] font-semibold text-ayc-blue underline-offset-2 hover:underline"
      >
        ← All users
      </Link>
      <MemberDetail
        detail={detail.value}
        now={new Date()}
        exams={exams.map(({ code, name }) => ({ code, name }))}
        forceSignOut={forceSignOutMember}
        passActions={{ grant: grantAccessPass, extend: extendAccessPass, end: endAccessPass }}
        soldSeparately={purchases.value.map(({ id, title, examCode }) => ({ id, title, examCode }))}
        courseActions={{ give: giveMemberCourse, remove: removeMemberCourse }}
      />
    </AdminScreen>
  );
}
