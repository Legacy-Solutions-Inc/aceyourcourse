import { paths } from "@/paths";
import type { StaffRole } from "@/services/admin.types";

// The Admin's fixed menu (spec Phase 2, Menu; mockup lines 14–38). Each screen
// keeps its number whoever is signed in. Later phases add their own groups:
// Phase 3 starts with Users, Phase 4 the SALES group (Plans & prices, then
// Orders & payments, ticket 07), and Phase 5 Courses & videos after Member
// App content (ticket 01), before Settings, which stays last as in the
// mockup.

export type AdminScreenKey =
  | "overview"
  | "exam-pages"
  | "products"
  | "reviews"
  | "content"
  | "courses"
  | "users"
  | "plans"
  | "orders"
  | "settings";

export interface AdminMenuItem {
  key: AdminScreenKey;
  code: string;
  label: string;
  href: string;
  ownerOnly: boolean;
}

export interface AdminMenuGroup {
  label: string;
  items: AdminMenuItem[];
}

const MENU: readonly AdminMenuGroup[] = [
  {
    label: "HOME",
    items: [
      {
        key: "overview",
        code: "01",
        label: "Overview",
        href: paths.admin.overview,
        ownerOnly: false,
      },
    ],
  },
  {
    label: "WEBSITE",
    items: [
      {
        key: "exam-pages",
        code: "02",
        label: "Pages & promo",
        href: paths.admin.examPages,
        ownerOnly: false,
      },
      {
        key: "products",
        code: "03",
        label: "Products & store links",
        href: paths.admin.products,
        ownerOnly: false,
      },
      {
        key: "reviews",
        code: "04",
        label: "Reviews & FAQs",
        href: paths.admin.reviews,
        ownerOnly: false,
      },
    ],
  },
  {
    label: "MEMBER APP",
    items: [
      {
        key: "content",
        code: "05",
        label: "Member App content",
        href: paths.admin.content,
        ownerOnly: false,
      },
      {
        key: "courses",
        code: "06",
        label: "Courses & videos",
        href: paths.admin.courses,
        ownerOnly: false,
      },
      {
        key: "users",
        code: "07",
        label: "Users",
        href: paths.admin.users,
        ownerOnly: true,
      },
    ],
  },
  {
    label: "SALES",
    items: [
      {
        key: "plans",
        code: "08",
        label: "Plans & prices",
        href: paths.admin.plans,
        ownerOnly: true,
      },
      {
        key: "orders",
        code: "09",
        label: "Orders & payments",
        href: paths.admin.orders,
        ownerOnly: true,
      },
    ],
  },
  {
    label: "SETTINGS",
    items: [
      {
        key: "settings",
        code: "10",
        label: "Settings",
        href: paths.admin.settings,
        ownerOnly: true,
      },
    ],
  },
];

/** Pure: the menu a Staff Role sees. An Editor's has no Owner-only screens. */
export function adminMenu(role: StaffRole): AdminMenuGroup[] {
  return MENU.map((group) => ({
    label: group.label,
    items: group.items.filter((item) => role === "owner" || !item.ownerOnly),
  })).filter((group) => group.items.length > 0);
}

/** Pure: a screen's group label and title, for its header. */
export function adminScreen(key: AdminScreenKey): { group: string; title: string } {
  for (const group of MENU) {
    const item = group.items.find((candidate) => candidate.key === key);
    if (item) return { group: group.label, title: item.label };
  }
  throw new Error(`No Admin screen "${key}"`);
}

/** Pure: whether the path is the screen at `href`, or one of its pages. The Overview matches only itself. */
const isWithin = (pathname: string, href: string) =>
  href === paths.admin.overview
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

/**
 * Pure: whether a menu item is the current screen: the path is it or one of
 * its pages, and no other item (`hrefs`) is a closer match, so Courses &
 * videos (/admin/content/courses) isn't also Member App content.
 */
export function isCurrentScreen(
  pathname: string,
  href: string,
  hrefs: readonly string[] = [],
): boolean {
  if (!isWithin(pathname, href)) return false;
  return !hrefs.some(
    (other) => other.length > href.length && other.startsWith(href) && isWithin(pathname, other),
  );
}
