"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAdminForm } from "@/components/admin/use-admin-form";
import type { AdminAction } from "@/lib/admin/action";
import { seoFormValues } from "@/lib/admin/exam-page-form";
import { photoUploadBlocker } from "@/lib/admin/photo-rules";
import type { AdminSitePage } from "@/services/admin.types";
import type { SitePageKey } from "@/services/catalogue.types";
import type { UploadTicket } from "@/services/uploads.types";

import { INVALID } from "./exam-page-editors";
import { SeoFields } from "./exam-seo-editor";

// A Site page's SEARCH & AI VISIBILITY (ticket 20; spec, Phase 2 → Site
// pages): the Exam page's editor, unchanged, over the Site page's record.
// Blank fields use the page's text in code, which the server passes in as
// the placeholders, since it lives with the Website's pages.

/**
 * What the Website sets up by itself on a Site page: the Exam page's list,
 * less Breadcrumbs, which no Site page has.
 */
const SET_UP_AUTOMATICALLY = [
  ["Summary for AI assistants", "ON"],
  ["Sitemap", "AUTO"],
] as const;

interface SitePageSeoEditorProps {
  opened: AdminSitePage;
  /** PAGE ADDRESS, and today's title and description, for the placeholders. */
  defaults: { address: string; title: string; description: string };
  action: AdminAction<AdminSitePage>;
  createUpload: AdminAction<UploadTicket>;
}

export function SitePageSeoEditor({
  opened,
  defaults,
  action,
  createUpload,
}: SitePageSeoEditorProps) {
  const router = useRouter();
  const site: SitePageKey = opened.page.page;
  const [stamp, setStamp] = useState(opened.stamps.seo);
  const form = useAdminForm({
    action,
    initialValues: { site, ...seoFormValues(opened.page) },
    savedAt: stamp.savedAt,
    valuesFrom: (saved: AdminSitePage) => ({ site, ...seoFormValues(saved.page) }),
    onSaved: (saved) => {
      setStamp(saved.stamps.seo);
      // Columns 1 and 2 show GOOD or CHECK from what was saved.
      router.refresh();
    },
    title: `The ${site} page’s search settings`,
    invalidMessage: INVALID,
    blocker: (values) => photoUploadBlocker([values.shareImage]),
  });
  return (
    <SeoFields
      form={form}
      address={defaults.address}
      defaults={defaults}
      blankNote="Leave a field blank to use the page’s text today, shown in grey."
      setUp={SET_UP_AUTOMATICALLY}
      createUpload={createUpload}
      uploadFor={{ site }}
    />
  );
}
