"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { MenuBar } from "@/components/menu-bar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { BrandLogo } from "@/components/website/brand-logo";
import { config } from "@/config";

import { isFocusScreen } from "./member-menu";
import { MemberSidebar, type ShellExams, type ShellUser } from "./member-sidebar";

interface MemberDrawerProps extends ShellExams {
  user: ShellUser;
  signOutAction: () => Promise<void>;
}

/**
 * Below 760 px there is no sidebar: the "Menu" button in the bar across the
 * top opens it as a slide-in drawer over a scrim (mockup L89–113). Escape, ✕,
 * the scrim or a link close it, and focus goes back to the button. A focus
 * screen (the flashcard player) has a back bar instead, and no Menu bar.
 */
export function MemberDrawer({ user, exams, switchAction, signOutAction }: MemberDrawerProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  if (isFocusScreen(pathname)) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <MenuBar
        label="Member App menu"
        brand={<BrandLogo alt={config.site.name} />}
        className="print:hidden"
      />
      <SheetContent
        side="left"
        showCloseButton={false}
        aria-describedby={undefined}
        className="w-[min(86%,330px)] gap-0 overflow-y-auto border-r-[1.5px] bg-ayc-sand p-0 shadow-[6px_0_0_var(--ayc-navy)]"
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <MemberSidebar
          user={user}
          exams={exams}
          switchAction={switchAction}
          signOutAction={signOutAction}
          inDrawer
        />
      </SheetContent>
    </Sheet>
  );
}
