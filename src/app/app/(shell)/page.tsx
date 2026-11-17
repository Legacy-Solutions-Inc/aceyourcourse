import type { Metadata } from "next";

import { firstName } from "@/components/member-app/member-menu";
import { MemberScreen } from "@/components/member-app/member-screen";
import { requireMember } from "@/lib/member-app/guard";
import { paths } from "@/paths";

export const metadata: Metadata = { title: "Home" };

/**
 * Home, a placeholder until the dashboard ticket: it welcomes the Member by
 * their first name. The gate runs here, on every load.
 */
export default async function MemberHomePage() {
  const member = await requireMember(paths.memberApp.home);
  return (
    <MemberScreen eyebrow="01 · HOME" title={`Welcome, ${firstName(member)}`}>
      <p className="max-w-prose text-base leading-normal">
        You’re in the Member App beta. Your exam countdown, streak and progress will show here.
      </p>
      <p className="max-w-prose border border-dashed border-ayc-rule p-3.5 text-sm leading-[1.45] text-muted-foreground">
        The rest of the Member App is on its way. Each screen in the menu opens as soon as it’s
        ready.
      </p>
    </MemberScreen>
  );
}
