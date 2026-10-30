import type { Metadata } from "next";

import { Authenticity } from "@/components/website/home/authenticity";
import { BestSellers } from "@/components/website/home/best-sellers";
import { FindYourExam } from "@/components/website/home/find-your-exam";
import { Formats } from "@/components/website/home/formats";
import { FourSteps } from "@/components/website/home/four-steps";
import { Hero } from "@/components/website/home/hero";
import { HomeReviews } from "@/components/website/home/home-reviews";
import { HomeStoreBand } from "@/components/website/home/home-store-band";
import { HomeTicker } from "@/components/website/home/home-ticker";
import { PromoStrip } from "@/components/website/home/promo-strip";
import { VideoSection } from "@/components/website/home/video-section";
import { config } from "@/config";
import { homeCopy, tryCards } from "@/content/home";
import { paths } from "@/paths";
import {
  getWebsiteSettings,
  listBestSellers,
  listExams,
  listHomeReviews,
  listProducts,
} from "@/services/catalogue";

/** The mockup's Best sellers row shows the top 6 (L341). */
const BEST_SELLER_COUNT = 6;

export async function generateMetadata(): Promise<Metadata> {
  const title = homeCopy.metaTitle;
  const description = homeCopy.metaDescription;
  const shareTitle = `${title} · ${config.site.name}`;
  // Setting openGraph here replaces the root's, so the share image is repeated.
  const images = [{ url: paths.shareImage, alt: config.site.name }];
  return {
    title,
    description,
    alternates: { canonical: paths.home },
    openGraph: {
      type: "website",
      siteName: config.site.name,
      locale: "en_PH",
      title: shareTitle,
      description,
      url: paths.home,
      images,
    },
    twitter: { card: "summary_large_image", title: shareTitle, description, images },
  };
}

// Home (docs/mockup/website/Home_v2.dc.html items 1–9), under the promo strip
// while a sale is on. Coming Soon Products never appear here.
export default async function HomePage() {
  // Read once per request, so the promo strip turns on and off by itself.
  const now = new Date();
  const [exams, settings, { items: live }, bestSellers, homeReviews] = await Promise.all([
    listExams(),
    getWebsiteSettings(),
    listProducts(),
    listBestSellers(BEST_SELLER_COUNT),
    listHomeReviews(),
  ]);

  // Like Find your exam, the ticker names only Exams with Live Products.
  const liveExamCodes = exams
    .map((exam) => exam.code)
    .filter((code) => live.some((product) => product.examCode === code));

  return (
    <>
      <PromoStrip banner={settings.promoBanner} now={now} memberAppLive={settings.memberAppLive} />
      <Hero
        shopStats={settings.shopStats}
        cards={tryCards}
        memberAppLive={settings.memberAppLive}
      />
      <HomeTicker shopStats={settings.shopStats} examCodes={liveExamCodes} />
      <FourSteps memberAppLive={settings.memberAppLive} />
      <FindYourExam exams={exams} products={live} memberAppLive={settings.memberAppLive} />
      <BestSellers products={bestSellers} />
      <Formats products={live} exams={exams} memberAppLive={settings.memberAppLive} />
      <VideoSection />
      <HomeReviews
        reviews={homeReviews}
        shopStats={settings.shopStats}
        shopeeShopLink={settings.shopLinks.shopee}
      />
      <Authenticity />
      <HomeStoreBand shopLinks={settings.shopLinks} memberAppLive={settings.memberAppLive} />
    </>
  );
}
