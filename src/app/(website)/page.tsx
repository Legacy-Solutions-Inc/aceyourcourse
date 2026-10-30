import type { Metadata } from "next";

import { BestSellers } from "@/components/website/home/best-sellers";
import { FindYourExam } from "@/components/website/home/find-your-exam";
import { FourSteps } from "@/components/website/home/four-steps";
import { Hero } from "@/components/website/home/hero";
import { HomeTicker } from "@/components/website/home/home-ticker";
import { config } from "@/config";
import { homeCopy, tryCards } from "@/content/home";
import { paths } from "@/paths";
import { getWebsiteSettings, listBestSellers, listExams, listProducts } from "@/services/catalogue";

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

// Home, down to Best sellers (docs/mockup/website/Home_v2.dc.html items 1–4).
// Ticket 06 adds the sections below: formats, the video, reviews,
// authenticity and the store band. Coming Soon Products never appear here.
export default async function HomePage() {
  const [exams, settings, { items: live }, bestSellers] = await Promise.all([
    listExams(),
    getWebsiteSettings(),
    listProducts(),
    listBestSellers(BEST_SELLER_COUNT),
  ]);

  // Like Find your exam, the ticker names only Exams with Live Products.
  const liveExamCodes = exams
    .map((exam) => exam.code)
    .filter((code) => live.some((product) => product.examCode === code));

  return (
    <>
      <Hero
        shopStats={settings.shopStats}
        cards={tryCards}
        memberAppLive={settings.memberAppLive}
      />
      <HomeTicker shopStats={settings.shopStats} examCodes={liveExamCodes} />
      <FourSteps memberAppLive={settings.memberAppLive} />
      <FindYourExam exams={exams} products={live} memberAppLive={settings.memberAppLive} />
      <BestSellers products={bestSellers} />
    </>
  );
}
