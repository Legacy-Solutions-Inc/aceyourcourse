import { isDatabaseConfigured } from "@/env.server";
import { databaseArm } from "@/services/admin.db";
import * as mockImpl from "@/services/admin.mock";
import type {
  AnnouncementForm,
  BundleOfferForm,
  ChangeStaffRoleInput,
  ExamHeaderForm,
  ExamSeoForm,
  FaqForm,
  FaqMove,
  InviteStaffInput,
  NewProductForm,
  NewReviewForm,
  OfficialExamDateForm,
  ProductFlags,
  ProductForm,
  PromoBannerForm,
  ReviewForm,
  ReviewMove,
  SubjectNamesForm,
  WebsiteSettingsUpdate,
} from "@/services/admin.schema";
import type {
  AdminAnnouncement,
  AdminExamPage,
  AdminFaq,
  AdminFaqList,
  AdminOverview,
  AdminProduct,
  AdminProductList,
  AdminProductRow,
  AdminPromoBanner,
  AdminResult,
  AdminReview,
  AdminReviewList,
  AdminWebsiteSettings,
  DeletedFaq,
  DeletedProduct,
  DeletedReview,
  DeniedReason,
  DeniedSignIn,
  FaqListQuery,
  Invite,
  ProductDeletePreview,
  ProductListQuery,
  ReviewDeletePreview,
  ReviewListQuery,
  SignInIdentity,
  SignInResolution,
  StaffActor,
  StaffList,
  StaffMember,
} from "@/services/admin.types";
import type { Exam, ExamPageSection } from "@/services/catalogue.types";

// ─────────────────────────────────────────────────────────────────────────────
// Admin Service Seam (CONVENTIONS §3). Every Admin read and write goes through
// here: Admin pages and Server Actions never touch the sample store or, from
// Stage B, the database. Like src/services/catalogue.ts, this module is a thin
// SELECTOR: the database arm (admin.db.ts) when DATABASE_URL is set, the
// sample arm otherwise, behind the same contract. Reads are always fresh and
// never cached.
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

  /**
   * The Overview's read (any Staff User): every Product, the Exams, the Exam
   * page records, the shop pages, the trust figures and the promo banner, read fresh, so a fix made
   * elsewhere shows on the next load.
   */
  getOverview(actor: StaffActor): Promise<AdminOverview>;

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
  // isn't on the Product's Exam, a Live Product with no photo, a Coming Soon
  // one with Reviews, and moving the Product an Exam page offers as its
  // bundle to another Exam. Saving changed Shopee figures sets their "as of"
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
   * taken from those Reviews and the Exam page bundle offer of it, if any.
   * Its Staff Activity keeps every value from before. Marketplace Listings are
   * on the Marketplaces, so they aren't affected.
   */
  deleteProduct(actor: StaffActor, id: string): Promise<AdminResult<DeletedProduct>>;

  // Reviews (any Staff User). Reviews are copied word for word from a
  // Marketplace, for a Live Product, with one of its variations or none. Home
  // shows the pinned Reviews in the Home order, the first 9 (spec, Phase 2 →
  // Reviews). Each write appends one Staff Activity record and clears the
  // reviews tag, so the Website shows it on its next load.

  /**
   * The Reviews list: every Review, a hidden Product's included, in the
   * catalogue's order, or in the Home order with "Pinned on Home only". The
   * filters combine: the search (the text, case-insensitive), the Exam (an
   * unknown one is ignored), the stars and "Pinned on Home only". Whatever the
   * filters, it gives the Home order, for ▲▼; how many of the pins Home can
   * show, their Products shown on the website, for "N OF 9 PINNED ON HOME";
   * and the Live Products, for the editor.
   */
  listReviewsForAdmin(actor: StaffActor, query: ReviewListQuery): Promise<AdminReviewList>;
  /** One Review as its editor opens it, or null when it isn't in the catalogue. */
  getReviewForAdmin(actor: StaffActor, id: string): Promise<AdminReview | null>;
  /**
   * Adds a Review, numbered after the highest id ("rev-017"). Pinned, it goes
   * to the end of the Home order. Refused, with the field's message: no text,
   * stars outside 1–5, helpful votes that aren't a whole number of 0 or more,
   * a Product that isn't Live, or a variation the Product doesn't have.
   */
  createReview(actor: StaffActor, input: NewReviewForm): Promise<AdminResult<AdminReview>>;
  /**
   * Saves a Review's fields with the conflict check, keeping its place in the
   * Home order, with createReview's rules. A variation copied from the Marketplace
   * that isn't one of the Product's is kept while the Review stays on its
   * Product. An edit that removes the words an FAQ quotes from the Review is
   * refused, naming the FAQ: only a delete removes a quote.
   */
  updateReview(
    actor: StaffActor,
    id: string,
    input: ReviewForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminReview>>;
  /**
   * The HOME switch, a single toggle: it always saves, with no conflict check.
   * Pinning puts the Review at the end of the Home order (a pinned one keeps
   * its place); unpinning takes it off Home.
   */
  setReviewPinned(
    actor: StaffActor,
    id: string,
    pinned: boolean,
  ): Promise<AdminResult<AdminReview>>;
  /**
   * ▲ or ▼: swaps a pinned Review with the one before or after it in the Home
   * order, which it gives back. It always saves. The first can't move up, the
   * last can't move down, and a Review that isn't pinned can't move.
   */
  moveReviewPin(
    actor: StaffActor,
    id: string,
    direction: ReviewMove,
  ): Promise<AdminResult<string[]>>;
  /** What deleting a Review takes with it, or null when it isn't in the catalogue. */
  previewReviewDelete(actor: StaffActor, id: string): Promise<ReviewDeletePreview | null>;
  /**
   * Deletes a Review from the Website and Home, and removes the FAQ quotes
   * taken from it; the FAQs stay. Its Staff Activity keeps every value from
   * before. The original stays on the Marketplace.
   */
  deleteReview(actor: StaffActor, id: string): Promise<AdminResult<DeletedReview>>;

  // FAQs (any Staff User). The FAQ page has 5 fixed groups, each ordered with
  // ▲▼. Answers are at most 400 characters, and a supporting quote is copied
  // word for word from a Review shown on the Website (spec, Phase 2 → FAQ).
  // Each write appends one Staff Activity record and clears the faqs tag, so
  // the FAQ page and its FAQPage data show it on its next load.

  /**
   * The FAQS tab: the 5 groups with their counts, and the group's FAQs in
   * order (an unknown group is the first), hidden and app-only ones included.
   * A search matches every group's questions and answers, case-insensitively,
   * in the FAQ page's order. It also gives the Reviews a quote can come from,
   * and every deep-link slug.
   */
  listFaqsForAdmin(actor: StaffActor, query: FaqListQuery): Promise<AdminFaqList>;
  /** One FAQ as its editor opens it, or null when it isn't in the catalogue. */
  getFaqForAdmin(actor: StaffActor, id: string): Promise<AdminFaq | null>;
  /**
   * Adds an FAQ last in its group, numbered after the highest id ("faq-019"),
   * with its deep link set from the question: at most 40 characters, made
   * unique, and fixed afterwards. Refused, with the field's message: no
   * question or answer, an answer over 400 characters, a quote that isn't in
   * its Review word for word or whose Review isn't shown on the Website,
   * Popular with no chip label or one over 40 characters, or a second FAQ
   * showing the Subjects table.
   */
  createFaq(actor: StaffActor, input: FaqForm): Promise<AdminResult<AdminFaq>>;
  /**
   * Saves an FAQ's fields with the conflict check and createFaq's rules,
   * keeping its deep link. Moved to another group, it goes last there and its
   * old group closes the gap. A quote it already has is kept while unchanged.
   */
  updateFaq(
    actor: StaffActor,
    id: string,
    input: FaqForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminFaq>>;
  /**
   * ▲ or ▼: swaps an FAQ with the one before or after it in its group, and
   * gives back the group's order. It always saves. The first can't move up
   * and the last can't move down.
   */
  moveFaq(actor: StaffActor, id: string, direction: FaqMove): Promise<AdminResult<string[]>>;
  /** Deletes an FAQ and closes the gap in its group. Its Staff Activity keeps it from before. */
  deleteFaq(actor: StaffActor, id: string): Promise<AdminResult<DeletedFaq>>;

  // Exam pages (any Staff User). Each Exam's Website page: the Header and
  // the Subject names, which are the Exam's own fields; the sections that can
  // be hidden; the bundle offer; the SEO overrides and share image; and the
  // Official Exam Date (spec, Phase 2 → Exam pages & promo). The code is
  // matched case-insensitively, and an unknown one answers not-found. Each
  // part saves on its own, with its own stamp, so saving one never makes
  // another's editor conflict. Each write appends one Staff Activity record
  // and gives the page as it now is.

  /** One Exam's page as its editors open it, or null for an unknown code. */
  getExamPageForAdmin(actor: StaffActor, code: string): Promise<AdminExamPage | null>;
  /**
   * Saves the Header: the Exam's name, long name, text and "made for".
   * Refused, with the field's message, when one is blank or too long. Clears
   * the exams tag: the Exam shows on Home, its page and its Products' pages.
   */
  updateExamHeader(
    actor: StaffActor,
    code: string,
    input: ExamHeaderForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminExamPage>>;
  /**
   * Renames the Exam's Subjects, given in its order with their codes. The
   * codes are fixed: a list whose codes aren't the Exam's, in its order, is
   * refused. Clears the exams tag, so every place the Website names a Subject
   * shows the new name.
   */
  updateSubjectNames(
    actor: StaffActor,
    code: string,
    input: SubjectNamesForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminExamPage>>;
  /**
   * A section toggle, a single toggle: Subjects covered, Bundle offer or
   * Reviews, shown or hidden. It always saves, with no conflict check.
   */
  setExamSection(
    actor: StaffActor,
    code: string,
    section: ExamPageSection,
    on: boolean,
  ): Promise<AdminResult<AdminExamPage>>;
  /**
   * Saves the bundle offer: one of the Exam's Products, Live or not, with a
   * headline, text and button label, or no offer. A Product of another Exam,
   * or one that isn't in the catalogue, is refused. The Website shows it only
   * while the section is on and the Product is Live and shown.
   */
  updateBundleOffer(
    actor: StaffActor,
    code: string,
    input: BundleOfferForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminExamPage>>;
  /**
   * Saves the SEO title and description (blank uses the generated text) and
   * the share image: the page's own, a finished "share-image" upload's path
   * from the upload seam, or none for the site's. A whole title over 60
   * characters with the site name, a description over 160, or a share image
   * that's neither is refused; an upload whose file hasn't arrived is told
   * "Wait for uploads to finish."
   */
  updateExamSeo(
    actor: StaffActor,
    code: string,
    input: ExamSeoForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminExamPage>>;
  /** Saves the Official Exam Date, a date on the calendar, or none. A past date saves. */
  updateOfficialExamDate(
    actor: StaffActor,
    code: string,
    input: OfficialExamDateForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminExamPage>>;

  // The Home promo banner and the announcement bar (any Staff User; spec,
  // Phase 2 → Exam pages & promo). Both are part of the Website's settings,
  // so every write clears the settings tag and appends one Staff Activity
  // record. Links are https links or Website paths.

  /** The banner as its editor opens it: its fields and switch, or null while there's none. */
  getPromoForAdmin(actor: StaffActor): Promise<AdminPromoBanner>;
  /**
   * Saves the banner's text (at most 80 characters), button label (at most
   * 24), link and dates. The end date can't be before the start date. Its
   * switch stays as it is; a banner the Website didn't have starts off.
   */
  updatePromoBanner(
    actor: StaffActor,
    input: PromoBannerForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminPromoBanner>>;
  /**
   * "Show banner", and "Turn off banner now": a single toggle, so it always
   * saves, and never makes the open editor conflict. Home shows the banner
   * only within its dates (isPromoActive). Refused while there's no banner.
   */
  setPromoBannerVisible(
    actor: StaffActor,
    visible: boolean,
  ): Promise<AdminResult<AdminPromoBanner>>;
  /** The announcement bar as its editor opens it, with whether the Member App is live. */
  getAnnouncementForAdmin(actor: StaffActor): Promise<AdminAnnouncement>;
  /**
   * Saves the bar's 1–3 messages, in order, each with its text (at most 70
   * characters), link and "only while the Member App is live". Changed
   * messages get a new announcement id, which shows the bar again to Visitors
   * who dismissed it; a save that changes nothing keeps the id.
   */
  updateAnnouncement(
    actor: StaffActor,
    input: AnnouncementForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminAnnouncement>>;
}

const impl: AdminService = isDatabaseConfigured ? databaseArm : mockImpl;

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
export const getOverview = impl.getOverview;
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
export const listReviewsForAdmin = impl.listReviewsForAdmin;
export const getReviewForAdmin = impl.getReviewForAdmin;
export const createReview = impl.createReview;
export const updateReview = impl.updateReview;
export const setReviewPinned = impl.setReviewPinned;
export const moveReviewPin = impl.moveReviewPin;
export const previewReviewDelete = impl.previewReviewDelete;
export const deleteReview = impl.deleteReview;
export const listFaqsForAdmin = impl.listFaqsForAdmin;
export const getFaqForAdmin = impl.getFaqForAdmin;
export const createFaq = impl.createFaq;
export const updateFaq = impl.updateFaq;
export const moveFaq = impl.moveFaq;
export const deleteFaq = impl.deleteFaq;
export const getExamPageForAdmin = impl.getExamPageForAdmin;
export const updateExamHeader = impl.updateExamHeader;
export const updateSubjectNames = impl.updateSubjectNames;
export const setExamSection = impl.setExamSection;
export const updateBundleOffer = impl.updateBundleOffer;
export const updateExamSeo = impl.updateExamSeo;
export const updateOfficialExamDate = impl.updateOfficialExamDate;
export const getPromoForAdmin = impl.getPromoForAdmin;
export const updatePromoBanner = impl.updatePromoBanner;
export const setPromoBannerVisible = impl.setPromoBannerVisible;
export const getAnnouncementForAdmin = impl.getAnnouncementForAdmin;
export const updateAnnouncement = impl.updateAnnouncement;
