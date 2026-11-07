import { describe, expect, it } from "vitest";

import { aboutCopy, missionTabs, storyPhotos, teamPhoto } from "@/content/about";
import type { AboutContent } from "@/services/catalogue.types";

import {
  ABOUT_ALT_MAX,
  ABOUT_DEFAULTS,
  ABOUT_LIMITS,
  ABOUT_SPEC_MAX,
  aboutLimit,
  aboutLimitRows,
  emptyAbout,
  resolveAbout,
} from "./about-content";

// About's text and photos (ticket 21; spec, Phase 2 → Site pages): what
// Staff saved, field by field, over today's text in src/content/about.ts.
// A blank field shows today's text, so a page with nothing saved is today's.

const saved = (edit: (about: AboutContent) => void): AboutContent => {
  const about = emptyAbout();
  edit(about);
  return about;
};

const PHOTO = { src: "/api/dev/uploads/1", alt: "The team at the Iloilo warehouse" };

describe("ABOUT_DEFAULTS", () => {
  it("is today's text and photos, from src/content/about.ts", () => {
    expect(ABOUT_DEFAULTS).toEqual({
      header: { intro: aboutCopy.hero.intro, teamPhoto },
      story: {
        heading: aboutCopy.story.heading,
        paragraphs: aboutCopy.story.paragraphs,
        beforeTitle: aboutCopy.story.before.title,
        beforeBody: aboutCopy.story.before.body,
        afterTitle: aboutCopy.story.after.title,
        afterSpecs: aboutCopy.story.after.specs,
        photos: storyPhotos,
      },
      growth: {
        firstTitle: "Civil Engineering flash cards",
        nowLead: "Then came updated editions and reviewers for more courses.",
        todayBody: aboutCopy.story.today.body,
        beginning: "And this is only the beginning.",
      },
      mission: {
        heading: "The mission",
        intro: aboutCopy.mission.intro,
        tabs: missionTabs,
      },
      roots: {
        heading: aboutCopy.roots.heading,
        body: aboutCopy.roots.body,
        recipient: "Future RCE, RME, REE, RMT, CPA",
      },
      closing: { heading: "Your turn. Find the reviewer for your board." },
    });
  });
});

describe("resolveAbout", () => {
  it("is today's About with nothing saved, or an empty record", () => {
    expect(resolveAbout(null)).toEqual(ABOUT_DEFAULTS);
    expect(resolveAbout(emptyAbout())).toEqual(ABOUT_DEFAULTS);
  });

  it("shows a saved field, and today's text for every other", () => {
    const about = resolveAbout(
      saved((a) => {
        a.story.heading = "We passed the boards. Then we built the reviewers.";
      }),
    );
    expect(about.story.heading).toBe("We passed the boards. Then we built the reviewers.");
    expect({ ...about, story: { ...about.story, heading: ABOUT_DEFAULTS.story.heading } }).toEqual(
      ABOUT_DEFAULTS,
    );
  });

  it("shows each section's saved fields", () => {
    const about = resolveAbout(
      saved((a) => {
        a.header.intro = "Intro";
        a.growth = { firstTitle: "First", nowLead: "Now.", todayBody: "Today", beginning: "End" };
        a.roots = { heading: "Roots", body: "Body", recipient: "Future CPAs" };
        a.closing.heading = "Your turn.";
      }),
    );
    expect(about.header.intro).toBe("Intro");
    expect(about.growth).toEqual({
      firstTitle: "First",
      nowLead: "Now.",
      todayBody: "Today",
      beginning: "End",
    });
    expect(about.roots).toEqual({ heading: "Roots", body: "Body", recipient: "Future CPAs" });
    expect(about.closing.heading).toBe("Your turn.");
  });

  it("shows a saved paragraph or chip list whole, in place of today's", () => {
    const about = resolveAbout(
      saved((a) => {
        a.story.paragraphs = ["One paragraph."];
        a.story.afterSpecs = ["A6", "Spiral", "Waterproof"];
      }),
    );
    expect(about.story.paragraphs).toEqual(["One paragraph."]);
    expect(about.story.afterSpecs).toEqual(["A6", "Spiral", "Waterproof"]);
  });

  it("changes only the mission tab saved, field by field", () => {
    const about = resolveAbout(
      saved((a) => {
        a.mission.tabs[1] = { title: "Always current", body: null };
      }),
    );
    expect(about.mission.tabs).toEqual([
      missionTabs[0],
      { title: "Always current", body: missionTabs[1]?.body },
      missionTabs[2],
      missionTabs[3],
    ]);
  });

  it("shows a replaced photo with its alt text, and today's photo in every other slot", () => {
    const about = resolveAbout(
      saved((a) => {
        a.story.photos[1] = PHOTO;
      }),
    );
    expect(about.story.photos).toEqual([storyPhotos[0], PHOTO, storyPhotos[2]]);
    expect(about.header.teamPhoto).toEqual(teamPhoto);
    expect(resolveAbout(saved((a) => (a.header.teamPhoto = PHOTO))).header.teamPhoto).toEqual(
      PHOTO,
    );
  });

  it("keeps markup as plain text: it's never parsed", () => {
    const markup = "<b>hi</b><script>alert(1)</script>";
    expect(resolveAbout(saved((a) => (a.roots.heading = markup))).roots.heading).toBe(markup);
  });
});

describe("the limits", () => {
  it("is about 1.5× the text, rounded up to the next 10", () => {
    expect(aboutLimit("x".repeat(10))).toBe(20);
    expect(aboutLimit("x".repeat(20))).toBe(30);
    expect(aboutLimit("x".repeat(47))).toBe(80);
    expect(aboutLimit("x".repeat(60))).toBe(90);
  });

  it("works each one out from today's text", () => {
    expect(ABOUT_LIMITS.story.heading).toBe(aboutLimit(aboutCopy.story.heading));
    expect(ABOUT_LIMITS.mission.tabs[2]?.body).toBe(aboutLimit(missionTabs[2]?.body ?? ""));
    expect(ABOUT_LIMITS.closing.heading).toBe(aboutLimit(aboutCopy.cta.heading));
    // Paragraph 3 has no text today: every paragraph shares the longest's limit.
    expect(ABOUT_LIMITS.story.paragraph).toBe(
      Math.max(...aboutCopy.story.paragraphs.map(aboutLimit)),
    );
    expect(ABOUT_SPEC_MAX).toBe(20);
    expect(ABOUT_ALT_MAX).toBe(150);
  });

  it("fits every field's text today within its own limit", () => {
    const rows = aboutLimitRows();
    expect(rows.length).toBeGreaterThanOrEqual(20);
    for (const row of rows) {
      expect(row.length, row.field).toBeLessThanOrEqual(row.limit);
      // The paragraphs share the longest one's limit.
      if (!row.field.startsWith("story.paragraphs.")) {
        expect(row.limit, row.field).toBe(aboutLimit("x".repeat(row.length)));
      }
    }
    for (const spec of aboutCopy.story.after.specs) {
      expect(spec.length, spec).toBeLessThanOrEqual(ABOUT_SPEC_MAX);
    }
    for (const photo of [teamPhoto, ...storyPhotos]) {
      expect(photo.alt.length, photo.src).toBeLessThanOrEqual(ABOUT_ALT_MAX);
    }
  });
});
