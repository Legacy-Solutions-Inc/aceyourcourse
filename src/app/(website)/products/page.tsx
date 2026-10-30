import type { Metadata } from "next";

import { Marquee } from "@/components/website/marquee";
import { ComingSoonRow } from "@/components/website/products/coming-soon-row";
import { FilterBar } from "@/components/website/products/filter-bar";
import { PhysicalOrApp } from "@/components/website/products/physical-or-app";
import { ProductPicker } from "@/components/website/products/product-picker";
import { ProductsGrid } from "@/components/website/products/products-grid";
import { PRODUCTS_SECTION_IDS } from "@/components/website/products/section-ids";
import { config } from "@/config";
import { productsPageCopy } from "@/content/products-page";
import { facetCounts, priceBoundsOf } from "@/lib/catalogue/product-filters";
import { parseProductSearchParams, productsQueryOf } from "@/lib/catalogue/product-search-params";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import { getWebsiteSettings, listExams, listProducts } from "@/services/catalogue";

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const copy = productsPageCopy;
const container = "mx-auto max-w-324 px-[clamp(20px,5vw,72px)]";
const examList = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
const heroLink =
  "flex min-h-13.5 items-center gap-1.5 border-[1.5px] border-ayc-cream text-base no-underline focus-visible:outline-ayc-cream";

// Every filtered view is one page to search engines: /products.
export async function generateMetadata(): Promise<Metadata> {
  const title = copy.metaTitle;
  const description = copy.metaDescription;
  const shareTitle = `${title} · ${config.site.name}`;
  // Setting openGraph here replaces the root's, so the share image is repeated.
  const images = [{ url: paths.shareImage, alt: config.site.name }];
  return {
    title,
    description,
    alternates: { canonical: paths.products.list },
    openGraph: {
      type: "website",
      siteName: config.site.name,
      locale: "en_PH",
      title: shareTitle,
      description,
      url: paths.products.list,
      images,
    },
    twitter: { card: "summary_large_image", title: shareTitle, description, images },
  };
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  // Every Live Product, best selling first: the counts, the price bounds and
  // the picker never include Coming Soon.
  const [exams, settings, { items: live }] = await Promise.all([
    listExams(),
    getWebsiteSettings(),
    listProducts(),
  ]);
  const examCodes = exams.map((exam) => exam.code);
  const priceBounds = priceBoundsOf(live);
  const filters = parseProductSearchParams(await searchParams, {
    examCodes,
    memberAppLive: settings.memberAppLive,
    priceBounds,
  });

  // Coming Soon has no price and no sort, so only the Exam, format and search apply.
  const [shown, comingSoon] = await Promise.all([
    listProducts(filters),
    listProducts({
      state: "coming-soon",
      examCode: filters.examCode,
      format: filters.format,
      query: filters.query,
    }),
  ]);

  const liveExamCodes = examCodes.filter((code) =>
    live.some((product) => product.examCode === code),
  );
  const appSentence = settings.memberAppLive
    ? copy.hero.appSentence(live.filter((product) => product.availableInApp).length, live.length)
    : null;
  const ticker = [liveExamCodes.join(" · "), ...copy.hero.ticker];

  return (
    <>
      <section className="bg-ayc-navy text-ayc-cream">
        <div
          className={cn(
            container,
            "flex flex-wrap items-end justify-between gap-x-12 gap-y-7 pt-[clamp(48px,6vw,88px)] pb-[clamp(40px,5vw,64px)]",
          )}
        >
          <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-5">
            <p className="flex items-center gap-2.5 self-start rounded-full border-[1.5px] border-ayc-cream/50 px-3 py-2.25 font-mono text-xs leading-none font-bold tracking-[0.08em] uppercase">
              <span aria-hidden="true" className="size-2 rounded-full bg-ayc-orange" />
              {copy.hero.pill(liveExamCodes.length)}
            </p>
            <h1 className="max-w-[12ch] text-[clamp(44px,6.4vw,92px)] leading-[0.94] font-extrabold tracking-[-0.045em] text-balance">
              {copy.hero.heading}
            </h1>
            <p className="max-w-[32em] text-[clamp(17px,1.5vw,20px)] leading-normal text-ayc-on-navy-soft">
              {copy.hero.subLineLead} {examList.format(liveExamCodes)}. {copy.hero.shipped}
              {appSentence ? ` ${appSentence}` : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <a
              href={`#${PRODUCTS_SECTION_IDS.picker}`}
              className={cn(
                heroLink,
                "bg-ayc-orange px-5.5 font-extrabold text-ayc-navy shadow-hard-md shadow-ayc-cream transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:text-ayc-navy motion-reduce:transition-none",
              )}
            >
              {copy.hero.helpMeChoose}
            </a>
            <a
              href={`#${PRODUCTS_SECTION_IDS.grid}`}
              className={cn(
                heroLink,
                "px-5 font-bold text-ayc-cream hover:bg-ayc-cream/10 hover:text-ayc-cream",
              )}
            >
              {copy.hero.browseAll}
              <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
        <Marquee
          label={copy.hero.tickerLabel}
          className="border-t-[1.5px] border-ayc-navy bg-ayc-orange text-ayc-navy"
          rowClassName="gap-7 pr-7 py-3.25 font-mono text-[13px] font-bold tracking-[0.06em] whitespace-nowrap"
        >
          {ticker.map((item) => (
            <span key={item} className="flex items-center gap-7">
              <span>{item}</span>
              <span aria-hidden="true">✦</span>
            </span>
          ))}
        </Marquee>
      </section>

      <ProductPicker
        products={live}
        examCodes={liveExamCodes}
        memberAppLive={settings.memberAppLive}
      />

      <ProductsGrid
        products={shown.items}
        total={live.length}
        memberAppLive={settings.memberAppLive}
        shopLinks={settings.shopLinks}
        filterBar={
          <FilterBar
            query={productsQueryOf(filters)}
            examCodes={examCodes}
            counts={facetCounts(live, filters.examCode)}
            priceBounds={priceBounds}
            memberAppLive={settings.memberAppLive}
          />
        }
      />

      <ComingSoonRow products={comingSoon.items} memberAppLive={settings.memberAppLive} />

      <PhysicalOrApp memberAppLive={settings.memberAppLive} />
    </>
  );
}
