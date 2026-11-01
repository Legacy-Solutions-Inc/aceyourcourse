import * as mockImpl from "@/services/admin.mock";
import type {
  ChangeStaffRoleInput,
  InviteStaffInput,
  ProductFlags,
  WebsiteSettingsUpdate,
} from "@/services/admin.schema";
import type {
  AdminProductList,
  AdminProductRow,
  AdminResult,
  AdminWebsiteSettings,
  DeniedReason,
  DeniedSignIn,
  Invite,
  ProductListQuery,
  SignInIdentity,
  SignInResolution,
  StaffActor,
  StaffList,
  StaffMember,
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
  /**
   * Records a successful sign-in on the Staff User's row, for "LAST SIGNED
   * IN …". Someone who isn't active Staff is ignored. It records no Staff
   * Activity: signing in changes nothing in the Admin.
   */
  recordSignIn(email: string, at: Date): Promise<void>;

  // Staff and Invites (Owners only). Every write appends one Staff Activity
  // record and clears no cache tags. "invalid" carries the rule a write broke:
  // an email already on the staff list (as the email field's message), the
  // last Owner, or the actor's own access (as the form's message).

  /** Who can use the Admin: the active Staff, then the Invites, each in the order they were added. */
  listStaff(actor: StaffActor): Promise<AdminResult<StaffList>>;
  /** Makes an Invite for an email not yet on the staff list. It expires 7 days from now. */
  inviteStaff(actor: StaffActor, input: InviteStaffInput): Promise<AdminResult<Invite>>;
  /** Restarts an Invite's 7 days from now, even once it has expired. */
  renewInvite(actor: StaffActor, email: string): Promise<AdminResult<Invite>>;
  /** Deletes an Invite, so its email is no longer on the staff list. Gives the cancelled Invite. */
  cancelInvite(actor: StaffActor, email: string): Promise<AdminResult<Invite>>;
  /** Makes an active Staff User an Owner or an Editor, from their next request. */
  changeStaffRole(
    actor: StaffActor,
    input: ChangeStaffRoleInput,
  ): Promise<AdminResult<StaffMember>>;
  /**
   * Takes an active Staff User off the staff list: they're refused on their
   * next request. Their Staff Activity stays. Gives the removed Staff User.
   */
  removeStaff(actor: StaffActor, email: string): Promise<AdminResult<StaffMember>>;

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

  // Products (any Staff User). The reads take the actor too, though the sample
  // arm has no use for it: the database arm (ticket 15) reads with Drizzle,
  // which bypasses RLS, so it scopes each read by the Staff User in the app
  // layer (coding standards §3).

  /**
   * The Products list: every Product, Coming Soon and hidden ones included,
   * Live ones by units sold and then title, then Coming Soon by title. The
   * filters combine: the search (title or short name, case-insensitive), the
   * Exam (an unknown one is ignored) and Missing product links (Live Products
   * with a Marketplace on its shop page).
   */
  listProductsForAdmin(actor: StaffActor, query: ProductListQuery): Promise<AdminProductList>;
  /**
   * One Product's row, whatever the list's filters, or null when it isn't in
   * the catalogue: the selected Product, for the panel beside the list.
   */
  getProductRowForAdmin(actor: StaffActor, id: string): Promise<AdminProductRow | null>;
  /**
   * A single toggle, "Show on website" or "Available in app": it always saves,
   * with no conflict check, and appends Staff Activity. A Product that's gone
   * answers not-found. Clears the products tag.
   */
  setProductFlags(
    actor: StaffActor,
    id: string,
    flags: ProductFlags,
  ): Promise<AdminResult<AdminProductRow>>;
}

const impl: AdminService = mockImpl;

export const resolveSignIn = impl.resolveSignIn;
export const recordDeniedSignIn = impl.recordDeniedSignIn;
export const getLatestDeniedSignIn = impl.getLatestDeniedSignIn;
export const getStaffByEmail = impl.getStaffByEmail;
export const recordSignIn = impl.recordSignIn;
export const listStaff = impl.listStaff;
export const inviteStaff = impl.inviteStaff;
export const renewInvite = impl.renewInvite;
export const cancelInvite = impl.cancelInvite;
export const changeStaffRole = impl.changeStaffRole;
export const removeStaff = impl.removeStaff;
export const getSettingsForAdmin = impl.getSettingsForAdmin;
export const updateWebsiteSettings = impl.updateWebsiteSettings;
export const listProductsForAdmin = impl.listProductsForAdmin;
export const getProductRowForAdmin = impl.getProductRowForAdmin;
export const setProductFlags = impl.setProductFlags;
