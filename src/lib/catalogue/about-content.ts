import {
  type AboutPhoto,
  aboutCopy,
  type MissionTab,
  missionTabs,
  storyPhotos,
  teamPhoto,
} from "@/content/about";
import type { AboutContent, AboutPhotoSaved, AboutSectionKey } from "@/services/catalogue.types";

// ─────────────────────────────────────────────────────────────────────────────
// About's text and photos (ticket 21; spec, Phase 2 → Site pages). Today's
// text in src/content/about.ts stays the default: what Staff saved shows over
// it field by field, and a field never saved (null) shows today's. So a page
// with nothing saved is today's, and the hosted database needs no data. Each
// field's limit is worked out here from today's text. About's shape is fixed:
// four mission tabs, three timeline items, three story photos.
// ─────────────────────────────────────────────────────────────────────────────

/** About's sections, in page order, as the Admin lists them. */
export const ABOUT_SECTIONS = [
  "header",
  "story",
  "growth",
  "mission",
  "roots",
  "closing",
] as const satisfies readonly AboutSectionKey[];

/** Pure: whether a value names one of About's sections. */
export const isAboutSection = (value: unknown): value is AboutSectionKey =>
  ABOUT_SECTIONS.some((section) => section === value);

/** About's four photos, as the upload seam files them: site-pages/about/{slot}-{uuid}.{ext}. */
export const ABOUT_PHOTO_SLOTS = ["team", "story-1", "story-2", "story-3"] as const;

export type AboutPhotoSlot = (typeof ABOUT_PHOTO_SLOTS)[number];

/** About as the Website shows it: every field's text, and every photo. */
export interface AboutCopy {
  header: { intro: string; teamPhoto: AboutPhoto };
  story: {
    heading: string;
    paragraphs: string[];
    beforeTitle: string;
    beforeBody: string;
    afterTitle: string;
    afterSpecs: string[];
    photos: AboutPhoto[];
  };
  growth: { firstTitle: string; nowLead: string; todayBody: string; beginning: string };
  mission: { heading: string; intro: string; tabs: MissionTab[] };
  roots: { heading: string; body: string; recipient: string };
  closing: { heading: string };
}

const { hero, story, mission, roots, cta } = aboutCopy;

/** Today's About, from src/content/about.ts: what every blank field shows. */
export const ABOUT_DEFAULTS: AboutCopy = {
  header: { intro: hero.intro, teamPhoto },
  story: {
    heading: story.heading,
    paragraphs: story.paragraphs,
    beforeTitle: story.before.title,
    beforeBody: story.before.body,
    afterTitle: story.after.title,
    afterSpecs: story.after.specs,
    photos: [...storyPhotos],
  },
  growth: {
    firstTitle: story.first.title,
    nowLead: story.now.lead,
    todayBody: story.today.body,
    beginning: story.beginning,
  },
  mission: { heading: mission.heading, intro: mission.intro, tabs: [...missionTabs] },
  roots: { heading: roots.heading, body: roots.body, recipient: roots.label.recipient },
  closing: { heading: cta.heading },
};

/** Pure: About with nothing saved: every field null, so every field shows today's. */
export function emptyAbout(): AboutContent {
  return {
    header: { intro: null, teamPhoto: null },
    story: {
      heading: null,
      paragraphs: null,
      beforeTitle: null,
      beforeBody: null,
      afterTitle: null,
      afterSpecs: null,
      photos: [null, null, null],
    },
    growth: { firstTitle: null, nowLead: null, todayBody: null, beginning: null },
    mission: {
      heading: null,
      intro: null,
      tabs: [
        { title: null, body: null },
        { title: null, body: null },
        { title: null, body: null },
        { title: null, body: null },
      ],
    },
    roots: { heading: null, body: null, recipient: null },
    closing: { heading: null },
  };
}

const photoOr = (photo: AboutPhotoSaved | null, today: AboutPhoto): AboutPhoto =>
  photo ? { src: photo.src, alt: photo.alt } : today;

/** Pure: About as the Website shows it: each saved field, or today's text where there's none. */
export function resolveAbout(saved: AboutContent | null): AboutCopy {
  const d = ABOUT_DEFAULTS;
  if (!saved) return structuredClone(d);
  return {
    header: {
      intro: saved.header.intro ?? d.header.intro,
      teamPhoto: photoOr(saved.header.teamPhoto, d.header.teamPhoto),
    },
    story: {
      heading: saved.story.heading ?? d.story.heading,
      paragraphs: [...(saved.story.paragraphs ?? d.story.paragraphs)],
      beforeTitle: saved.story.beforeTitle ?? d.story.beforeTitle,
      beforeBody: saved.story.beforeBody ?? d.story.beforeBody,
      afterTitle: saved.story.afterTitle ?? d.story.afterTitle,
      afterSpecs: [...(saved.story.afterSpecs ?? d.story.afterSpecs)],
      photos: d.story.photos.map((today, index) =>
        photoOr(saved.story.photos[index] ?? null, today),
      ),
    },
    growth: {
      firstTitle: saved.growth.firstTitle ?? d.growth.firstTitle,
      nowLead: saved.growth.nowLead ?? d.growth.nowLead,
      todayBody: saved.growth.todayBody ?? d.growth.todayBody,
      beginning: saved.growth.beginning ?? d.growth.beginning,
    },
    mission: {
      heading: saved.mission.heading ?? d.mission.heading,
      intro: saved.mission.intro ?? d.mission.intro,
      tabs: d.mission.tabs.map((today, index) => ({
        title: saved.mission.tabs[index]?.title ?? today.title,
        body: saved.mission.tabs[index]?.body ?? today.body,
      })),
    },
    roots: {
      heading: saved.roots.heading ?? d.roots.heading,
      body: saved.roots.body ?? d.roots.body,
      recipient: saved.roots.recipient ?? d.roots.recipient,
    },
    closing: { heading: saved.closing.heading ?? d.closing.heading },
  };
}

// ── Limits ──────────────────────────────────────────────────────────────────

/** Pure: a field's limit: about 1.5× today's text, rounded up to the next multiple of 10. */
export const aboutLimit = (today: string) => Math.ceil((today.length * 1.5) / 10) * 10;

/** A spec chip's limit. */
export const ABOUT_SPEC_MAX = 20;

/** A replaced photo's alt text limit. */
export const ABOUT_ALT_MAX = 150;

const d = ABOUT_DEFAULTS;

/** Each field's limit, from today's text. The three paragraphs share the longest's. */
export const ABOUT_LIMITS = {
  header: { intro: aboutLimit(d.header.intro) },
  story: {
    heading: aboutLimit(d.story.heading),
    paragraph: Math.max(...d.story.paragraphs.map(aboutLimit)),
    beforeTitle: aboutLimit(d.story.beforeTitle),
    beforeBody: aboutLimit(d.story.beforeBody),
    afterTitle: aboutLimit(d.story.afterTitle),
  },
  growth: {
    firstTitle: aboutLimit(d.growth.firstTitle),
    nowLead: aboutLimit(d.growth.nowLead),
    todayBody: aboutLimit(d.growth.todayBody),
    beginning: aboutLimit(d.growth.beginning),
  },
  mission: {
    heading: aboutLimit(d.mission.heading),
    intro: aboutLimit(d.mission.intro),
    tabs: d.mission.tabs.map((tab) => ({
      title: aboutLimit(tab.title),
      body: aboutLimit(tab.body),
    })),
  },
  roots: {
    heading: aboutLimit(d.roots.heading),
    body: aboutLimit(d.roots.body),
    recipient: aboutLimit(d.roots.recipient),
  },
  closing: { heading: aboutLimit(d.closing.heading) },
};

/** Pure: every text field with today's length and its limit, for the report and the tests. */
export function aboutLimitRows(): { field: string; length: number; limit: number }[] {
  const row = (field: string, today: string, limit: number) => ({
    field,
    length: today.length,
    limit,
  });
  const L = ABOUT_LIMITS;
  return [
    row("header.intro", d.header.intro, L.header.intro),
    row("story.heading", d.story.heading, L.story.heading),
    ...d.story.paragraphs.map((text, index) =>
      row(`story.paragraphs.${index}`, text, L.story.paragraph),
    ),
    row("story.beforeTitle", d.story.beforeTitle, L.story.beforeTitle),
    row("story.beforeBody", d.story.beforeBody, L.story.beforeBody),
    row("story.afterTitle", d.story.afterTitle, L.story.afterTitle),
    row("growth.firstTitle", d.growth.firstTitle, L.growth.firstTitle),
    row("growth.nowLead", d.growth.nowLead, L.growth.nowLead),
    row("growth.todayBody", d.growth.todayBody, L.growth.todayBody),
    row("growth.beginning", d.growth.beginning, L.growth.beginning),
    row("mission.heading", d.mission.heading, L.mission.heading),
    row("mission.intro", d.mission.intro, L.mission.intro),
    ...d.mission.tabs.flatMap((tab, index) => [
      row(`mission.tabs.${index}.title`, tab.title, L.mission.tabs[index]?.title ?? 0),
      row(`mission.tabs.${index}.body`, tab.body, L.mission.tabs[index]?.body ?? 0),
    ]),
    row("roots.heading", d.roots.heading, L.roots.heading),
    row("roots.body", d.roots.body, L.roots.body),
    row("roots.recipient", d.roots.recipient, L.roots.recipient),
    row("closing.heading", d.closing.heading, L.closing.heading),
  ];
}
