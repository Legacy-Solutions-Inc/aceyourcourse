import type { Metadata } from "next";

import { AboutCta } from "@/components/website/about/about-cta";
import { AboutHero } from "@/components/website/about/about-hero";
import { IloiloRoots } from "@/components/website/about/iloilo-roots";
import { MissionTabs } from "@/components/website/about/mission-tabs";
import { OurStory } from "@/components/website/about/our-story";
import { aboutStats } from "@/lib/catalogue/about-stats";
import { sitePageMetadata } from "@/lib/catalogue/site-page-seo";
import { getWebsiteSettings, listExams, listProducts } from "@/services/catalogue";

// The title, description and share image Staff set in Pages & promo, or
// today's text (src/content) and the site's image.
export async function generateMetadata(): Promise<Metadata> {
  return sitePageMetadata("about");
}

export default async function AboutPage() {
  // listProducts() counts Live Products only; listExams() only the Exams with
  // a Product on the Website.
  const [exams, settings, { total }] = await Promise.all([
    listExams(),
    getWebsiteSettings(),
    listProducts(),
  ]);
  const { shopStats } = settings;
  const stats = aboutStats({ productTotal: total, examCount: exams.length, shopStats });

  return (
    <>
      <AboutHero stats={stats} shopFiguresAsOf={shopStats.asOf} />
      <OurStory examNames={exams.map((exam) => exam.name)} />
      <MissionTabs />
      <IloiloRoots shopLinks={settings.shopLinks} />
      <AboutCta exams={exams} />
    </>
  );
}
