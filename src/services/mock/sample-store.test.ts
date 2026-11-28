import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { currentLegalVersions } from "@/content/legal/documents";
import { consentStatus } from "@/lib/member-app/consent";
import { latestConsent } from "@/services/member.mock";

import { CATALOGUE_SEED } from "./catalogue";
import { sampleUserId } from "./members";
import { getSampleStore, resetSampleStore, withStandInStore } from "./sample-store";

// The Admin seam's database arm runs the sample arm's code over a store it
// loaded from Postgres (admin.db.ts): inside withStandInStore, every
// getSampleStore() gets that store, and the sample data is left alone.

describe("withStandInStore", () => {
  it("gives the stand-in store to every getSampleStore() inside it, across awaits", async () => {
    const sample = resetSampleStore();
    const standIn = { ...structuredClone(sample), generation: "stand-in" };

    const seen = await withStandInStore(standIn, async () => {
      const first = getSampleStore();
      await new Promise((resolve) => setTimeout(resolve, 1));
      return [first, getSampleStore()];
    });

    expect(seen).toEqual([standIn, standIn]);
    expect(seen[0]).toBe(standIn);
  });

  it("leaves the sample data alone, and gives it back outside", async () => {
    const sample = resetSampleStore();
    const standIn = structuredClone(sample);

    await withStandInStore(standIn, async () => {
      getSampleStore().staffActivity = [];
      getSampleStore().catalogue = { ...getSampleStore().catalogue, faqs: [] };
    });

    expect(getSampleStore()).toBe(sample);
    expect(sample.catalogue.faqs.length).toBeGreaterThan(0);
  });
});

// Legal v2.1 (Phase 4, ticket 13): the dev server and the e2e specs start the
// renewing tester as a Member who agreed to v2.0 the day before, so their
// next visit asks them to agree to v2.1. Unit tests start without, unless
// they ask.
describe("the sample agreements", () => {
  const BOOT = new Date("2026-11-17T03:42:00.000Z");
  const RAE = sampleUserId("renewing@example.com");

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetSampleStore();
  });

  it("start the renewing tester as a Member who agreed to v2.0 the day before", async () => {
    const store = resetSampleStore(CATALOGUE_SEED, { sampleAgreements: true });

    expect(store.members).toEqual([
      {
        userId: RAE,
        email: "renewing@example.com",
        name: "Rae Renewing",
        joinedAt: "2026-11-16T03:42:00.000Z",
      },
    ]);
    expect(await latestConsent(RAE)).toEqual({
      userId: RAE,
      termsVersion: "2.0",
      privacyVersion: "2.0",
      agreedAt: "2026-11-16T03:42:00.000Z",
    });
    expect(consentStatus(currentLegalVersions(), await latestConsent(RAE))).toBe("both-changed");
  });

  it("are left out unless asked for", () => {
    const store = resetSampleStore();
    expect(store.members).toEqual([]);
    expect(store.memberConsents).toEqual([]);
  });
});
