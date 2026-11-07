import type { AnnouncementForm, PromoBannerForm } from "@/services/admin.schema";
import type { PromoBanner, WebsiteSettings } from "@/services/catalogue.types";

// The promo editors' form values (spec, Phase 2 → Exam pages & promo), from
// the banner and the announcement as the seam gives them. Text is held as
// typed, "" for a field left blank.

/** Pure: the Home promo banner editor's values; all blank while the Website has none. */
export const promoBannerFormValues = (banner: PromoBanner | null): PromoBannerForm => ({
  text: banner?.text ?? "",
  buttonLabel: banner?.buttonLabel ?? "",
  href: banner?.href ?? "",
  startDate: banner?.startDate ?? "",
  endDate: banner?.endDate ?? "",
});

/** Pure: the announcement bar editor's values, its messages in the bar's order. */
export const announcementFormValues = ({
  messages,
}: WebsiteSettings["announcement"]): AnnouncementForm => ({
  messages: messages.map(({ text, href, requiresMemberApp }) => ({
    text,
    href,
    requiresMemberApp,
  })),
});

/** A new message's values: blank, shown whether or not the Member App is live. */
export const newAnnouncementMessage = (): AnnouncementForm["messages"][number] => ({
  text: "",
  href: "",
  requiresMemberApp: false,
});
