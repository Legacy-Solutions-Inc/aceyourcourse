import type { Metadata } from "next";

import { CoverageTable } from "@/components/website/faq/coverage-table";
import { FaqExplorer } from "@/components/website/faq/faq-explorer";
import { StillHaveAQuestion } from "@/components/website/faq/still-have-a-question";
import { JsonLd } from "@/components/website/json-ld";
import { config } from "@/config";
import { faqPageCopy } from "@/content/faq-page";
import { faqPageJsonLd } from "@/lib/faq/faq-json-ld";
import { paths } from "@/paths";
import { getWebsiteSettings, listExams, listFaqs } from "@/services/catalogue";

const copy = faqPageCopy;

export async function generateMetadata(): Promise<Metadata> {
  const title = copy.metaTitle;
  const description = copy.metaDescription;
  const shareTitle = `${title} · ${config.site.name}`;
  // Setting openGraph here replaces the root's, so the share image is repeated.
  const images = [{ url: paths.shareImage, alt: config.site.name }];
  return {
    title,
    description,
    alternates: { canonical: paths.faq },
    openGraph: {
      type: "website",
      siteName: config.site.name,
      locale: "en_PH",
      title: shareTitle,
      description,
      url: paths.faq,
      images,
    },
    twitter: { card: "summary_large_image", title: shareTitle, description, images },
  };
}

export default async function FaqPage() {
  const [groups, exams, settings] = await Promise.all([
    listFaqs(),
    listExams(),
    getWebsiteSettings(),
  ]);
  const count = groups.reduce((total, group) => total + group.items.length, 0);
  const shopeeShop = settings.shopLinks.shopee;
  const email = settings.contactEmail;
  // Only the FAQs on the page: the seam has already left out the hidden ones.
  const jsonLd = faqPageJsonLd(groups);

  return (
    <>
      <FaqExplorer
        groups={groups}
        hero={
          <>
            <p className="flex items-center gap-2.5 self-start rounded-full border-[1.5px] border-ayc-cream/50 px-3 py-2.25 font-mono text-xs leading-none font-bold tracking-[0.08em] uppercase">
              <span aria-hidden="true" className="size-2 rounded-full bg-ayc-orange" />
              FAQ · {count} answers
            </p>
            <h1 className="max-w-[13ch] text-[clamp(46px,6.8vw,96px)] leading-[0.94] font-extrabold tracking-[-0.045em] text-balance">
              {copy.headingLead} <span className="text-ayc-orange">{copy.headingHighlight}</span>
            </h1>
            <p className="max-w-[32em] text-[clamp(17px,1.5vw,20px)] leading-normal text-ayc-on-navy-soft">
              {copy.intro}{" "}
              <a
                href={`mailto:${email}`}
                className="font-bold text-ayc-orange hover:text-ayc-orange focus-visible:outline-ayc-cream"
              >
                {email}
              </a>
              .
            </p>
          </>
        }
        coverageTable={<CoverageTable exams={exams} />}
        shopeeShop={shopeeShop}
        contactEmail={email}
        memberAppLive={settings.memberAppLive}
      />
      <StillHaveAQuestion contactEmail={email} shopeeShop={shopeeShop} />
      {jsonLd ? <JsonLd data={jsonLd} /> : null}
    </>
  );
}
