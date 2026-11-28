"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useId } from "react";

import { BrandLogo } from "@/components/website/brand-logo";
import { SheetClose } from "@/components/ui/sheet";
import { config } from "@/config";
import { paidTodayCard } from "@/lib/admin/sales-view";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { PaidToday, StaffActor } from "@/services/admin.types";

import { type AdminMenuGroup, isCurrentScreen } from "./admin-menu";
import { UserBlock } from "./user-block";

interface AdminSidebarProps {
  menu: AdminMenuGroup[];
  actor: StaffActor;
  signOutAction: () => Promise<void>;
  /** Inside the mobile drawer: adds the close button, and links close the drawer. */
  inDrawer?: boolean;
  /** The "PAID TODAY" card's figures (Phase 4, ticket 11): an Owner's; null shows no card. */
  paidToday?: PaidToday | null;
}

/** The logo with the ADMIN tag, atop the sidebar and in the mobile Menu bar. */
export function AdminBrand() {
  return (
    <span className="flex items-center gap-2">
      <BrandLogo alt={config.site.name} />
      <span className="border-[1.5px] bg-accent px-1.25 py-1 font-mono text-[10px] leading-none font-bold tracking-[0.08em] text-accent-foreground">
        ADMIN
      </span>
    </span>
  );
}

const itemClass =
  "flex min-h-11 items-center gap-2.5 px-2.5 text-[15px] font-semibold transition-colors motion-reduce:transition-none";

/**
 * The sidebar's contents (mockup 14–38): the logo with the ADMIN tag, an
 * Owner's "PAID TODAY" card opening Orders (ticket 11), the grouped menu,
 * "View site ↗" and the signed-in User. The desktop sidebar and the mobile
 * drawer (mockup 40–69) both use it.
 */
export function AdminSidebar({
  menu,
  actor,
  signOutAction,
  inDrawer = false,
  paidToday = null,
}: AdminSidebarProps) {
  const pathname = usePathname() ?? "";
  const idPrefix = useId();
  // In the drawer, following a link also closes it.
  const closesDrawer = (link: React.ReactElement) =>
    inDrawer ? <SheetClose asChild>{link}</SheetClose> : link;

  return (
    <div className="flex min-h-full flex-col gap-4.5 px-3.5 pt-4.5 pb-5.5">
      <div className="flex items-center justify-between gap-2.5 px-1 py-0.5">
        <AdminBrand />
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

      {paidToday ? closesDrawer(<PaidTodayCard paidToday={paidToday} />) : null}

      <nav aria-label="Admin" className="flex flex-col gap-3.5">
        {menu.map((group) => {
          const labelId = `${idPrefix}-${group.label}`;
          return (
            <div key={group.label} className="flex flex-col gap-0.5">
              <p
                id={labelId}
                className="px-2.5 pb-1 font-mono text-[10px] font-bold tracking-[0.1em] text-muted-foreground"
              >
                {group.label}
              </p>
              <ul aria-labelledby={labelId} className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const current = isCurrentScreen(pathname, item.href);
                  return (
                    <li key={item.key}>
                      {closesDrawer(
                        <Link
                          href={item.href}
                          aria-current={current ? "page" : undefined}
                          className={cn(
                            itemClass,
                            current ? "bg-primary text-primary-foreground" : "hover:bg-ayc-cream",
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "w-5 font-mono text-[11px] font-bold",
                              current ? "text-ayc-orange" : "text-ayc-blue",
                            )}
                          >
                            {item.code}
                          </span>
                          <span className="flex-1">{item.label}</span>
                        </Link>,
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {closesDrawer(
          <Link href={paths.home} className={cn(itemClass, "hover:bg-ayc-cream")}>
            <span aria-hidden="true" className="w-5" />
            <span className="flex-1">
              View site <span aria-hidden="true">↗</span>
            </span>
          </Link>,
        )}
      </nav>

      <UserBlock actor={actor} signOutAction={signOutAction} />
    </div>
  );
}

/**
 * The "PAID TODAY · 22 OCT · ₱6,240 · 9 orders · 4 pending" card (mockup
 * 17–21), opening Orders. In the drawer, SheetClose hands it the link's
 * click handler and ref, which it passes on.
 */
function PaidTodayCard({
  paidToday,
  ...link
}: { paidToday: PaidToday } & Omit<React.ComponentProps<typeof Link>, "href" | "className">) {
  const card = paidTodayCard(paidToday);
  return (
    <Link
      {...link}
      href={paths.admin.orders}
      className="flex flex-col gap-1.5 border-[1.5px] bg-primary p-3.5 text-primary-foreground shadow-hard shadow-ayc-orange transition-transform hover:-translate-px motion-reduce:transition-none"
    >
      <span className="flex justify-between font-mono text-[10px] font-medium tracking-[0.06em] text-ayc-on-navy-muted">
        <span>PAID TODAY</span>
        <span>{card.date}</span>
      </span>
      <span className="text-[26px] leading-none font-black tracking-[-0.03em]">{card.amount}</span>
      <span className="text-[13px] text-ayc-on-navy-soft">
        {card.orders} · <span className="font-bold text-ayc-orange">{card.pending}</span>
      </span>
    </Link>
  );
}
