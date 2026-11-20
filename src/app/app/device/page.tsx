import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SessionEnded, UseThisDevice } from "@/components/member-app/device-screens";
import { parseSignInProblem } from "@/lib/admin/sign-in-problem";
import { checkDevice } from "@/lib/member-app/device";
import { getMemberAppAccess, requireConsentedMember } from "@/lib/member-app/guard";
import { safeMemberAppNext } from "@/lib/member-app/safe-next";
import { MEMBER_SIGN_IN_PROBLEMS } from "@/lib/member-app/sign-in-problem";
import { getWebsiteSettings } from "@/services/catalogue";
import { getActiveDevice } from "@/services/member";

import { signOut } from "../actions";
import { confirmThisDevice, signInOnThisDevice } from "./actions";

interface DevicePageProps {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}

/**
 * Titled for the screen this request gets. Only reads: the page itself
 * redirects anyone who doesn't belong here.
 */
export async function generateMetadata(): Promise<Metadata> {
  const access = await getMemberAppAccess();
  const status = access.status === "open" ? await checkDevice(access.user.userId) : null;
  return { title: status === "no-token" ? "Use this device" : "Session ended" };
}

/**
 * The Active Device screen (spec, Phase 3 → Active Device; stories 107, 108,
 * 133f), where requireMember sends a request that isn't from the Member's
 * Active Device. It runs the gate and consent first, then reads the device on
 * every load: a replaced device gets "Session ended", a session with no device
 * token gets "Use the Member App on this device", and the Active Device goes
 * straight on to `next`. `error` says why the last "Sign in on this device"
 * didn't go on.
 */
export default async function DevicePage({ searchParams }: DevicePageProps) {
  const params = await searchParams;
  const next = safeMemberAppNext(params.next);
  const member = await requireConsentedMember(next);
  const status = await checkDevice(member.userId);
  if (status === "active") redirect(next);

  const activeDevice = await getActiveDevice(member.userId);
  const now = new Date();
  if (status === "no-token") {
    return (
      <UseThisDevice
        email={member.email}
        activeDevice={activeDevice}
        now={now}
        next={next}
        action={confirmThisDevice}
        signOutAction={signOut}
      />
    );
  }

  const problem = parseSignInProblem(params.error);
  const { contactEmail } = await getWebsiteSettings();
  return (
    <SessionEnded
      email={member.email}
      newDevice={activeDevice}
      now={now}
      next={next}
      contactEmail={contactEmail}
      problem={problem ? MEMBER_SIGN_IN_PROBLEMS[problem] : null}
      action={signInOnThisDevice}
    />
  );
}
