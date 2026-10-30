import { paths } from "@/paths";

/** The Website's main links, shared by the desktop nav and the mobile drawer. */
export const SITE_LINKS = [
  { label: "Products", href: paths.products.list },
  { label: "Reviews", href: paths.reviews },
  { label: "About", href: paths.about },
  { label: "FAQ", href: paths.faq },
] as const;

/**
 * Pure: is `pathname` the page `href` points to, or a page under it? A Product
 * page counts as being in Products. Home matches only itself.
 */
export function isCurrentPath(pathname: string, href: string): boolean {
  if (href === paths.home) return pathname === paths.home;
  return pathname === href || pathname.startsWith(`${href}/`);
}
