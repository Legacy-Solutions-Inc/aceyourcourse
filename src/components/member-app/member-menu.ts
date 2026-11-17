import { paths } from "@/paths";

// The Member App's fixed menu (Member App BUILD-MAP §2; mockup L794): seven
// numbered items, the same for every Member. Only Home is built so far; the
// others open a "Coming in the beta" screen until their tickets land.

export type MemberScreenKey =
  "home" | "library" | "courses" | "plans" | "billing" | "account" | "support";

export interface MemberMenuItem {
  key: MemberScreenKey;
  code: string;
  label: string;
  hint: string;
  href: string;
}

export const MEMBER_MENU: readonly MemberMenuItem[] = [
  {
    key: "home",
    code: "01",
    label: "Home",
    hint: "Countdown, streak and progress",
    href: paths.memberApp.home,
  },
  {
    key: "library",
    code: "02",
    label: "Library",
    hint: "Flash cards, quizzes, reviewers",
    href: paths.memberApp.library,
  },
  {
    key: "courses",
    code: "03",
    label: "Courses",
    hint: "Video lessons",
    href: paths.memberApp.courses,
  },
  {
    key: "plans",
    code: "04",
    label: "Plans",
    hint: "Buy or renew access",
    href: paths.memberApp.plans,
  },
  {
    key: "billing",
    code: "05",
    label: "Billing",
    hint: "Payments and receipts",
    href: paths.memberApp.billing,
  },
  {
    key: "account",
    code: "06",
    label: "Account",
    hint: "Exam date and privacy",
    href: paths.memberApp.account,
  },
  {
    key: "support",
    code: "07",
    label: "Support",
    hint: "Contact us",
    href: paths.memberApp.support,
  },
];

/**
 * Pure: the menu item whose screen lives at /app/{segment}, or null. Home
 * lives at /app itself, so it has no segment.
 */
export function memberScreen(segment: string): MemberMenuItem | null {
  return (
    MEMBER_MENU.find(
      (item) => item.key !== "home" && item.href === `${paths.memberApp.home}/${segment}`,
    ) ?? null
  );
}

/** Pure: whether a menu item is the current screen. Home matches only itself. */
export function isCurrentItem(pathname: string, href: string): boolean {
  if (href === paths.memberApp.home) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Pure: what to call a Member in a greeting: the first word of their Google
 * name, or, when sign-in gave none, the part of their email before the @.
 */
export function firstName({ name, email }: { name: string | null; email: string }): string {
  return name?.trim().split(/\s+/)[0] || email.split("@")[0] || email;
}
