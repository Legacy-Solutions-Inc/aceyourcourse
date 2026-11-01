"use server";

import { adminAction } from "@/lib/admin/action";
import { updateWebsiteSettings } from "@/services/admin";
import {
  contactSettingsSchema,
  linkSettingsSchema,
  trustFiguresSchema,
} from "@/services/admin.schema";

// Settings' Server Actions, one per part of the screen, all Owners-only. Each
// saves only its own part of the one settings record: its schema drops
// anything else it's sent.

/** Saves the contact email. */
export const saveContactEmail = adminAction(
  { role: "owner", schema: contactSettingsSchema },
  updateWebsiteSettings,
);

/** Saves the Marketplace shop links and the social links. */
export const saveLinks = adminAction(
  { role: "owner", schema: linkSettingsSchema },
  updateWebsiteSettings,
);

/** Saves the trust figures, dated today. */
export const saveTrustFigures = adminAction(
  { role: "owner", schema: trustFiguresSchema },
  updateWebsiteSettings,
);
