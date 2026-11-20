import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminScreen } from "@/components/admin/admin-screen";
import { PrivacyRequestDetail } from "@/components/admin/users/privacy-request-detail";
import { requireOwner } from "@/lib/admin/guard";
import { paths } from "@/paths";
import { getPrivacyRequestForAdmin } from "@/services/admin";

import { deleteAccount, markRequestDone } from "../../actions";

export const metadata: Metadata = { title: "Privacy Request" };

interface PrivacyRequestPageProps {
  params: Promise<{ id: string }>;
}

/**
 * One Privacy Request, for Owners only (ticket 19; stories 133q and 133r),
 * read fresh on every request: download a data copy's file, delete a
 * deletion's account, and mark either done. An Editor is sent to the 403
 * screen; the seam refuses them too. An id that isn't a request's is a 404.
 */
export default async function PrivacyRequestPage({ params }: PrivacyRequestPageProps) {
  const { id } = await params;
  const actor = await requireOwner(paths.admin.privacyRequest(id));
  const request = await getPrivacyRequestForAdmin(actor, id);
  if (!request.ok) {
    if (request.error.kind === "not-found") notFound();
    throw new Error(`A Privacy Request refused an Owner: ${request.error.kind}`);
  }

  return (
    <AdminScreen screen="users">
      <Link
        href={paths.admin.privacyRequests}
        className="w-fit text-[13px] font-semibold text-ayc-blue underline-offset-2 hover:underline"
      >
        ← All Privacy Requests
      </Link>
      <PrivacyRequestDetail
        request={request.value}
        actions={{ deleteAccount, markDone: markRequestDone }}
      />
    </AdminScreen>
  );
}
