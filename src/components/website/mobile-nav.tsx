"use client";

import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";

import { BrandLogo } from "@/components/website/brand-logo";
import { MarketplaceLink } from "@/components/website/marketplace-link";
import { NavLink } from "@/components/website/nav-link";
import { SITE_LINKS } from "@/components/website/site-links";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { marketplaceShops, websiteCopy } from "@/content/website";
import { examGridTemplate } from "@/lib/catalogue/exam-grid";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { Exam, Marketplace } from "@/services/catalogue.types";

interface MobileNavProps {
  exams: ReadonlyArray<Pick<Exam, "code" | "name">>;
  shopLinks: Record<Marketplace, string | null>;
  memberAppLive: boolean;
}

const label = "font-mono text-[11px] font-bold tracking-[0.08em] uppercase";

/** The Exam tiles' grid: built for 1–12 Exams (ticket 23), never narrower than a tile. */
const MENU_GRID = { min: "3.5rem", gap: "0.375rem" };

/** The burger and drawer used below the 760 px breakpoint. */
export function MobileNav({ exams, shopLinks, memberAppLive }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const shops = marketplaceShops(shopLinks);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open menu"
          className="flex size-11 cursor-pointer items-center justify-center border-[1.5px]"
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>
      </SheetTrigger>

      <SheetContent
        side="top"
        showCloseButton={false}
        aria-describedby={undefined}
        className="max-h-svh gap-0 overflow-y-auto border-b-[1.5px] p-0 shadow-none"
      >
        <div className="flex min-h-18 items-center justify-between gap-5 border-b-[1.5px] px-5">
          <BrandLogo alt="" />
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetClose asChild>
            <button
              type="button"
              aria-label="Close menu"
              className="flex size-11 cursor-pointer items-center justify-center border-[1.5px] bg-primary text-primary-foreground"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </SheetClose>
        </div>

        <div className="flex flex-col gap-4.5 px-5 pt-4 pb-6">
          <section className="flex flex-col gap-2">
            <h2 className={cn(label, "text-ayc-blue")}>Exams</h2>
            <ul
              className="grid gap-1.5"
              style={{ gridTemplateColumns: examGridTemplate(exams.length, MENU_GRID) }}
            >
              {exams.map((exam) => (
                <li key={exam.code} className="flex">
                  <SheetClose asChild>
                    <Link
                      href={paths.exams.details(exam.code)}
                      className="flex min-h-13 flex-1 items-center justify-center border-[1.5px] bg-ayc-paper font-mono text-sm font-bold"
                    >
                      {exam.code}
                      <span className="sr-only"> {exam.name}</span>
                    </Link>
                  </SheetClose>
                </li>
              ))}
            </ul>
          </section>

          <nav aria-label="Menu">
            <ul className="flex flex-col">
              {SITE_LINKS.map((siteLink) => (
                <li key={siteLink.href}>
                  <SheetClose asChild>
                    <NavLink
                      href={siteLink.href}
                      className="group flex min-h-14 items-center justify-between border-b-[1.5px] text-2xl font-extrabold tracking-tight"
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className="size-2 rounded-full bg-ayc-orange opacity-0 group-aria-[current=page]:opacity-100"
                        />
                        {siteLink.label}
                      </span>
                      <ArrowRight aria-hidden="true" className="size-4.5" />
                    </NavLink>
                  </SheetClose>
                </li>
              ))}
            </ul>
          </nav>

          {memberAppLive ? (
            <div className="grid grid-cols-2 gap-2.5">
              <SheetClose asChild>
                <Link
                  href={paths.memberApp.home}
                  className="flex min-h-13 items-center justify-center border-[1.5px] text-[15px] font-bold"
                >
                  {websiteCopy.nav.signIn}
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href={paths.memberApp.home}
                  className="flex min-h-13 items-center justify-center border-[1.5px] bg-accent text-[15px] font-extrabold text-accent-foreground shadow-hard-sm"
                >
                  {websiteCopy.nav.startReviewing}
                </Link>
              </SheetClose>
            </div>
          ) : null}

          {shops.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className={cn(label, "font-medium text-muted-foreground")}>
                {websiteCopy.nav.printedCopies}
              </h2>
              <ul className="grid grid-cols-3 gap-2">
                {shops.map((shop) => (
                  <li key={shop.id} className="flex">
                    <MarketplaceLink
                      href={shop.href}
                      marketplace={shop.id}
                      link="shop"
                      className="flex min-h-11 flex-1 items-center justify-center gap-1 border-[1.5px] text-sm font-bold"
                    >
                      {shop.shortName} <span aria-hidden="true">↗</span>
                    </MarketplaceLink>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
