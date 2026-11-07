import { manilaDate } from "@/lib/manila-time";
import { websiteSettingsUpdateSchema, type WebsiteSettingsUpdate } from "@/services/admin.schema";
import type {
  AdminResult,
  AdminWebsiteSettings,
  EditableWebsiteSettings,
  RecordStamp,
  StaffActor,
} from "@/services/admin.types";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import { CATALOGUE_TAGS } from "@/services/catalogue.tags";
import { getSampleStore, stampOf } from "@/services/mock/sample-store";

import { writeCatalogue } from "./write";

// The sample arm of the Admin seam's Settings area: the Website's contact
// email, shop and social links, and shop-wide trust figures. They are one
// record, with one stamp, however many of its parts a save changes.

const RECORD = "settings";

function editable({ settings }: CatalogueSeed): EditableWebsiteSettings {
  const { contactEmail, shopLinks, socialLinks, shopStats } = settings;
  return structuredClone({ contactEmail, shopLinks, socialLinks, shopStats });
}

const view = (catalogue: CatalogueSeed, stamp: RecordStamp): AdminWebsiteSettings => ({
  values: editable(catalogue),
  stamp,
});

export async function getSettingsForAdmin(): Promise<AdminWebsiteSettings> {
  const store = getSampleStore();
  return view(store.catalogue, stampOf(store, RECORD));
}

export async function updateWebsiteSettings(
  actor: StaffActor,
  input: WebsiteSettingsUpdate,
  expected?: { savedAt: string },
): Promise<AdminResult<AdminWebsiteSettings>> {
  return writeCatalogue(actor, input, expected, {
    role: "owner",
    forbidden: "ONLY AN OWNER CAN CHANGE SETTINGS",
    schema: websiteSettingsUpdateSchema,
    record: RECORD,
    activity: { entity: "settings", entityId: "website", action: "update" },
    snapshot: editable,
    apply: ({ settings }, update, now) => {
      if (update.contactEmail !== undefined) settings.contactEmail = update.contactEmail;
      if (update.shopLinks) settings.shopLinks = update.shopLinks;
      if (update.socialLinks) settings.socialLinks = update.socialLinks;
      // Saving the trust figures dates them: they were copied from Shopee today.
      if (update.shopStats) settings.shopStats = { ...update.shopStats, asOf: manilaDate(now) };
    },
    result: view,
    tags: [CATALOGUE_TAGS.settings],
  });
}
