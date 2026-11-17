import { MemberDrawer } from "@/components/member-app/member-drawer";
import { MemberSidebar } from "@/components/member-app/member-sidebar";
import { checkConsent, getMemberAppAccess } from "@/lib/member-app/guard";

import { signOut } from "../actions";

/**
 * The Member App's shell (BUILD-MAP §2): the 272 px sidebar, or below 760 px
 * the "Menu" button and drawer, around each screen.
 *
 * A layout doesn't re-render when a Member moves between screens, so it can't
 * be the gate: every page calls requireMember itself. When the gate doesn't
 * let this request in, or the Member hasn't agreed to the current Terms and
 * Privacy Policy, the layout renders the bare page, whose checks then
 * redirect to sign-in (with the right `next`), to "Not open yet" or to the
 * consent screen.
 */
export default async function MemberShellLayout({ children }: { children: React.ReactNode }) {
  const access = await getMemberAppAccess();
  if (access.status !== "open") return children;
  if ((await checkConsent(access.user.userId)).status !== "ok") return children;

  const { user } = access;
  return (
    <div className="flex min-h-svh bg-background">
      <a
        href="#main"
        className="sr-only z-70 bg-accent px-4 py-3 font-bold text-accent-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <aside className="hidden w-68 shrink-0 border-r-[1.5px] bg-ayc-sand wide:block">
        <div className="sticky top-0 flex min-h-svh flex-col">
          <MemberSidebar user={user} signOutAction={signOut} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <MemberDrawer user={user} signOutAction={signOut} />
    </div>
  );
}
