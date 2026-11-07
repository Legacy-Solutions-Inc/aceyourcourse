import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { LegalBody } from "@/components/website/legal/legal-body";
import { LegalHeader } from "@/components/website/legal/legal-header";
import { LegalSwitcher } from "@/components/website/legal/legal-switcher";
import { config } from "@/config";
import { legalDocuments } from "@/content/legal/documents";
import { paths } from "@/paths";
import { getWebsiteSettings } from "@/services/catalogue";

interface LegalPageProps {
  params: Promise<{ doc: string }>;
}

// One settings read per request, shared by generateMetadata and the page. Null
// unless `doc` is exactly a document's kind, so /legal/PRIVACY and
// /legal/cookies are 404s.
const findDocuments = cache(async (doc: string) => {
  const { contactEmail } = await getWebsiteSettings();
  const documents = legalDocuments(contactEmail);
  const current = documents.find((document) => document.kind === doc);
  return current ? { current, documents, contactEmail } : null;
});

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const found = await findDocuments((await params).doc);
  // The page itself calls notFound(), so the 404 renders inside the Website
  // shell. (Calling it here would render the root 404 instead.)
  if (!found) return {};
  const { kind, title, description } = found.current;
  const url = paths.legal[kind];
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

export default async function LegalPage({ params }: LegalPageProps) {
  const found = await findDocuments((await params).doc);
  if (!found) notFound();
  const { current, documents, contactEmail } = found;

  return (
    <>
      <LegalHeader
        document={current}
        switcher={<LegalSwitcher current={current.kind} documents={documents} />}
      />
      <LegalBody document={current} contactEmail={contactEmail} />
    </>
  );
}
