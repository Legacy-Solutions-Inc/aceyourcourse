"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useId } from "react";

import { BrandLogo } from "@/components/website/brand-logo";
import { SheetClose } from "@/components/ui/sheet";
import { config } from "@/config";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { StaffActor } from "@/services/admin.types";

import { type AdminMenuGroup, isCurrentScreen } from "./admin-menu";
import { UserBlock } from "./user-block";

interface AdminSidebarProps {
  menu: AdminMenuGroup[];
  actor: StaffActor;
  signOutAction: () => Promise<void>;
  /** Inside the mobile drawer: adds the close button, and links close the drawer. */
  inDrawer?: boolean;
}

const itemClass =
  "flex min-h-11 items-center gap-2.5 px-2.5 text-[15px] font-semibold transition-colors motion-reduce:transition-none";

/**
 * The sidebar's contents (mockup 14–38): the logo with the ADMIN tag, the
 * grouped menu, "View site ↗" and the signed-in User. The desktop sidebar and
 * the mobile drawer (mockup 40–69) both use it.
 */
export function AdminSidebar({ menu, actor, signOutAction, inDrawer = false }: AdminSidebarProps) {
  const pathname = usePathname() ?? "";
  const idPrefix = useId();
  // In the drawer, following a link also closes it.
  const closesDrawer = (link: React.ReactElement) =>
    inDrawer ? <SheetClose asChild>{link}</SheetClose> : link;

  return (
    <div className="flex min-h-full flex-col gap-4.5 px-3.5 pt-4.5 pb-5.5">
      <div className="flex items-center justify-between gap-2.5 px-1 py-0.5">
        <span className="flex items-center gap-2">
          <BrandLogo alt={config.site.name} />
          <span className="border-[1.5px] bg-accent px-1.25 py-1 font-mono text-[10px] leading-none font-bold tracking-[0.08em] text-accent-foreground">
            ADMIN
          </span>
        </span>
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
