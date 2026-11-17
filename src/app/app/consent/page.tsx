import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConsentScreen } from "@/components/member-app/consent-screen";
import { checkConsent, requireGatedMember } from "@/lib/member-app/guard";
import { safeMemberAppNext } from "@/lib/member-app/safe-next";

import { signOut } from "../actions";
import { agreeAndContinue } from "./actions";

export const metadata: Metadata = { title: "Before you start" };

interface ConsentPageProps {
  searchParams: Promise<{ next?: string | string[]; outdated?: string | string[] }>;
}

/**
 * The consent screen (stories 82, 83, 133e): before any other Member App
 * screen until the Member agrees to the current Terms and Privacy Policy,
 * outside the shell as in the mockup. It runs the gate alone (consent is what
 * it asks for), so someone the gate turns away never sees it. A Member who
 * has agreed to the current versions goes straight on to `next`. `outdated`
 * comes back from the action when a document changed while the screen was
 * open.
 */
export default async function ConsentPage({ searchParams }: ConsentPageProps) {
  const params = await searchParams;
  const next = safeMemberAppNext(params.next);
  const member = await requireGatedMember(next);
  const { status, current } = await checkConsent(member.userId);
  if (status === "ok") redirect(next);

  return (
    <ConsentScreen
      status={status}
      versions={current}
      next={next}
      outdated={params.outdated === "1"}
      action={agreeAndContinue}
      signOutAction={signOut}
    />
  );
}
