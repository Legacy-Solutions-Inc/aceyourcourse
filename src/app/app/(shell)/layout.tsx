import { MemberDrawer } from "@/components/member-app/member-drawer";
import { MemberNotices } from "@/components/member-app/member-notices";
import { MemberSidebar } from "@/components/member-app/member-sidebar";
import { ShellStreakProvider } from "@/components/member-app/shell-streak";
import { switcherExams } from "@/components/member-app/target-exam-view";
import { checkDevice } from "@/lib/member-app/device";
import { checkConsent, getMemberAppAccess, readTargetExams } from "@/lib/member-app/guard";
import { noticeText } from "@/lib/member-app/notices";
import { studyStreak } from "@/lib/member-app/progress";
import { listNotices, listStudyDays } from "@/services/member";

import { signOut } from "../actions";
import { dismissMemberNotice, switchExam } from "./actions";

/**
 * The Member App's shell (BUILD-MAP §2): the 272 px sidebar, or below 760 px
 * the "Menu" button and drawer, around each screen. It shows the Member's
 * selected Target Exam in the exam switcher, and their Study Streak on the
 * streak button; the Target Exam actions redraw it when that changes.
 *
 * Above each screen are the Member's in-app notices (ticket 17): a grant,
 * extension or end of their access, each dismissible.
 *
 * Printing (a Payment Acknowledgement, Phase 4 ticket 06) leaves the shell
 * out: the sidebar, the Menu button and the notices.
 *
 * A layout doesn't re-render when a Member moves between screens, so it can't
 * be the gate: every page calls requireMember itself. When the gate doesn't
 * let this request in, the Member hasn't agreed to the current Terms and
 * Privacy Policy, or this request isn't from their Active Device, the layout
 * renders the bare page, whose checks then redirect to sign-in (with the
 * right `next`), to "Not open yet", to the consent screen or to the Active
 * Device screen.
 */
export default async function MemberShellLayout({ children }: { children: React.ReactNode }) {
  const access = await getMemberAppAccess();
  if (access.status !== "open") return children;
  if ((await checkConsent(access.user.userId)).status !== "ok") return children;
  if ((await checkDevice(access.user.userId)) !== "active") return children;

  const { user } = access;
  // The countdown and the streak are worked out here, on the server, at the time of this request.
  const now = new Date();
  const [targetExams, studyDays, notices] = await Promise.all([
    readTargetExams(user.userId),
    listStudyDays(user.userId),
    listNotices(user.userId),
  ]);
  const exams = switcherExams(targetExams, now);
  const { current, studiedToday } = studyStreak(studyDays, now);
  return (
    <ShellStreakProvider initial={{ current, studiedToday, readAt: now.getTime() }}>
      <div className="flex min-h-svh bg-background">
        <a
          href="#main"
          className="sr-only z-70 bg-accent px-4 py-3 font-bold text-accent-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2 print:hidden"
        >
          Skip to content
        </a>
        <aside className="hidden w-68 shrink-0 border-r-[1.5px] bg-ayc-sand wide:block print:hidden">
          <div className="sticky top-0 flex min-h-svh flex-col">
            <MemberSidebar
              user={user}
              exams={exams}
              switchAction={switchExam}
              signOutAction={signOut}
            />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="print:hidden">
            <MemberNotices
              notices={notices.map((notice) => ({ id: notice.id, text: noticeText(notice) }))}
              dismiss={dismissMemberNotice}
            />
          </div>
          {children}
        </div>
        <div className="print:hidden">
          <MemberDrawer
            user={user}
            exams={exams}
            switchAction={switchExam}
            signOutAction={signOut}
          />
        </div>
      </div>
    </ShellStreakProvider>
  );
}
