import * as mockImpl from "@/services/admin.mock";
import type { WebsiteSettingsUpdate } from "@/services/admin.schema";
import type {
  AdminResult,
  AdminWebsiteSettings,
  DeniedReason,
  DeniedSignIn,
  SignInIdentity,
  SignInResolution,
  StaffActor,
} from "@/services/admin.types";

// ─────────────────────────────────────────────────────────────────────────────
// Admin Service Seam (CONVENTIONS §3). Every Admin read and write goes through
// here: Admin pages and Server Actions never touch the sample store or, from
// Stage B, the database. Like src/services/catalogue.ts, this module is a thin
// SELECTOR. Stage A has the sample arm only; ticket 15 adds the database arm
// behind the same contract. Reads are always fresh and never cached.
//
// Every write takes the acting Staff User, its input and, from an editor, the
// stamp the record had when it opened, and returns an AdminResult: the saved
// value and the Catalogue cache tags to clear, or why it was refused. Each one
// checks the Staff Role itself, validates the input with zod, runs the
// conflict check, and records Staff Activity (CONVENTIONS §3).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The seam's public contract, checked against each arm below.
 *
 * The staff sign-in area runs before anyone is signed in, so unlike the Admin's
 * other writes it takes no StaffActor.
 */
export interface AdminService {
  /**
   * The staff list's answer to a sign-in with a verified email, compared
   * case-insensitively. Active Staff get in with their Staff Role. The first
   * sign-in with an unexpired Invite's email activates it and records Staff
   * Activity. An expired Invite is refused as "invite-expired", and anyone
   * else (or a malformed email) as "not-staff".
   */
  resolveSignIn(identity: SignInIdentity, now: Date): Promise<SignInResolution>;
  /** Records a refused sign-in. */
  recordDeniedSignIn(attempt: {
    email: string;
    reason: DeniedReason;
    at: Date;
  }): Promise<DeniedSignIn>;
  /** The latest recorded refused sign-in for this email, or null. */
  getLatestDeniedSignIn(email: string): Promise<DeniedSignIn | null>;
  /**
   * The Staff Guard's read: the active Staff User with this email
   * (case-insensitive), or null. Invites don't count until they're activated.
   */
  getStaffByEmail(email: string): Promise<StaffActor | null>;

  /** Settings: the contact email, shop and social links and trust figures, with their stamp. */
  getSettingsForAdmin(): Promise<AdminWebsiteSettings>;
  /**
   * Saves any of Settings' parts (Owners only). Saving the trust figures sets
   * their "as of" date to today in Manila. Clears the settings tag.
   */
  updateWebsiteSettings(
    actor: StaffActor,
    input: WebsiteSettingsUpdate,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminWebsiteSettings>>;
}

const impl: AdminService = mockImpl;

export const resolveSignIn = impl.resolveSignIn;
export const recordDeniedSignIn = impl.recordDeniedSignIn;
export const getLatestDeniedSignIn = impl.getLatestDeniedSignIn;
export const getStaffByEmail = impl.getStaffByEmail;
export const getSettingsForAdmin = impl.getSettingsForAdmin;
export const updateWebsiteSettings = impl.updateWebsiteSettings;
