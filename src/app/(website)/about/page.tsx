import type { Metadata } from "next";

import { AboutCta } from "@/components/website/about/about-cta";
import { AboutHero } from "@/components/website/about/about-hero";
import { IloiloRoots } from "@/components/website/about/iloilo-roots";
import { MissionTabs } from "@/components/website/about/mission-tabs";
import { OurStory } from "@/components/website/about/our-story";
import { config } from "@/config";
import { aboutCopy } from "@/content/about";
import { aboutStats } from "@/lib/catalogue/about-stats";
import { paths } from "@/paths";
import { getWebsiteSettings, listExams, listProducts } from "@/services/catalogue";

const copy = aboutCopy;

export async function generateMetadata(): Promise<Metadata> {
  const title = copy.metaTitle;
  const description = copy.metaDescription;
  const shareTitle = `${title} · ${config.site.name}`;
  // Setting openGraph here replaces the root's, so the share image is repeated.
  const images = [{ url: paths.shareImage, alt: config.site.name }];
  return {
    title,
    description,
    alternates: { canonical: paths.about },
    openGraph: {
      type: "website",
      siteName: config.site.name,
      locale: "en_PH",
      title: shareTitle,
      description,
      url: paths.about,
      images,
    },
    twitter: { card: "summary_large_image", title: shareTitle, description, images },
  };
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
