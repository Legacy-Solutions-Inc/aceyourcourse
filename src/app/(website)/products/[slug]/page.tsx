import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ComingSoonNote } from "@/components/website/coming-soon-note";
import { JsonLd } from "@/components/website/json-ld";
import { PriceRow } from "@/components/website/price-row";
import { ProductCard } from "@/components/website/product-card";
import { ProductGallery } from "@/components/website/product-gallery";
import { ProductAppBand } from "@/components/website/product-app-band";
import { ProductBuyBox } from "@/components/website/product-buy-box";
import { ProductReviews } from "@/components/website/product-reviews";
import { RatingStar } from "@/components/website/rating-star";
import {
  SelectedPrice,
  VariationPicker,
  VariationProvider,
} from "@/components/website/variation-picker";
import { config } from "@/config";
import { websiteCopy } from "@/content/website";
import { productFormatLabel } from "@/lib/catalogue/format";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/catalogue/json-ld";
import { formatCount, formatRating } from "@/lib/catalogue/figures";
import { productOptionsNote, productPriceRange } from "@/lib/catalogue/price";
import {
  productMadeFor,
  productSeoDescription,
  productSeoTitle,
  productWhatsInside,
} from "@/lib/catalogue/product-copy";
import { formatAsOf } from "@/lib/manila-time";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import {
  getExamByCode,
  getProductBySlug,
  getWebsiteSettings,
  listRelatedProducts,
  listReviews,
} from "@/services/catalogue";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

const copy = websiteCopy.product;
const container = "mx-auto max-w-324 px-[clamp(20px,5vw,72px)]";
const eyebrow = "font-mono text-xs font-medium tracking-[0.06em] text-ayc-slate uppercase";
const badge = "font-mono text-xs leading-none font-bold uppercase";
const descriptionHeading = "font-mono text-xs font-bold tracking-[0.06em] text-ayc-blue uppercase";

// One read per request, shared by generateMetadata and the page. Null for an
// unknown slug or a Product with "Show on website" off.
const findProduct = cache(async (slug: string) => {
  const product = await getProductBySlug(slug);
  const exam = product ? await getExamByCode(product.examCode) : null;
  return product && exam ? { product, exam } : null;
});

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const found = await findProduct((await params).slug);
  // The page itself calls notFound(), so the 404 renders inside the Website
  // shell. (Calling it here would render the root 404 instead.)
  if (!found) return {};
  const { product, exam } = found;
  const title = productSeoTitle(product, exam);
  const description = productSeoDescription(product, exam);
  const url = paths.products.details(product.slug);
  // A Coming Soon Product has only the placeholder, so it shares the site's
  // default image. (Setting openGraph here replaces the root's, image and all.)
  const cover = product.state === "live" ? product.photos[0] : undefined;
  const images = cover
    ? [{ url: cover.src, alt: cover.alt }]
    : [{ url: paths.shareImage, alt: config.site.name }];
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: config.site.name,
      locale: "en_PH",
      title,
      description,
      url,
      images,
    },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const found = await findProduct((await params).slug);
  if (!found) notFound();
  const { product, exam } = found;
  const live = product.state === "live";
  // A Coming Soon page shows no prices at all, so it has no Reviews and no
  // (priced) related Product cards.
  const [settings, related, reviews] = await Promise.all([
    getWebsiteSettings(),
    live ? listRelatedProducts(product) : null,
    live ? listReviews({ productSlug: product.slug }) : null,
  ]);

  const priceRange = productPriceRange(product);
  const optionsNote = productOptionsNote(product);
  const deal = live && product.deal ? copy.deal : null;
  const subjects = product.subjectCodes.flatMap((code) =>
    exam.subjects.filter((subject) => subject.code === code),
  );
  const asOf = product.shopee ? formatAsOf(product.shopee.asOf) : null;
  const breadcrumb = [
    { name: "Products", path: paths.products.list },
    { name: exam.board, path: paths.exams.details(exam.code) },
    { name: product.shortName, path: paths.products.details(product.slug) },
  ];
  const productLd = productJsonLd(product, exam, config.site.url);

  return (
    <>
      <section className={cn(container, "pt-5 pb-[clamp(56px,7vw,96px)]")}>
        <nav aria-label="Breadcrumb" className="mb-[clamp(20px,3vw,40px)]">
          <ol className="flex flex-wrap gap-2 font-mono text-xs font-medium tracking-[0.04em] text-ayc-slate uppercase">
            {breadcrumb.map((crumb, index) => {
              const current = index === breadcrumb.length - 1;
              return (
                <li key={crumb.path} className="flex gap-2">
                  {current ? (
                    <span aria-current="page" className="text-ayc-navy">
                      {crumb.name}
                    </span>
                  ) : (
                    <>
                      <Link
                        href={crumb.path}
                        className="text-ayc-slate no-underline hover:text-ayc-navy"
                      >
                        {crumb.name}
                      </Link>
                      <span aria-hidden="true">/</span>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="flex flex-wrap items-start gap-[clamp(32px,5vw,72px)]">
          <div className="min-w-0 flex-[1.15_1_340px]">
            <ProductGallery photos={live ? product.photos : []} />
          </div>

          {/* The picked variation's price shows in the price row and the buy box. */}
          <VariationProvider variations={product.variations}>
            <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-5.5">
              <ul aria-label="Details" className="flex flex-wrap gap-1.5">
                <li className={cn(badge, "bg-ayc-blue px-2.25 py-1.75 text-ayc-cream")}>
                  {exam.code} · {exam.board}
                </li>
                {product.edition ? (
                  <li className={cn(badge, "border-[1.5px] border-ayc-navy px-2 py-1.5")}>
                    {product.edition}
                  </li>
                ) : null}
                <li className={cn(badge, "border-[1.5px] border-ayc-navy px-2 py-1.5")}>
                  {productFormatLabel(product.format)}
                </li>
                {live ? null : (
                  <li className={cn(badge, "bg-ayc-orange px-2.25 py-1.75 text-ayc-navy")}>
                    {copy.comingSoon}
                  </li>
                )}
              </ul>

              <div className="flex flex-col gap-3">
                <h1 className="text-[clamp(32px,3.6vw,48px)] leading-[1.02] font-extrabold tracking-[-0.03em] text-balance">
                  {product.title}
                </h1>
                {live && product.shopee ? (
                  <p
                    data-testid="shopee-figures"
                    className="font-mono text-[13px] font-medium text-ayc-slate"
                  >
                    <RatingStar /> {formatRating(product.shopee.rating)} ·{" "}
                    {formatCount(product.shopee.ratingCount)} ratings ·{" "}
                    {formatCount(product.shopee.unitsSold)} sold · {asOf}
                  </p>
                ) : null}
              </div>

              {priceRange ? (
                <>
                  <PriceRow price={<SelectedPrice fallback={priceRange} />} deal={deal} />
                  {product.variations.length > 0 ? (
                    <VariationPicker />
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      <p className={eyebrow}>Options</p>
                      <p className="border-[1.5px] border-dashed border-ayc-slate px-4 py-3.5 text-[15px] leading-snug">
                        {optionsNote}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <ComingSoonNote productSlug={product.slug} shopLinks={settings.shopLinks} />
              )}

              <div className="flex flex-col gap-2.5">
                <h2 className={eyebrow}>Subjects covered</h2>
                <ul className="flex flex-col border-[1.5px] border-ayc-navy bg-ayc-paper">
                  {subjects.map((subject) => (
                    <li
                      key={subject.code}
                      className="flex items-center gap-3.5 border-b border-ayc-ruled px-3.5 py-2.5 last:border-b-0"
                    >
                      <span className="min-w-13 flex-none bg-ayc-navy px-2 py-1.5 text-center font-mono text-[11px] leading-tight font-bold text-ayc-cream uppercase">
                        {subject.code}
                      </span>
                      <span className="text-[15px] leading-snug">{subject.name}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <dl className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] border-t-[1.5px] border-ayc-navy">
                {[
                  { term: "Format", detail: productFormatLabel(product.format) },
                  { term: "Size", detail: product.size },
                  { term: "Ships from", detail: copy.shipsFrom },
                ].map((spec) => (
                  <div key={spec.term} className="border-b border-ayc-rule py-3 pr-3">
                    <dt className="font-mono text-[11px] text-ayc-slate uppercase">{spec.term}</dt>
                    <dd className="mt-1 text-[17px] font-bold">{spec.detail}</dd>
                  </div>
                ))}
              </dl>

              <ProductBuyBox
                product={product}
                shopLinks={settings.shopLinks}
                contactEmail={settings.contactEmail}
              />

              <ProductAppBand product={product} memberAppLive={settings.memberAppLive} />
            </div>
          </VariationProvider>
        </div>
      </section>

      <section aria-label="Description" className="border-y-[1.5px] border-ayc-navy bg-ayc-paper">
        <div
          className={cn(
            container,
            "grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-[clamp(28px,4vw,56px)] py-[clamp(48px,6vw,88px)]",
          )}
        >
          <div className="flex flex-col gap-3">
            <h2 className={descriptionHeading}>01 · What’s inside</h2>
            <p className="text-[17px] leading-relaxed text-pretty">
              {productWhatsInside(product, exam)}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className={descriptionHeading}>02 · Made for</h2>
            <ul className="flex flex-col gap-2 text-[17px] leading-snug">
              {productMadeFor(product, exam).map((audience) => (
                <li key={audience} className="flex gap-2.5">
                  <span aria-hidden="true" className="text-ayc-star">
                    ✓
                  </span>
                  {audience}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className={descriptionHeading}>03 · Authentic copies only</h2>
            <p className="text-[17px] leading-relaxed text-pretty">{copy.authentic}</p>
          </div>
        </div>
      </section>

      {reviews ? (
        <div className={cn(container, "py-[clamp(56px,7vw,96px)]")}>
          <ProductReviews product={product} reviews={reviews.items} />
        </div>
      ) : null}

      {related && related.items.length > 0 ? (
        <section
          aria-labelledby="more-heading"
          className="border-t-[1.5px] border-ayc-navy bg-ayc-sand"
        >
          <div className={cn(container, "flex flex-col gap-7 py-[clamp(56px,7vw,96px)]")}>
            <h2
              id="more-heading"
              className="text-[clamp(30px,3.6vw,46px)] leading-none font-extrabold tracking-[-0.03em]"
            >
              {related.scope === "same-exam"
                ? `More for the ${exam.board}`
                : "Best sellers from other boards"}
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-x-7 gap-y-8">
              {related.items.map((item) => (
                <ProductCard key={item.id} product={item} memberAppLive={settings.memberAppLive} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {productLd ? <JsonLd data={productLd} /> : null}
      <JsonLd data={breadcrumbJsonLd(breadcrumb, config.site.url)} />
    </>
  );
}
