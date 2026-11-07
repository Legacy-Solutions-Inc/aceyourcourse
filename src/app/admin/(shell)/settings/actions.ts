"use server";

import { adminAction } from "@/lib/admin/action";
import {
  cancelInvite,
  changeStaffRole,
  inviteStaff,
  removeStaff,
  renewInvite,
  updateWebsiteSettings,
} from "@/services/admin";
import {
  changeStaffRoleSchema,
  contactSettingsSchema,
  inviteStaffSchema,
  linkSettingsSchema,
  staffEmailInputSchema,
  trustFiguresSchema,
} from "@/services/admin.schema";

// Settings' Server Actions, all Owners-only. The website settings are saved one
// part of the screen at a time: each part saves only its own part of the one
// settings record, and its schema drops anything else it's sent. The Admin
// accounts actions manage the staff list; the staff list's rules decide them,
// not the conflict check, so they ignore any expected stamp.

/** Saves the contact email. */
export const saveContactEmail = adminAction(
  { role: "owner", schema: contactSettingsSchema, requiresStamp: true },
  updateWebsiteSettings,
);

/** Saves the Marketplace shop links and the social links. */
export const saveLinks = adminAction(
  { role: "owner", schema: linkSettingsSchema, requiresStamp: true },
  updateWebsiteSettings,
);

/** Saves the trust figures, dated today. */
export const saveTrustFigures = adminAction(
  { role: "owner", schema: trustFiguresSchema, requiresStamp: true },
  updateWebsiteSettings,
);

/** "+ Authorise an account": invites a Google email with a Staff Role. */
export const addInvite = adminAction({ role: "owner", schema: inviteStaffSchema }, inviteStaff);

/** Renew: restarts an Invite's 7 days. */
export const renewStaffInvite = adminAction(
  { role: "owner", schema: staffEmailInputSchema },
  async (actor, { email }) => renewInvite(actor, email),
);

/** Cancel invite: deletes it. */
export const cancelStaffInvite = adminAction(
  { role: "owner", schema: staffEmailInputSchema },
  async (actor, { email }) => cancelInvite(actor, email),
);

/** Makes a Staff User an Owner or an Editor. */
export const changeStaffMemberRole = adminAction(
  { role: "owner", schema: changeStaffRoleSchema },
  changeStaffRole,
);

/** Remove: takes a Staff User off the staff list. */
export const removeStaffMember = adminAction(
  { role: "owner", schema: staffEmailInputSchema },
  async (actor, { email }) => removeStaff(actor, email),
);
