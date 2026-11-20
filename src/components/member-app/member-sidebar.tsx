"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import { SheetClose } from "@/components/ui/sheet";
import { BrandLogo } from "@/components/website/brand-logo";
import { config } from "@/config";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";

import { ExamSwitcher } from "./exam-switcher";
import { isCurrentItem, MEMBER_MENU } from "./member-menu";
import { type ShellStreak, streakButtonWords, useShellStreak } from "./shell-streak";
import type { SwitcherExam } from "./target-exam-view";

/** The signed-in Member, as the shell's footer shows them. */
export interface ShellUser {
  name: string | null;
  email: string;
}

/** What the shell needs for the exam switcher. */
export interface ShellExams {
  /** The Member's Target Exams, one selected. Empty while they're onboarding. */
  exams: readonly SwitcherExam[];
  /** The switch Server Action. */
  switchAction: (formData: FormData) => Promise<void>;
}

interface MemberSidebarProps extends ShellExams {
  user: ShellUser;
  /** The Member App's sign-out Server Action. */
  signOutAction: () => Promise<void>;
  /** Inside the mobile drawer: adds ✕, and links close the drawer. */
  inDrawer?: boolean;
}

/**
 * The sidebar's contents (mockup L119–139; BUILD-MAP §2): the logo, the exam
 * switcher, the seven numbered nav items, and a footer with the Member's
 * name, email, a badge for the selected Target Exam and Sign out. The desktop
 * sidebar and the mobile drawer (mockup L89–113) both use it. Under the nav,
 * the streak button (mockup L132) says the Member's Study Streak, as the
 * shell knows it (shell-streak.tsx), and links to Home. A Member who is
 * still onboarding has no Target Exam, so no switcher, no streak button and
 * no badge. What the badge says about access comes with the ticket that
 * gives it something true to say.
 */
export function MemberSidebar({
  user,
  exams,
  switchAction,
  signOutAction,
  inDrawer = false,
}: MemberSidebarProps) {
  const pathname = usePathname() ?? "";
  // In the drawer, following a link also closes it.
  const closesDrawer = (link: React.ReactElement) =>
    inDrawer ? <SheetClose asChild>{link}</SheetClose> : link;
  const selected = exams.find((exam) => exam.selected);
  const streak = useShellStreak();

  return (
    <div className="flex min-h-full flex-1 flex-col gap-4.5 px-3.5 pt-4 pb-5.5">
      <div className="flex items-center justify-between gap-2.5 px-1.5 py-1">
        <BrandLogo alt={config.site.name} />
        {inDrawer ? (
          <SheetClose asChild>
            <button
              type="button"
              aria-label="Close menu"
              className="flex size-11 cursor-pointer items-center justify-center border-[1.5px] bg-background"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </SheetClose>
        ) : null}
      </div>

      {exams.length > 0 ? (
        <ExamSwitcher exams={exams} switchAction={switchAction} wrapLink={closesDrawer} />
      ) : null}

      <nav aria-label="Member App">
        <ul className="flex flex-col gap-0.5">
          {MEMBER_MENU.map((item) => {
            const current = isCurrentItem(pathname, item.href);
            return (
              <li key={item.key}>
                {closesDrawer(
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex min-h-13.5 items-center gap-3 px-2.5 py-1.5 transition-colors motion-reduce:transition-none",
                      current ? "bg-primary text-primary-foreground" : "hover:bg-ayc-cream",
                    )}
                  >
                    <span
                      className={cn(
                        "w-5.5 font-mono text-[11px] font-bold",
                        current ? "text-ayc-orange" : "text-ayc-blue",
                      )}
                    >
                      {item.code}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-base font-bold">{item.label}</span>
                      <span
                        className={cn(
                          "text-xs",
                          current ? "text-ayc-on-navy-soft" : "text-muted-foreground",
                        )}
                      >
                        {item.hint}
                      </span>
                    </span>
                  </Link>,
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {streak && selected ? <StreakButton streak={streak} wrapLink={closesDrawer} /> : null}

      <div className="mt-auto flex flex-col gap-2 border-t-[1.5px] pt-3.5">
        {user.name ? <p className="text-[15px] font-bold">{user.name}</p> : null}
        <p className="font-mono text-[11px] wrap-anywhere text-muted-foreground">{user.email}</p>
        <form action={signOutAction} className="flex items-center justify-between gap-2">
          {selected ? (
            <span className="border bg-ayc-paper px-1.5 py-1 font-mono text-[10px] font-bold tracking-[0.06em]">
              <span className="sr-only">Studying for </span>
              {selected.code} · {selected.board}
            </span>
          ) : (
            <span />
          )}
          <button
            type="submit"
            className="flex min-h-11 cursor-pointer items-center text-[13px] font-bold text-destructive hover:underline"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

/** The streak button (mockup L132): "▲ 6-DAY STREAK … STUDY TODAY", linking to Home's streak card. */
function StreakButton({
  streak,
  wrapLink,
}: {
  streak: ShellStreak;
  wrapLink: (link: React.ReactElement) => React.ReactNode;
}) {
  const { label, hint } = streakButtonWords(streak);
  return wrapLink(
    <Link
      href={paths.memberApp.home}
      className="flex items-center gap-2.5 border-[1.5px] bg-ayc-orange px-3 py-2.5 font-mono text-xs font-bold tracking-[0.04em] text-ayc-navy"
    >
      <span aria-hidden="true">▲</span>
      <span className="whitespace-nowrap">{label}</span>{" "}
      <span className="ml-auto text-[11px] font-medium whitespace-nowrap">{hint}</span>
    </Link>,
  );
}
