import type { Metadata } from "next";

import { AboutCta } from "@/components/website/about/about-cta";
import { AboutHero } from "@/components/website/about/about-hero";
import { IloiloRoots } from "@/components/website/about/iloilo-roots";
import { MissionTabs } from "@/components/website/about/mission-tabs";
import { OurStory } from "@/components/website/about/our-story";
import { type AboutCopy, resolveAbout } from "@/lib/catalogue/about-content";
import { aboutStats } from "@/lib/catalogue/about-stats";
import { sitePageMetadata } from "@/lib/catalogue/site-page-seo";
import { getSitePage, getWebsiteSettings, listExams, listProducts } from "@/services/catalogue";

// The title, description and share image Staff set in Pages & promo, or
// today's text (src/content) and the site's image.
export async function generateMetadata(): Promise<Metadata> {
  return sitePageMetadata("about");
}

/**
 * About's text and photos as Staff saved them in Pages & promo (ticket 21),
 * over today's text field by field; today's About when they can't be read, so
 * the page never breaks on them.
 */
async function readAbout(): Promise<AboutCopy> {
  try {
    return resolveAbout((await getSitePage("about")).about);
  } catch (error) {
    console.error("Couldn't read About's saved text and photos; showing today's:", error);
    return resolveAbout(null);
  }
}

export default async function AboutPage() {
  // listProducts() counts Live Products only; listExams() only the Exams with
  // a Product on the Website.
  const [exams, settings, { total }, about] = await Promise.all([
    listExams(),
    getWebsiteSettings(),
    listProducts(),
    readAbout(),
  ]);
  const { shopStats } = settings;
  const stats = aboutStats({ productTotal: total, examCount: exams.length, shopStats });

  return (
    <>
      <AboutHero copy={about.header} stats={stats} shopFiguresAsOf={shopStats.asOf} />
      <OurStory
        story={about.story}
        growth={about.growth}
        examNames={exams.map((exam) => exam.name)}
      />
      <MissionTabs copy={about.mission} />
      <IloiloRoots copy={about.roots} shopLinks={settings.shopLinks} />
      <AboutCta heading={about.closing.heading} exams={exams} />
    </>
  );
}
