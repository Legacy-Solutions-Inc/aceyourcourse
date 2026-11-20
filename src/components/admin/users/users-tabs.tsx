import Link from "next/link";

import type { UsersTab } from "@/lib/admin/users-list";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";

const TABS: { tab: UsersTab; label: string; href: string }[] = [
  { tab: "users", label: "USERS", href: paths.admin.users },
  { tab: "beta-testers", label: "BETA TESTERS", href: paths.admin.betaTesters },
  { tab: "privacy-requests", label: "PRIVACY REQUESTS", href: paths.admin.privacyRequests },
];

/**
 * The Users screen's tabs, styled as Reviews & FAQs' are. Each is its own
 * address, so they're links, the current one marked as the page: the Users
 * list (ticket 16), the Beta Testers beside it (ticket 01), and the Privacy
 * Requests (ticket 18).
 */
export function UsersTabs({ tab }: { tab: UsersTab }) {
  return (
    <nav aria-label="Users" className="flex flex-wrap border-b-[1.5px]">
      {TABS.map(({ tab: key, label, href }) => (
        <Link
          key={key}
          href={href}
          aria-current={key === tab ? "page" : undefined}
          className={cn(
            "-mr-[1.5px] border-[1.5px] border-b-0 px-4.5 py-2.5 font-mono text-[13px] font-bold tracking-[0.04em]",
            key === tab ? "bg-primary text-primary-foreground" : "bg-ayc-paper hover:bg-ayc-sand",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
