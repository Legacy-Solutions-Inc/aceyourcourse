import Link from "next/link";

import { AnnouncementBar } from "@/components/website/announcement-bar";
import { BrandLogo } from "@/components/website/brand-logo";
import { ExamsMenu } from "@/components/website/exams-menu";
import { MobileNav } from "@/components/website/mobile-nav";
import { NavLink } from "@/components/website/nav-link";
import { SITE_LINKS } from "@/components/website/site-links";
import { config } from "@/config";
import { websiteCopy } from "@/content/website";
import { visibleAnnouncement } from "@/lib/announcement";
import { paths } from "@/paths";
import { getWebsiteSettings, listExams } from "@/services/catalogue";

/**
 * The Website header: announcement bar, logo, Exams menu, site links and the
 * Member App buttons. A Server Component that reads the Catalogue seam. Member
 * App buttons and the app announcement render only while the switch is on.
 * The header is the sticky positioning parent for the Exams menu panel.
 */
export async function SiteNav() {
  const [exams, settings] = await Promise.all([listExams(), getWebsiteSettings()]);
  const { memberAppLive } = settings;

  const announcement = visibleAnnouncement(settings.announcement, settings);
  const examTiles = exams.map(({ code, name, board }) => ({ code, name, board }));

  return (
    <header className="sticky top-0 z-50 border-b-[1.5px] bg-background">
      <AnnouncementBar id={announcement.id} messages={announcement.messages} />

      <div className="mx-auto flex min-h-18 max-w-360 items-center justify-between gap-5 px-[clamp(20px,5vw,72px)]">
        <Link
          href={paths.home}
          className="flex shrink-0 items-center transition-transform hover:-translate-y-px motion-reduce:transition-none"
        >
          <BrandLogo alt={config.site.name} priority />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 wide:flex">
          <ExamsMenu exams={examTiles} />
          <ul className="flex items-center gap-1">
            {SITE_LINKS.map((siteLink) => (
              <li key={siteLink.href}>
                <NavLink
                  href={siteLink.href}
                  className="relative flex min-h-11 items-center rounded-full px-3.5 text-[15px] font-semibold transition-colors after:absolute after:inset-x-3.5 after:bottom-1.5 after:h-0.5 after:origin-left after:scale-x-0 after:bg-ayc-orange after:transition-transform hover:bg-ayc-sand aria-[current=page]:after:scale-x-100"
                >
                  {siteLink.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {memberAppLive ? (
          <div className="hidden items-center gap-2.5 wide:flex">
            <Link
              href={paths.memberApp.home}
              className="flex min-h-11 items-center border-[1.5px] px-4 text-sm font-bold transition-colors hover:bg-ayc-sand"
            >
              {websiteCopy.nav.signIn}
            </Link>
            <Link
              href={paths.memberApp.home}
              className="flex min-h-11 items-center gap-2 border-[1.5px] bg-accent px-4 text-sm font-extrabold text-accent-foreground shadow-hard-sm transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-md motion-reduce:transition-none"
            >
              {websiteCopy.nav.startReviewing} <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : null}

        <div className="flex items-center gap-2 wide:hidden">
          {memberAppLive ? (
            <Link
              href={paths.memberApp.home}
              className="flex h-11 items-center border-[1.5px] bg-accent px-3 text-[13px] font-bold whitespace-nowrap text-accent-foreground"
            >
              {websiteCopy.nav.signIn}
            </Link>
          ) : null}
          <MobileNav
            exams={examTiles}
            shopLinks={settings.shopLinks}
            memberAppLive={memberAppLive}
          />
        </div>
      </div>
    </header>
  );
}
