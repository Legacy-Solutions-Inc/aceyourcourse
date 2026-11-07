import Link from "next/link";

import { ExternalLink } from "@/components/website/external-link";
import { HOME_SECTION_IDS } from "@/components/website/home/section-ids";
import { MarketplaceLink } from "@/components/website/marketplace-link";
import { marketplaceShops, websiteCopy } from "@/content/website";
import { formatCount, formatRating } from "@/lib/catalogue/figures";
import { manilaYear, formatAsOf } from "@/lib/manila-time";
import { socialHandle } from "@/lib/social-handle";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import { getWebsiteSettings, listExams } from "@/services/catalogue";

const columnLink =
  "flex min-h-7 items-center text-ayc-cream hover:text-ayc-orange focus-visible:outline-ayc-orange";

function FooterColumn({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <h2
        id={id}
        className="pb-1.5 font-mono text-[11px] font-medium tracking-[0.08em] text-ayc-on-navy-muted uppercase"
      >
        {title}
      </h2>
      <ul aria-labelledby={id} className="flex flex-col gap-1.5">
        {children}
      </ul>
    </div>
  );
}

/**
 * The Website footer. A Server Component that reads the Catalogue seam. A shop
 * or social item whose link is empty is left out, and the Member App items
 * render only while the switch is on.
 */
export async function SiteFooter() {
  const [exams, settings] = await Promise.all([listExams(), getWebsiteSettings()]);
  const { shopLinks, socialLinks, shopStats, contactEmail, memberAppLive } = settings;
  const copy = websiteCopy.footer;

  const shops = marketplaceShops(shopLinks);
  const socials = (
    [
      ["TikTok", socialLinks.tiktok],
      ["Facebook", socialLinks.facebook],
      ["Instagram", socialLinks.instagram],
    ] as const
  ).flatMap(([network, href]) => (href ? [{ network, href, handle: socialHandle(href) }] : []));

  return (
    <footer className="bg-ayc-navy px-[clamp(20px,5vw,72px)] pt-[clamp(48px,6vw,88px)] pb-7 text-ayc-cream">
      <div className="mx-auto flex max-w-324 flex-col gap-12">
        <div className="flex flex-wrap items-end justify-between gap-10">
          <p className="max-w-[13ch] text-[clamp(34px,4.6vw,64px)] leading-none font-extrabold tracking-[-0.03em] text-balance">
            {copy.headlineLead} <span className="text-ayc-orange">{copy.headlineHighlight}</span>
          </p>
          <div className="flex max-w-95 flex-col gap-3">
            <p className="font-mono text-[11px] leading-snug font-medium tracking-[0.08em] text-ayc-on-navy-muted uppercase">
              {copy.whereToBuyLabel}
            </p>
            <p className="text-base leading-normal text-ayc-on-navy-soft">
              {copy.whereToBuy}
              {memberAppLive ? ` ${copy.whereToBuyApp}` : null}
            </p>
            {shops.length > 0 ? (
              <ul aria-label="Marketplaces" className="flex flex-wrap gap-2">
                {shops.map((shop, index) => (
                  <li key={shop.id}>
                    <MarketplaceLink
                      href={shop.href}
                      marketplace={shop.id}
                      link="shop"
                      className={cn(
                        "inline-flex border-[1.5px] border-ayc-cream px-3.5 py-2.75 text-sm font-bold focus-visible:outline-ayc-orange",
                        index === 0
                          ? "bg-accent text-accent-foreground"
                          : "text-ayc-cream hover:bg-ayc-cream/10",
                      )}
                    >
                      {shop.name} <span aria-hidden="true">&nbsp;↗</span>
                    </MarketplaceLink>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-x-8 gap-y-7 border-t border-ayc-navy-rule pt-8 text-[15px]">
          <FooterColumn id="footer-exams" title="Exams">
            {exams.map((exam) => (
              <li key={exam.code}>
                <Link href={paths.exams.details(exam.code)} className={columnLink}>
                  {exam.name}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn id="footer-shop" title="Shop">
            <li>
              <Link href={paths.products.list} className={columnLink}>
                All products
              </Link>
            </li>
            <li>
              <Link href={paths.reviews} className={columnLink}>
                Reviews
              </Link>
            </li>
            <li>
              <Link href={`${paths.home}#${HOME_SECTION_IDS.authenticity}`} className={columnLink}>
                {copy.spotAFake}
              </Link>
            </li>
            {memberAppLive ? (
              <li>
                <Link href={paths.memberApp.home} className={columnLink}>
                  {copy.signInToApp}
                </Link>
              </li>
            ) : null}
          </FooterColumn>

          <FooterColumn id="footer-company" title="Company">
            <li>
              <Link href={paths.about} className={columnLink}>
                About us
              </Link>
            </li>
            <li>
              <Link href={paths.faq} className={columnLink}>
                FAQ
              </Link>
            </li>
            <li>
              <Link href={paths.legal.privacy} className={columnLink}>
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href={paths.legal.terms} className={columnLink}>
                Terms of Use
              </Link>
            </li>
            <li>
              <a href={`mailto:${contactEmail}`} className={cn(columnLink, "wrap-anywhere")}>
                {contactEmail}
              </a>
            </li>
          </FooterColumn>

          <FooterColumn id="footer-follow" title="Follow">
            {socials.map((social) => (
              <li key={social.network}>
                <ExternalLink href={social.href} className={columnLink}>
                  {social.handle ? `${social.network} ${social.handle}` : social.network}
                  <span aria-hidden="true">&nbsp;↗</span>
                </ExternalLink>
              </li>
            ))}
            {shopLinks.shopee ? (
              <li>
                <MarketplaceLink
                  href={shopLinks.shopee}
                  marketplace="shopee"
                  link="shop"
                  className={columnLink}
                >
                  Shopee · {shopStats.followers} followers
                  <span aria-hidden="true">&nbsp;↗</span>
                </MarketplaceLink>
              </li>
            ) : null}
          </FooterColumn>
        </div>

        <div className="flex flex-wrap justify-between gap-3 border-t border-ayc-navy-rule pt-5 font-mono text-[11px] leading-normal text-ayc-on-navy-muted">
          <p>
            © {manilaYear(new Date())} {websiteCopy.wordmark} · {copy.ipophil}
          </p>
          <p>
            <span aria-hidden="true">★</span> {formatRating(shopStats.rating)} ·{" "}
            {formatCount(shopStats.ratingCount)} ratings · {formatAsOf(shopStats.asOf)} ·{" "}
            {copy.shipping}
          </p>
        </div>
      </div>
    </footer>
  );
}
