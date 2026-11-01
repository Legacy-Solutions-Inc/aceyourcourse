"use client";

import { useState } from "react";

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { StaffActor } from "@/services/admin.types";

import type { AdminMenuGroup } from "./admin-menu";
import { AdminSidebar } from "./admin-sidebar";

interface AdminDrawerProps {
  menu: AdminMenuGroup[];
  actor: StaffActor;
  signOutAction: () => Promise<void>;
}

/**
 * Below 760 px, the floating "Menu" button (mockup 908) opens the sidebar as a
 * slide-in drawer (mockup 40–69). Escape, the scrim and the close button close
 * it, and focus goes back to the button.
 */
export function AdminDrawer({ menu, actor, signOutAction }: AdminDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="fixed right-4 bottom-4 z-40 flex h-13 cursor-pointer items-center gap-2.5 border-[1.5px] bg-primary pr-4.5 pl-4 text-sm font-bold text-primary-foreground shadow-hard shadow-ayc-orange focus-visible:outline-ayc-orange wide:hidden"
        >
          <span aria-hidden="true" className="flex flex-col gap-1">
            <span className="h-0.5 w-4 bg-primary-foreground" />
            <span className="h-0.5 w-4 bg-primary-foreground" />
            <span className="h-0.5 w-4 bg-primary-foreground" />
          </span>
          Menu
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        showCloseButton={false}
        aria-describedby={undefined}
        className="w-[min(86%,320px)] gap-0 overflow-y-auto border-r-[1.5px] bg-ayc-sand p-0 shadow-[6px_0_0_var(--ayc-navy)]"
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <AdminSidebar menu={menu} actor={actor} signOutAction={signOutAction} inDrawer />
      </SheetContent>
    </Sheet>
  );
}
