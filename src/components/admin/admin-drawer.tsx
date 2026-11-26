"use client";

import { useState } from "react";

import { MenuBar } from "@/components/menu-bar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { PaidToday, StaffActor } from "@/services/admin.types";

import type { AdminMenuGroup } from "./admin-menu";
import { AdminBrand, AdminSidebar } from "./admin-sidebar";

interface AdminDrawerProps {
  menu: AdminMenuGroup[];
  actor: StaffActor;
  signOutAction: () => Promise<void>;
  /** The "PAID TODAY" card's figures: an Owner's; null shows no card. */
  paidToday?: PaidToday | null;
}

/**
 * Below 760 px, the "Menu" button in the bar across the top opens the sidebar
 * as a slide-in drawer (mockup 40–69). Escape, the scrim and the close button
 * close it, and focus goes back to the button.
 */
export function AdminDrawer({ menu, actor, signOutAction, paidToday = null }: AdminDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <MenuBar label="Admin menu" brand={<AdminBrand />} />
      <SheetContent
        side="left"
        showCloseButton={false}
        aria-describedby={undefined}
        className="w-[min(86%,320px)] gap-0 overflow-y-auto border-r-[1.5px] bg-ayc-sand p-0 shadow-[6px_0_0_var(--ayc-navy)]"
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <AdminSidebar
          menu={menu}
          actor={actor}
          signOutAction={signOutAction}
          paidToday={paidToday}
          inDrawer
        />
      </SheetContent>
    </Sheet>
  );
}
