import { paths } from "@/paths";
import type { StaffRole } from "@/services/admin.types";

// The Admin's fixed menu (spec Phase 2, Menu; mockup lines 14–38). Each screen
// keeps its number whoever is signed in. Later phases add their own groups.

export type AdminScreenKey = "overview" | "exam-pages" | "products" | "reviews" | "settings";

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
    label: "SETTINGS",
    items: [
      {
        key: "settings",
        code: "05",
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

/** Pure: whether a menu item is the current screen. The Overview matches only itself. */
export function isCurrentScreen(pathname: string, href: string): boolean {
  if (href === paths.admin.overview) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
