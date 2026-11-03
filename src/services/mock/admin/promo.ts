import {
  type AnnouncementForm,
  announcementFormSchema,
  type PromoBannerForm,
  promoBannerFormSchema,
  promoBannerVisibleSchema,
} from "@/services/admin.schema";
import type {
  AdminAnnouncement,
  AdminPromoBanner,
  AdminResult,
  StaffActor,
} from "@/services/admin.types";
import { memberAppLive } from "@/services/catalogue.mock";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import type { AnnouncementMessage } from "@/services/catalogue.types";
import { CATALOGUE_TAGS } from "@/services/catalogue.tags";
import { getSampleStore, stampOf } from "@/services/mock/sample-store";

import { writeCatalogue } from "./write";

// The sample arm of the Admin seam's promo area: the Home promo banner and
// the announcement bar, both in the Website's settings, editable by any Staff
// User. The banner's fields and its switch are separate records, each with
// its own stamp: the switch is a single toggle that always saves, so turning
// the banner on or off never makes its open editor conflict, and the
// editor's Save keeps the switch as it is.

const BANNER = "promo-banner";
const BANNER_SWITCH = "promo-banner:visible";
const ANNOUNCEMENT = "announcement";

const bannerOf = (catalogue: CatalogueSeed) => catalogue.settings.promoBanner;

/** The banner as its editor opens it, with its fields' stamp. */
function bannerView(catalogue: CatalogueSeed): AdminPromoBanner {
  return structuredClone({
    banner: bannerOf(catalogue),
    stamp: stampOf(getSampleStore(), BANNER),
  });
}

function announcementView(catalogue: CatalogueSeed): AdminAnnouncement {
  return structuredClone({
    announcement: catalogue.settings.announcement,
    memberAppLive: memberAppLive(),
    stamp: stampOf(getSampleStore(), ANNOUNCEMENT),
  });
}

export async function getPromoForAdmin(_actor: StaffActor): Promise<AdminPromoBanner> {
  return bannerView(getSampleStore().catalogue);
}

export async function updatePromoBanner(
  actor: StaffActor,
  input: PromoBannerForm,
  expected?: { savedAt: string },
): Promise<AdminResult<AdminPromoBanner>> {
  return writeCatalogue(actor, input, expected, {
    role: "staff",
    schema: promoBannerFormSchema,
    record: BANNER,
    activity: { entity: "promo-banner", entityId: "home", action: "update" },
    snapshot: bannerOf,
    apply: ({ settings }, fields) => {
      // A banner the Website didn't have yet starts turned off.
      settings.promoBanner = { visible: settings.promoBanner?.visible ?? false, ...fields };
    },
    result: bannerView,
    tags: [CATALOGUE_TAGS.settings],
  });
}

export async function setPromoBannerVisible(
  actor: StaffActor,
  visible: boolean,
): Promise<AdminResult<AdminPromoBanner>> {
  // A single toggle always saves: there's no form to go stale.
  return writeCatalogue(actor, { visible }, undefined, {
    role: "staff",
    schema: promoBannerVisibleSchema,
    record: BANNER_SWITCH,
    check: (catalogue) =>
      bannerOf(catalogue)
        ? null
        : { kind: "invalid", fieldErrors: {}, formError: "SAVE THE BANNER FIRST" },
    activity: {
      entity: "promo-banner",
      entityId: "home",
      action: visible ? "turn-on" : "turn-off",
    },
    snapshot: bannerOf,
    apply: ({ settings }, toggle) => {
      if (settings.promoBanner) settings.promoBanner.visible = toggle.visible;
    },
    result: bannerView,
    tags: [CATALOGUE_TAGS.settings],
  });
}

export async function getAnnouncementForAdmin(_actor: StaffActor): Promise<AdminAnnouncement> {
  return announcementView(getSampleStore().catalogue);
}

/** Pure: whether two lists of messages say the same, in the same order. */
const sameMessages = (a: AnnouncementMessage[], b: AnnouncementMessage[]) =>
  a.length === b.length &&
  a.every(
    (message, index) =>
      message.text === b[index]?.text &&
      message.href === b[index]?.href &&
      message.requiresMemberApp === b[index]?.requiresMemberApp,
  );

export async function updateAnnouncement(
  actor: StaffActor,
  input: AnnouncementForm,
  expected?: { savedAt: string },
): Promise<AdminResult<AdminAnnouncement>> {
  return writeCatalogue(actor, input, expected, {
    role: "staff",
    schema: announcementFormSchema,
    record: ANNOUNCEMENT,
    activity: { entity: "announcement", entityId: "website", action: "update" },
    snapshot: (catalogue) => catalogue.settings.announcement,
    apply: ({ settings }, { messages }, now) => {
      // A new id shows the bar again to Visitors who dismissed it, so it
      // changes only when the messages do.
      const id = sameMessages(settings.announcement.messages, messages)
        ? settings.announcement.id
        : `ann-${now.toISOString()}`;
      settings.announcement = { id, messages };
    },
    result: announcementView,
    tags: [CATALOGUE_TAGS.settings],
  });
}
