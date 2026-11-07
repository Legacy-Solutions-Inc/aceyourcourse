import type { AboutSectionForm } from "@/services/admin.schema";
import type { AboutContent, AboutPhotoSaved, AboutSectionKey } from "@/services/catalogue.types";

// About's editors' form values (ticket 21; Pages & promo → Site pages →
// ABOUT), each section from what's saved. Text is held as typed, "" for a
// field left blank, which shows today's text. The paragraphs and spec chips
// are fixed inputs, 3 and 5 of them, the empty ones "". A photo is "" for
// today's, or its src, with its alt text.

const PARAGRAPHS = 3;
const SPECS = 5;

const text = (saved: string | null) => saved ?? "";
const slots = (saved: readonly string[] | null, count: number) =>
  Array.from({ length: count }, (_, index) => saved?.[index] ?? "");
const photo = (saved: AboutPhotoSaved | null) => ({ src: saved?.src ?? "", alt: saved?.alt ?? "" });

/** Pure: one About section's editor values, from what's saved. */
export function aboutSectionFormValues<Section extends AboutSectionKey>(
  about: AboutContent,
  section: Section,
): Extract<AboutSectionForm, { section: Section }>;
export function aboutSectionFormValues(
  about: AboutContent,
  section: AboutSectionKey,
): AboutSectionForm {
  switch (section) {
    case "header":
      return { section, intro: text(about.header.intro), teamPhoto: photo(about.header.teamPhoto) };
    case "story": {
      const { story } = about;
      return {
        section,
        heading: text(story.heading),
        paragraphs: slots(story.paragraphs, PARAGRAPHS),
        beforeTitle: text(story.beforeTitle),
        beforeBody: text(story.beforeBody),
        afterTitle: text(story.afterTitle),
        afterSpecs: slots(story.afterSpecs, SPECS),
        photos: story.photos.map(photo),
      };
    }
    case "growth": {
      const { growth } = about;
      return {
        section,
        firstTitle: text(growth.firstTitle),
        nowLead: text(growth.nowLead),
        todayBody: text(growth.todayBody),
        beginning: text(growth.beginning),
      };
    }
    case "mission":
      return {
        section,
        heading: text(about.mission.heading),
        intro: text(about.mission.intro),
        tabs: about.mission.tabs.map((tab) => ({ title: text(tab.title), body: text(tab.body) })),
      };
    case "roots":
      return {
        section,
        heading: text(about.roots.heading),
        body: text(about.roots.body),
        recipient: text(about.roots.recipient),
      };
    case "closing":
      return { section, heading: text(about.closing.heading) };
  }
}
