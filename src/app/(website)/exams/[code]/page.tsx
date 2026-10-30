import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { CompareTable } from "@/components/website/exam/compare-table";
import { ExamHero } from "@/components/website/exam/exam-hero";
import { ExamProducts } from "@/components/website/exam/exam-products";
import { ExamPromoBanner } from "@/components/website/exam/exam-promo-banner";
import { ExamReviews } from "@/components/website/exam/exam-reviews";
import { StoreBand } from "@/components/website/exam/store-band";
import { SubjectsCovered } from "@/components/website/exam/subjects-covered";
import { TryACard } from "@/components/website/exam/try-a-card";
import { JsonLd } from "@/components/website/json-ld";
import { ProductCard } from "@/components/website/product-card";
import { config } from "@/config";
import { examPageCopy, examPromos, sampleCards } from "@/content/exam-pages";
import { examSeoDescription, examSeoTitle } from "@/lib/catalogue/exam-copy";
import { examStats } from "@/lib/catalogue/exam-stats";
import { breadcrumbJsonLd } from "@/lib/catalogue/json-ld";
import { bundleSaving, productFullPrice } from "@/lib/catalogue/price";
import { formatPeso } from "@/lib/money";
import { paths } from "@/paths";
import {
  getExamByCode,
  getProductBySlug,
  getWebsiteSettings,
  listExams,
  listProducts,
  listReviews,
} from "@/services/catalogue";

interface ExamPageProps {
  params: Promise<{ code: string }>;
}

/** The mockup shows the first 7 Reviews across the Exam's Products (L259). */
const REVIEW_LIMIT = 7;

// One read per request, shared by generateMetadata and the page. Null for an
// unknown code or an Exam with no Products shown on the Website.
const findExam = cache(async (code: string) => {
  const [exam, exams] = await Promise.all([getExamByCode(code), listExams()]);
  return exam && exams.some((shown) => shown.code === exam.code) ? { exam, exams } : null;
});

/** URLs use the lowercase code; any other case redirects to it. */
const isCanonical = (code: string) => code === code.toLowerCase();

export async function generateMetadata({ params }: ExamPageProps): Promise<Metadata> {
  const { code } = await params;
  // The page itself redirects or calls notFound(), so the 404 renders inside
  // the Website shell. (Calling it here would render the root 404 instead.)
  const found = isCanonical(code) ? await findExam(code) : null;
  if (!found) return {};
  const { exam } = found;
  const title = examSeoTitle(exam);
  const description = examSeoDescription(exam);
  const url = paths.exams.details(exam.code);
  const shareTitle = `${title} · ${config.site.name}`;
  // Setting openGraph here replaces the root's, so the share image is repeated.
  const images = [{ url: paths.shareImage, alt: config.site.name }];
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: config.site.name,
      locale: "en_PH",
      title: shareTitle,
      description,
      url,
      images,
    },
    twitter: { card: "summary_large_image", title: shareTitle, description, images },
  };
}

export default async function ExamPage({ params }: ExamPageProps) {
  const { code } = await params;
  if (!isCanonical(code)) permanentRedirect(paths.exams.details(code));
  const found = await findExam(code);
  if (!found) notFound();
  const { exam, exams } = found;

  const promos = examPromos.filter((promo) => promo.examCode === exam.code);
  const [settings, { items: live }, { items: comingSoon }, { items: reviews }, promoProducts] =
    await Promise.all([
      getWebsiteSettings(),
      listProducts({ examCode: exam.code }),
      listProducts({ examCode: exam.code, state: "coming-soon" }),
      listReviews({ examCode: exam.code, sort: "exam-page", limit: REVIEW_LIMIT }),
      Promise.all(promos.map((promo) => getProductBySlug(promo.productSlug))),
    ]);

  // Live Products come best selling first, so the first is the top seller.
  // Its "#1" needs Shopee figures to back it.
  const topSeller = live[0] ?? null;
  const numberOneId = topSeller?.shopee ? topSeller.id : null;
  const showAppLinks = settings.memberAppLive && live.some((product) => product.availableInApp);
  // A banner offers its Product's whole set (the CE bundle's 3-in-1), only while it's Live.
  const offers = promos.flatMap((promo, index) => {
    const product = promoProducts[index];
    const price = product ? productFullPrice(product) : null;
    if (!product || !price) return [];
    const saving = bundleSaving(product);
    return [{ promo, product, price, saving: saving === null ? null : formatPeso(saving) }];
  });
  const breadcrumb = [
    { name: "Home", path: paths.home },
    { name: exam.name, path: paths.exams.details(exam.code) },
  ];

  return (
    <>
      <ExamHero
        exam={exam}
        exams={exams}
        stats={examStats(live)}
        liveProducts={live}
        showAppLink={showAppLinks}
      />
      <SubjectsCovered exam={exam} />
      {/* Keyed by Exam, so a chosen format or card doesn't carry over to another Exam's page. */}
      <ExamProducts
        key={`products-${exam.code}`}
        examCode={exam.code}
        items={[...live, ...comingSoon].map((product) => ({
          id: product.id,
          format: product.format,
          live: product.state === "live",
          card: (
            <ProductCard
              product={product}
              memberAppLive={settings.memberAppLive}
              highlight={
                product.id === numberOneId ? examPageCopy.products.topSeller(exam.code) : undefined
              }
              className="w-full"
            />
          ),
        }))}
      />
      <CompareTable products={live} memberAppLive={settings.memberAppLive} />
      <TryACard
        key={`cards-${exam.code}`}
        examCode={exam.code}
        cards={sampleCards[exam.code] ?? []}
        printedSetSlug={topSeller?.slug ?? null}
        showAppPlans={showAppLinks}
      />
      {offers.map(({ promo, product, price, saving }) => (
        <ExamPromoBanner
          key={promo.productSlug}
          promo={promo}
          productSlug={product.slug}
          price={price}
          saving={saving}
        />
      ))}
      <ExamReviews examCode={exam.code} reviews={reviews} />
      <StoreBand examCode={exam.code} shopLinks={settings.shopLinks} />
      <JsonLd data={breadcrumbJsonLd(breadcrumb, config.site.url)} />
    </>
  );
}
