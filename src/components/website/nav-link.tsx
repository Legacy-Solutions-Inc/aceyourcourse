"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isCurrentPath } from "@/components/website/site-links";

/**
 * A site link that marks itself `aria-current="page"` on its own page and the
 * pages under it. Style the current state with `aria-[current=page]:`.
 */
export function NavLink({ href, ...props }: React.ComponentProps<typeof Link> & { href: string }) {
  const pathname = usePathname() ?? "";
  const current = isCurrentPath(pathname, href);
  return <Link {...props} href={href} aria-current={current ? "page" : undefined} />;
}
