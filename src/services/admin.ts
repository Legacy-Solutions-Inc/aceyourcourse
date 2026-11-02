import * as mockImpl from "@/services/admin.mock";
import type {
  ChangeStaffRoleInput,
  InviteStaffInput,
  NewProductForm,
  ProductFlags,
  ProductForm,
  WebsiteSettingsUpdate,
} from "@/services/admin.schema";
import type {
  AdminProduct,
  AdminProductList,
  AdminProductRow,
  AdminResult,
  AdminWebsiteSettings,
  DeletedProduct,
  DeniedReason,
  DeniedSignIn,
  Invite,
  ProductDeletePreview,
  ProductListQuery,
  SignInIdentity,
  SignInResolution,
  StaffActor,
  StaffList,
  StaffMember,
} from "@/services/admin.types";
import type { Exam } from "@/services/catalogue.types";

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
   * A single toggle, "Show on website" or "Available in app": it always saves,
   * with no conflict check, and appends Staff Activity. A Product that's gone
   * answers not-found. Clears the products tag.
   */
  setProductFlags(
    actor: StaffActor,
    id: string,
    flags: ProductFlags,
  ): Promise<AdminResult<AdminProductRow>>;

  // The Product editor. Each write parses the editor's form with every rule
  // (admin.schema.ts) and refuses, with the field's message, a Subject that
  // isn't on the Product's Exam, a Live Product with no photo, and a Coming
  // Soon one with Reviews. Saving changed Shopee figures sets their "as of"
  // date to today in Manila. The photos are saved in the form's order, the
  // first the cover: each one the Product's own or a finished upload's path
  // from the upload seam (src/services/uploads.ts), which becomes its public
  // URL. Any other photo is refused, and an upload whose file hasn't arrived
  // is refused with "Wait for uploads to finish." Every photo's alt text is
  // generated: "{full name}, photo N of M". Each one appends one Staff Activity record and
  // clears the tags of what it changed, so the Website shows it on its next
  // load.

  /** The Exams a Product can be for, each with its Subjects, in the catalogue's order. */
  listExamsForAdmin(actor: StaffActor): Promise<Exam[]>;
  /** One Product as its editor opens it, or null when it isn't in the catalogue. */
  getProductForAdmin(actor: StaffActor, id: string): Promise<AdminProduct | null>;
  /**
   * Adds a Product with its photos. Its page address is made from its name,
   * unique with -2, -3…, and never changes after.
   */
  createProduct(actor: StaffActor, input: NewProductForm): Promise<AdminResult<AdminProduct>>;
  /**
   * Saves a Product's fields and photos, with the conflict check against the
   * stamp its editor opened with. Its page address and the two single toggles
   * ("Show on website", "Available in app") stay as they are.
   */
  updateProduct(
    actor: StaffActor,
    id: string,
    input: ProductForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminProduct>>;
  /** What deleting a Product takes with it, or null when it isn't in the catalogue. */
  previewProductDelete(actor: StaffActor, id: string): Promise<ProductDeletePreview | null>;
  /**
   * Deletes a Product with its Reviews and photos, and removes the FAQ quotes
   * taken from those Reviews. Its Staff Activity keeps every value from before.
   * Marketplace Listings are on the Marketplaces, so they aren't affected.
   */
  deleteProduct(actor: StaffActor, id: string): Promise<AdminResult<DeletedProduct>>;
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
export const setProductFlags = impl.setProductFlags;
export const listExamsForAdmin = impl.listExamsForAdmin;
export const getProductForAdmin = impl.getProductForAdmin;
export const createProduct = impl.createProduct;
export const updateProduct = impl.updateProduct;
export const previewProductDelete = impl.previewProductDelete;
export const deleteProduct = impl.deleteProduct;
