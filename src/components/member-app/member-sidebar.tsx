"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import { SheetClose } from "@/components/ui/sheet";
import { BrandLogo } from "@/components/website/brand-logo";
import { config } from "@/config";
import { cn } from "@/lib/utils";

import { isCurrentItem, MEMBER_MENU } from "./member-menu";

/** The signed-in Member, as the shell's footer shows them. */
export interface ShellUser {
  name: string | null;
  email: string;
}

interface MemberSidebarProps {
  user: ShellUser;
  /** The Member App's sign-out Server Action. */
  signOutAction: () => Promise<void>;
  /** Inside the mobile drawer: adds ✕, and links close the drawer. */
  inDrawer?: boolean;
}

/**
 * The sidebar's contents (mockup L119–139; BUILD-MAP §2): the logo, the seven
 * numbered nav items, and a footer with the Member's name, email and Sign
 * out. The desktop sidebar and the mobile drawer (mockup L89–113) both use it.
 * The exam switcher card comes with ticket 03, and the streak button and the
 * access badge with the tickets that give them something true to say.
 */
export function MemberSidebar({ user, signOutAction, inDrawer = false }: MemberSidebarProps) {
  const pathname = usePathname() ?? "";
  // In the drawer, following a link also closes it.
  const closesDrawer = (link: React.ReactElement) =>
    inDrawer ? <SheetClose asChild>{link}</SheetClose> : link;

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

      <div className="mt-auto flex flex-col gap-2 border-t-[1.5px] pt-3.5">
        {user.name ? <p className="text-[15px] font-bold">{user.name}</p> : null}
        <p className="font-mono text-[11px] wrap-anywhere text-muted-foreground">{user.email}</p>
        <form action={signOutAction} className="flex justify-end">
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
