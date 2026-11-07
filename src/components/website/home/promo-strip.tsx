import Link from "next/link";

import { ExternalLink } from "@/components/website/external-link";
import { MarketplaceLink } from "@/components/website/marketplace-link";
import { homeCopy } from "@/content/home";
import { isPromoActive, type PromoLink, promoLink } from "@/lib/catalogue/promo";
import type { PromoBanner } from "@/services/catalogue.types";

const buttonClass =
  "flex min-h-10 shrink-0 items-center gap-1.5 border-[1.5px] border-ayc-navy bg-ayc-navy px-3.5 text-sm font-bold text-ayc-cream no-underline shadow-hard-sm shadow-ayc-cream transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:text-ayc-cream motion-reduce:transition-none";

interface PromoStripProps {
  banner: PromoBanner | null;
  /** The request's time, so the strip turns on and off by itself in Manila time. */
  now: Date;
  memberAppLive: boolean;
}

/**
 * The dated sale strip at the top of Home, set in the Admin. It shows from
 * 00:00 Manila on its start date until 23:59:59 Manila on its end date, and
 * not while it's turned off. Its button stays on the Website for a path, and
 * opens anything else in a new tab, recording a `marketplace_click` for a
 * Marketplace. A sale that links into the Member App shows only while the
 * Member App switch is on.
 */
export function PromoStrip({ banner, now, memberAppLive }: PromoStripProps) {
  if (!banner || !isPromoActive(banner, now)) return null;
  const target = promoLink(banner.href);
  if (target.kind === "member-app" && !memberAppLive) return null;

  return (
    <aside
      aria-label={homeCopy.promo.label}
      className="border-b-[1.5px] border-ayc-navy bg-ayc-orange text-ayc-navy"
    >
      <div className="mx-auto flex max-w-324 flex-wrap items-center justify-center gap-x-5 gap-y-2.5 px-[clamp(20px,5vw,72px)] py-3 text-center">
        <p className="text-[15px] leading-snug font-bold text-balance">{banner.text}</p>
        <PromoButton href={banner.href} target={target}>
          {banner.buttonLabel}
        </PromoButton>
      </div>
    </aside>
  );
}

interface PromoButtonProps {
  href: string;
  target: PromoLink;
  children: string;
}

function PromoButton({ href, target, children }: PromoButtonProps) {
  if (target.kind === "internal" || target.kind === "member-app") {
    return (
      <Link href={href} className={buttonClass}>
        {children} <span aria-hidden="true">→</span>
      </Link>
    );
  }
  const label = (
    <>
      {children} <span aria-hidden="true">↗</span>
    </>
  );
  return target.kind === "marketplace" ? (
    <MarketplaceLink
      href={href}
      marketplace={target.marketplace}
      link="shop"
      className={buttonClass}
    >
      {label}
    </MarketplaceLink>
  ) : (
    <ExternalLink href={href} className={buttonClass}>
      {label}
    </ExternalLink>
  );
}
