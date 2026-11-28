import { isDatabaseConfigured } from "@/env.server";
import type { InvoiceRequest } from "@/lib/payments/invoice-requests";
import { databaseArm } from "@/services/admin.db";
import * as mockImpl from "@/services/admin.mock";
import type {
  AboutSectionForm,
  AnnouncementForm,
  BetaTesterInput,
  BundleOfferForm,
  ChangeStaffRoleInput,
  EndAccessInput,
  ExamHeaderForm,
  ExtendAccessInput,
  ExamSeoForm,
  FaqForm,
  FaqMove,
  ForceSignOutInput,
  GrantAccessInput,
  CourseOwnershipInput,
  InviteStaffInput,
  NewExamForm,
  NewProductForm,
  NewQuestionForm,
  NewReviewForm,
  NewSubjectForm,
  CardForm,
  CourseForm,
  CourseModuleForm,
  LessonForm,
  LessonToModuleInput,
  LessonUploadInput,
  LessonUploadOutcomeInput,
  NewCourseForm,
  NewCourseModuleForm,
  NewLessonForm,
  ImportInput,
  ConfirmImportInput,
  DeleteAccountInput,
  NewCardForm,
  NewTopicForm,
  OfficialExamDateForm,
  OrderNoteInput,
  PlanForm,
  QuestionForm,
  QuizSettingsForm,
  PrivacyRequestInput,
  ProductFlags,
  ProductForm,
  PromoBannerForm,
  RenameTopicForm,
  ReviewForm,
  ReviewMove,
  ReviewerPdfPlacementForm,
  ReviewerPdfRecordInput,
  SubjectNamesForm,
  TopicMove,
  WebsiteSettingsUpdate,
} from "@/services/admin.schema";
import type {
  AccessPassChange,
  CourseOwnershipChange,
  AdminAbout,
  AdminAnnouncement,
  AdminCard,
  AdminCourse,
  AdminCourseList,
  AdminCourseModule,
  AdminCourseSummary,
  OneTimePurchase,
  AdminLessonPreview,
  AdminLessonUpload,
  AdminDeck,
  AdminDeckSettings,
  AdminLesson,
  RecordStamp,
  AdminExamPage,
  AdminSitePage,
  AdminFaq,
  AdminFaqList,
  AdminMemberDetail,
  AdminOrderDetail,
  AdminOrderList,
  AdminOrderNote,
  AdminOverview,
  PaidToday,
  StaffActivityList,
  StaffActivityQuery,
  AdminPlan,
  AdminPlans,
  AdminPrivacyRequest,
  AdminPrivacyRequestDetail,
  AdminProduct,
  AdminQuestion,
  AdminQuiz,
  AdminQuizSettings,
  AdminProductList,
  AdminProductRow,
  AdminPromoBanner,
  AdminResult,
  AdminReview,
  AdminReviewList,
  AdminTopic,
  AdminTopicList,
  AdminUserList,
  CardImageFile,
  ImportPreview,
  ImportResult,
  AdminWebsiteSettings,
  BetaTester,
  DeletedCard,
  DeletedFaq,
  DeletedProduct,
  DeletedQuestion,
  AdminReviewerPdf,
  AdminReviewerPdfDetail,
  AdminReviewerPdfScreen,
  ReviewerPdfRun,
  StaleReviewerPdfJobs,
  DeletedReview,
  DeniedReason,
  DeniedSignIn,
  FaqListQuery,
  ForcedSignOut,
  MemberDataFile,
  OrderListQuery,
  OrdersCsv,
  OrderStatusCheck,
  Plan,
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
  UserListQuery,
} from "@/services/admin.types";
import type { ContentVisibility, Topic } from "@/services/content.types";
import type { Course, CourseModule, Lesson } from "@/services/courses.types";
import type { VideoService } from "@/services/video.types";
import type { AuthAdmin } from "@/services/auth-admin.types";
import type { PdfRenderer } from "@/services/page-images.types";
import type { PaymentsClient } from "@/services/payments.types";
import type { Exam, ExamPageSection, SitePageKey } from "@/services/catalogue.types";

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
   *
   * `profileName` is the Google profile's name, for display only. It names a
   * Staff User whose name is still their email (the first Owner, added at
   * deployment by `staff:add-owner`); a name the staff list has is kept, and
   * a missing or blank one changes nothing.
   */
  recordSignIn(email: string, at: Date, profileName?: string | null): Promise<void>;

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

  // Beta Testers (Owners only; spec, Phase 3 → The beta gate): the Google
  // emails let into the Member App while its switch is off, matched by
  // verified email like an Invite, with no expiry and no role. Each write
  // appends one Staff Activity record and clears no cache tags.

  /** The Beta Tester list, in the order they were added, each with the date and who added them. */
  listBetaTesters(actor: StaffActor): Promise<AdminResult<BetaTester[]>>;
  /**
   * Adds a Google email, trimmed and lowercased, before the person has an
   * account. A malformed email, or one already on the list, is refused with
   * the email field's message. Adding grants nothing but the way in.
   */
  addBetaTester(actor: StaffActor, input: BetaTesterInput): Promise<AdminResult<BetaTester>>;
  /**
   * Takes an email off the list: while the switch is off, they're refused at
   * their next request. Their Member record and data stay. Gives the removed
   * Beta Tester.
   */
  removeBetaTester(actor: StaffActor, email: string): Promise<AdminResult<BetaTester>>;

  // Users (Owners only; Phase 3, ticket 16; stories 129, 130 and 132): the
  // Members, each Member's detail, and force sign-out. An Editor is refused
  // each call. None touches the Catalogue, so none returns a cache tag.

  /**
   * One page of the Members, newest first: those whose name or email holds
   * the search (ignoring case), in the filter (an Access Pass active now, all
   * ended, none; active Staff; Beta Testers), each with their Target Exams,
   * passes, Active Device and role. A page past the last gives the last.
   */
  listUsers(actor: StaffActor, query: UserListQuery): Promise<AdminResult<AdminUserList>>;
  /**
   * A Member's detail page: profile, role, Target Exams with Exam Dates,
   * Access Passes with their grants, progress per Target Exam (ticket 15's
   * calculator), the Active Device and its switch log, and every agreement to
   * the Terms and Privacy Policy. A User id that isn't a Member's, or isn't a
   * User id, is not-found.
   */
  getMemberForAdmin(actor: StaffActor, userId: string): Promise<AdminResult<AdminMemberDetail>>;
  /**
   * Force sign-out: clears the Member's Active Device, so their device's next
   * Member App request lands on "Session ended", and records the reason and
   * the device in Staff Activity. Their passes, progress and switch log stay.
   * A blank reason is refused on the reason field; a Member with no Active
   * Device is refused with a message, recording nothing.
   */
  forceSignOut(actor: StaffActor, input: ForceSignOutInput): Promise<AdminResult<ForcedSignOut>>;

  // Access Passes (Owners only; Phase 3, ticket 17; stories 131, 133h and
  // 133j): grant, extend and end a Member's Access Pass for an Exam, from
  // their detail page. Each needs a reason, which Staff Activity keeps with
  // the pass's end before and after, and leaves the Member an in-app notice
  // (no email). An Editor is refused each call. None touches the Catalogue,
  // so none returns a cache tag.

  /**
   * Grant Access Pass: 30, 90, 180 or 365 days, or a custom 1–365, added from
   * the pass's end, or from now when it has ended or there is none, and kept
   * as a history row. A grant for an Exam the Member doesn't have adds it to
   * their Target Exams with its Official Exam Date (or brings back one they
   * removed, with its date and progress), leaving their selection. Refused
   * for an Exam that isn't in the catalogue.
   */
  grantAccess(actor: StaffActor, input: GrantAccessInput): Promise<AdminResult<AccessPassChange>>;
  /**
   * Extend access: 3, 7, 14 or 30 days on a pass the Member holds, from its
   * end or from now when it has ended, kept as a history row. Refused with a
   * message when they hold no pass for the Exam.
   */
  extendAccess(actor: StaffActor, input: ExtendAccessInput): Promise<AdminResult<AccessPassChange>>;
  /**
   * End access now: sets the pass's end to now, so the Member sees the
   * expired state; their progress and the pass's history stay. A pass that
   * has already ended, or none, is refused with a message, recording nothing.
   */
  endAccess(actor: StaffActor, input: EndAccessInput): Promise<AdminResult<AccessPassChange>>;

  // Courses by hand (Owners only; Phase 5, ticket 07; story 172;
  // course-ownership.core.ts): give or remove a separately sold Course from
  // a Member's detail page. Each leaves the Member an in-app notice (no
  // email) and a Staff Activity record. An Editor is refused each call. None
  // touches the Catalogue, so none returns a cache tag.

  /**
   * "Give Course": Course Ownership of a separately sold Course with no Order
   * ("Given by Ace Your Course"), and its Exam in their Target Exams, added
   * or brought back. Refused for a Course they own already, one included in
   * All-Access, or no Course.
   */
  giveCourse(
    actor: StaffActor,
    input: CourseOwnershipInput,
  ): Promise<AdminResult<CourseOwnershipChange>>;
  /**
   * "Remove Course": a given Ownership only. Refused for a paid one (only a
   * full refund in PayMongo removes it), a given one a Paid Order also
   * holds, and a Course they don't own.
   */
  removeCourse(
    actor: StaffActor,
    input: CourseOwnershipInput,
  ): Promise<AdminResult<CourseOwnershipChange>>;

  // Privacy Requests (Owners only; Phase 3, tickets 18 and 19; stories 133,
  // 133q and 133r): what Members asked for from Account, and carrying it
  // out. An Editor is refused every call. Each write appends one Staff
  // Activity record naming the request and an opaque User id, never the
  // Member's email or name. None touches the Catalogue, so none returns a
  // cache tag. Nothing is emailed.

  /**
   * Every Member's Privacy Requests (data copy or deletion), soonest due
   * first, each with its Member (none once their account is deleted), the
   * day it was asked for, the Manila date it's due, its status, when and by
   * whom it was marked done, and whether it's still open after its due date.
   */
  listPrivacyRequests(actor: StaffActor): Promise<AdminResult<AdminPrivacyRequest[]>>;
  /**
   * One request, as its screen shows it: the list's fields, why deleting the
   * account is refused now (the staff list, the last Owner), whether a
   * deletion is half done, and whether the Member is a Beta Tester. An id
   * that isn't a request's is not-found.
   */
  getPrivacyRequestForAdmin(
    actor: StaffActor,
    requestId: string,
  ): Promise<AdminResult<AdminPrivacyRequestDetail>>;
  /**
   * "Download this Member's data", from a data-copy request: every record
   * kept about the Member, only theirs, as a JSON file, and the download
   * logged in Staff Activity. A Member whose account is gone is refused as
   * "Already deleted"; a deletion request has no file.
   */
  exportMemberData(actor: StaffActor, requestId: string): Promise<AdminResult<MemberDataFile>>;
  /**
   * "Delete this account", from an open deletion request, after typing the
   * Member's email: deletes their Member data and Access Passes (no refund)
   * in one step, taking their email out of earlier Staff Activity, then their
   * Supabase User with `authAdmin`, then marks the request done. Refused for
   * an email on the staff list (active or invited) and for the last Owner,
   * and for a wrong typed email. If Supabase fails, the request stays open
   * and deleting again (no typed email needed) finishes it.
   */
  deleteMemberAccount(
    actor: StaffActor,
    input: DeleteAccountInput,
    authAdmin: AuthAdmin,
  ): Promise<AdminResult<AdminPrivacyRequest>>;
  /**
   * "Mark done", with the date and who. A deletion request is done once its
   * account is deleted: refused while the account is still there, or half
   * deleted. A request already done is refused.
   */
  markPrivacyRequestDone(
    actor: StaffActor,
    input: PrivacyRequestInput,
  ): Promise<AdminResult<AdminPrivacyRequest>>;

  /**
   * The Overview's read (any Staff User): every Product, the Exams, the Exam
   * page records, the shop pages, the trust figures and the promo banner, read fresh, so a fix made
   * elsewhere shows on the next load. For an Owner it adds the sales figures,
   * the Member figures and the payment work waiting (Phase 4, ticket 11);
   * an Editor gets none of them (`sales` is null).
   */
  getOverview(actor: StaffActor): Promise<AdminOverview>;
  /** The sidebar's "PAID TODAY" card (ticket 11): an Owner's; null for an Editor. */
  getPaidToday(actor: StaffActor): Promise<PaidToday | null>;

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

  // Adding and deleting Exams and Subjects (Owners only; ticket 23; spec,
  // Phase 2 → "Adding Exams and Subjects"). Codes are saved in capitals and
  // fixed once saved. Each write appends one Staff Activity record, entity
  // "exam", and records no conflict check: there's no form to go stale.

  /**
   * Adds an Exam, last, with its Subjects: a code of 2–6 letters that isn't
   * already an Exam's, a board of 2–10 letters, the Header's fields with
   * their limits, and at least one Subject. At most 12 Exams. Its page
   * starts with every section shown, no bundle offer and no Official Exam
   * Date. It's listed for the Product editor at once, and reaches the Website
   * once one of its Products is on the Website. Clears the exams tag.
   */
  createExam(actor: StaffActor, input: NewExamForm): Promise<AdminResult<AdminExamPage>>;
  /**
   * Adds a Subject, last, to an Exam: a code of 1–20 letters, digits, spaces
   * or "&" that the Exam doesn't have, and a name. Clears the exams tag.
   */
  addSubject(
    actor: StaffActor,
    code: string,
    input: NewSubjectForm,
  ): Promise<AdminResult<AdminExamPage>>;
  /**
   * Deletes a Subject no Product is tagged with. The Exam's last Subject
   * stays. Otherwise the refusal's message is the reason. Clears the exams tag.
   */
  deleteSubject(
    actor: StaffActor,
    code: string,
    subjectCode: string,
  ): Promise<AdminResult<AdminExamPage>>;
  /**
   * Deletes an Exam no Product belongs to, Live, Coming Soon or hidden, with
   * its Subjects and its page record. Otherwise the refusal's message is the
   * reason. Gives the deleted Exam, and clears the exams and exam-pages tags.
   * From Phase 3, Topic content (a deck, quiz or Reviewer PDF, Hidden and
   * Draft ones too) blocks deleting an Exam or Subject as well, and the empty
   * Topics of a deleted Exam or Subject go with it.
   */
  deleteExam(actor: StaffActor, code: string): Promise<AdminResult<Exam>>;

  // Member App content: Topics (any Staff User; Phase 3, ticket 05; spec,
  // Phase 3 planning decisions → Topics editor). Each Subject's Topics, in
  // order. A name is 1–120 characters, unique within its Subject ignoring
  // case. Each write appends one Staff Activity record (entity "topic"); none
  // returns a cache tag, since nothing cached reads Topics.

  /** A Subject's Topics list, or null when the Exam or Subject isn't in the catalogue. */
  listTopicsForAdmin(
    actor: StaffActor,
    examCode: string,
    subjectCode: string,
  ): Promise<AdminTopicList | null>;
  /** "+ Add topic": a new, empty Topic, last in its Subject. */
  createTopic(actor: StaffActor, input: NewTopicForm): Promise<AdminResult<AdminTopic>>;
  /** Renames a Topic, with the conflict check. Its progress is tied to it, not its name. */
  renameTopic(
    actor: StaffActor,
    input: RenameTopicForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminTopic>>;
  /** ▲▼: one place earlier or later in its Subject. Gives the Subject's new order of ids. */
  moveTopic(actor: StaffActor, id: string, direction: TopicMove): Promise<AdminResult<string[]>>;
  /**
   * Deletes an empty Topic; one with a deck, quiz or Reviewer PDF, Hidden or
   * Draft ones too, is refused with the reason. Gives the deleted Topic.
   */
  deleteTopic(actor: StaffActor, id: string): Promise<AdminResult<Topic>>;

  // Member App content: card import (any Staff User; Phase 3, ticket 06; spec,
  // Phase 3 → Spreadsheet import). The browser uploads the CSV and zip to the
  // private content bucket (the upload seam's createContentUpload) and names
  // them here by their paths. Nothing cached reads Topics or cards, so neither
  // returns a cache tag. src/services/card-import.core.ts has the steps.

  /**
   * "Check file": the preview of importing the CSV (and zip) into a Subject:
   * each Topic the CSV names (created or matched by name) with the cards to
   * add, replace, keep and remove, and every problem with its row and column.
   * Saves nothing. Not found when the Exam or Subject isn't there; invalid
   * when a file hasn't been uploaded.
   */
  planCardImport(actor: StaffActor, input: ImportInput): Promise<AdminResult<ImportPreview>>;
  /**
   * "Import": saves a preview with no problems in one go, or nothing: the new
   * Topics (after the existing ones), their decks (Hidden), the cards and
   * their images (in the private content bucket), and one Staff Activity
   * record with each Topic's counts. A conflict when the Subject's Topics or
   * cards changed since the preview (`basedOn`); invalid when the files now
   * have problems.
   */
  confirmCardImport(
    actor: StaffActor,
    input: ConfirmImportInput,
  ): Promise<AdminResult<ImportResult>>;

  // Member App content: quiz import (any Staff User; Phase 3, ticket 09; spec,
  // Phase 3 → Spreadsheet import, Corrections never cost progress). The same
  // import as cards, with quiz rows: src/services/quiz-import.core.ts.

  /**
   * "Check file": the preview of importing a quiz CSV (and zip of figures)
   * into a Subject: each Topic the CSV names with the questions to add,
   * replace, keep and remove, and every problem with its row and column.
   * Saves nothing.
   */
  planQuizImport(actor: StaffActor, input: ImportInput): Promise<AdminResult<ImportPreview>>;
  /**
   * "Import": saves a preview with no problems in one go, or nothing: the new
   * Topics, their quizzes (Hidden, with the default settings), the questions
   * and their figures, and one Staff Activity record with each Topic's
   * counts. Replace never deletes a question: one it takes out is kept,
   * marked removed, so Members' attempts and Best Scores keep it.
   */
  confirmQuizImport(
    actor: StaffActor,
    input: ConfirmImportInput,
  ): Promise<AdminResult<ImportResult>>;

  // Member App content: the card editor (any Staff User; Phase 3, ticket 07;
  // spec, Phase 3 → Content model; stories 125, 127, 128). A Topic's deck,
  // one card at a time. A card's front and back are required, and each field
  // is held to its length and must render (src/lib/cards/card-fields.ts). Its
  // back image is the card's own, a finished "card-image" upload of a JPEG,
  // PNG or WebP of at most 5 MB (copied under the deck in the private content
  // bucket), or none. Each write appends one Staff Activity record per entity
  // it changes ("card", "deck"); none returns a cache tag, since nothing
  // cached reads cards or decks. src/services/deck-editor.core.ts has the
  // steps.

  /** A Topic's deck screen: the Topic, its deck (null until its first card) and the cards in order. */
  getDeckForAdmin(actor: StaffActor, topicId: string): Promise<AdminDeck | null>;
  /** A card's back image, for Staff, or null when it has none or isn't there. */
  getCardImageForAdmin(actor: StaffActor, cardId: string): Promise<CardImageFile | null>;
  /**
   * "Save" or "Save & add next" on a new card: it goes last in its Topic's
   * deck. A Topic with no deck gets one, Hidden and not Free Preview.
   */
  createCard(actor: StaffActor, input: NewCardForm): Promise<AdminResult<AdminCard>>;
  /**
   * Saves a card's fields and image, with the conflict check against the
   * stamp its form opened with. A replaced or removed image's file is deleted.
   */
  updateCard(
    actor: StaffActor,
    input: CardForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminCard>>;
  /** ▲▼: one place earlier or later in its deck. Gives the deck's new order of ids. */
  moveCard(actor: StaffActor, id: string, direction: ReviewMove): Promise<AdminResult<string[]>>;
  /**
   * Deletes a card with every Member's Card Mark on it and its image, and
   * closes the gap. The last card of a Visible deck makes the deck Hidden,
   * which `deckHidden` says.
   */
  deleteCard(actor: StaffActor, id: string): Promise<AdminResult<DeletedCard>>;
  /**
   * "Visible to members", a single toggle: Visible is refused while the deck
   * is empty ("ADD A CARD FIRST"); Hidden always saves. Hidden decks never
   * show in the Member App.
   */
  setDeckVisibility(
    actor: StaffActor,
    deckId: string,
    visible: boolean,
  ): Promise<AdminResult<AdminDeckSettings>>;
  /** "Free Preview", a single toggle: Members with no Access Pass can open a Visible deck. */
  setDeckFreePreview(
    actor: StaffActor,
    deckId: string,
    freePreview: boolean,
  ): Promise<AdminResult<AdminDeckSettings>>;

  // Member App content: quizzes (any Staff User; Phase 3, ticket 09; spec,
  // Phase 3 → Content model; stories 126–128). A Topic's quiz screen: its
  // settings, its Visible and Free Preview toggles, and its questions (the
  // question editor comes with ticket 10). Each write appends one Staff
  // Activity record (entity "quiz"); none returns a cache tag, since nothing
  // cached reads quizzes. src/services/quiz-editor.core.ts has the steps.

  /** A Topic's quiz screen: the Topic, its quiz (null when it has none) and its questions in order. */
  getQuizForAdmin(actor: StaffActor, topicId: string): Promise<AdminQuiz | null>;
  /** A question's figure, for Staff, or null when it has none or isn't in a quiz. */
  getQuestionFigureForAdmin(actor: StaffActor, questionId: string): Promise<CardImageFile | null>;
  /**
   * "Save settings": the passing score (a whole number from 1 to 100),
   * shuffle and "show answers after", with the conflict check against the
   * settings' stamp when the form opened.
   */
  updateQuizSettings(
    actor: StaffActor,
    input: QuizSettingsForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminQuizSettings>>;
  /**
   * "Visible to members", a single toggle: Visible is refused while the quiz
   * has no questions ("ADD A QUESTION FIRST"); Hidden always saves.
   */
  setQuizVisibility(
    actor: StaffActor,
    quizId: string,
    visible: boolean,
  ): Promise<AdminResult<AdminQuizSettings>>;
  /** "Free Preview", a single toggle: Members with no Access Pass can open a Visible quiz. */
  setQuizFreePreview(
    actor: StaffActor,
    quizId: string,
    freePreview: boolean,
  ): Promise<AdminResult<AdminQuizSettings>>;

  // Member App content: the question editor (any Staff User; Phase 3, ticket
  // 10; spec, Phase 3 → Content model, Corrections never cost progress;
  // stories 125, 127, 133l). A Topic's quiz, one question at a time, as the
  // card editor does cards. A question, each of its four choices and its
  // explanation are required, each held to its length and must render, and
  // one of A–D is correct (src/lib/quizzes/question-fields.ts). Its figure is
  // the question's own, a finished "card-image" upload (a JPEG, PNG or WebP
  // of at most 5 MB, copied under the quiz in the private content bucket), or
  // none. Each write appends one Staff Activity record per entity it changes
  // ("question", "quiz"); none returns a cache tag.

  /**
   * "Save" or "Save & add next" on a new question: it goes last in its
   * Topic's quiz. A Topic with no quiz gets one, Hidden, not Free Preview,
   * with the default settings.
   */
  createQuestion(actor: StaffActor, input: NewQuestionForm): Promise<AdminResult<AdminQuestion>>;
  /**
   * Saves a question's fields and figure, with the conflict check against the
   * stamp its form opened with. A replaced or removed figure's file is
   * deleted. Members' old attempts and Best Scores aren't recalculated.
   */
  updateQuestion(
    actor: StaffActor,
    input: QuestionForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminQuestion>>;
  /** ▲▼: one place earlier or later in its quiz. Gives the quiz's new order of ids. */
  moveQuestion(
    actor: StaffActor,
    id: string,
    direction: ReviewMove,
  ): Promise<AdminResult<string[]>>;
  /**
   * Takes a question out of its quiz and closes the gap. It's never erased:
   * it's kept, marked removed, with its figure, so Members' old attempts show
   * it as removed and their Best Scores stay. The last question of a Visible
   * quiz makes the quiz Hidden, which `quizHidden` says.
   */
  deleteQuestion(actor: StaffActor, id: string): Promise<AdminResult<DeletedQuestion>>;

  // Reviewer PDFs (any Staff User; Phase 3, ticket 12; stories 114, 115).
  // An Editor's browser uploads the PDF straight to the private Reviewer PDFs
  // bucket (the upload seam's createReviewerPdfUpload); recording it starts a
  // job that splits it into page images in short runs, which ends a Draft,
  // or Failed with the fix to try. Each upload and delete appends one Staff
  // Activity record; the job's own changes append none. No cache tags: the
  // Member App reads its content fresh, and none of this is Published yet.

  /** Every Reviewer PDF, newest upload first, then the sample data's ones from before uploads. */
  listReviewerPdfsForAdmin(actor: StaffActor): Promise<AdminReviewerPdf[]>;
  /**
   * Records an uploaded PDF as a Processing Reviewer PDF, with the file's
   * name and its size as stored. Refused while the upload hasn't arrived, and
   * for a path that isn't a Reviewer PDF upload (or was recorded already).
   */
  recordReviewerPdf(
    actor: StaffActor,
    input: ReviewerPdfRecordInput,
  ): Promise<AdminResult<AdminReviewerPdf>>;
  /**
   * Deletes a Reviewer PDF, whatever its status, with its job, its original
   * and every page image. A run in flight stops, and deletes its pages.
   */
  deleteReviewerPdf(actor: StaffActor, id: string): Promise<AdminResult<AdminReviewerPdf>>;
  /**
   * One run of a Reviewer PDF's job (no Staff User: the run endpoint calls
   * it): renders its next pages, at most PAGES_PER_RUN, with `renderer`, and
   * stores them. Says whether another run is needed. Throws when the server
   * fails, leaving the job for the cron to restart.
   */
  runReviewerPdfJob(id: string, renderer: PdfRenderer): Promise<ReviewerPdfRun>;
  /**
   * The cron's sweep (no Staff User): restarts each Processing job whose
   * heartbeat has gone stale, and fails one restarted MAX_RESTARTS times.
   * Says which it restarted, each needing a run started, and which it failed.
   */
  restartStaleReviewerPdfJobs(): Promise<StaleReviewerPdfJobs>;

  // Placing, previewing and publishing a Reviewer PDF (any Staff User; Phase
  // 3, ticket 13; stories 116, 128, 133o). Statuses go Draft → Published ⇄
  // Unpublished (src/lib/reviewer-pdfs/status.ts): publishing needs a Topic
  // and a job that split every page. One Reviewer PDF per Topic. Only a
  // Published one is in the Member App. Each change appends one Staff
  // Activity record; placing runs the conflict check, while Publish,
  // Unpublish and Free Preview always save. A new Topic for it is made with
  // createTopic, by the Topics editor's rules.

  /** One Reviewer PDF's screen, with every Topic it can be placed under, or null. */
  getReviewerPdfForAdmin(actor: StaffActor, id: string): Promise<AdminReviewerPdfScreen | null>;
  /**
   * One of a Reviewer PDF's clean page images, for its preview (Staff only),
   * or null for a page its job hasn't stored. Never for a Member.
   */
  getReviewerPdfPageForAdmin(
    actor: StaffActor,
    id: string,
    page: number,
  ): Promise<Uint8Array | null>;
  /**
   * Places a Reviewer PDF under a Topic, against the placement's stamp when
   * its form opened. Refused for a Topic that has another Reviewer PDF, a
   * Topic that's gone, and a Failed one.
   */
  placeReviewerPdf(
    actor: StaffActor,
    input: ReviewerPdfPlacementForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminReviewerPdfDetail>>;
  /**
   * Publishes (true) or unpublishes (false) a Reviewer PDF. Publishing is
   * refused without a Topic, while Processing, once Failed, and with no pages.
   */
  setReviewerPdfPublished(
    actor: StaffActor,
    id: string,
    published: boolean,
  ): Promise<AdminResult<AdminReviewerPdfDetail>>;
  /** Flags a Reviewer PDF Free Preview, or not: Members with no Access Pass read it once Published. */
  setReviewerPdfFreePreview(
    actor: StaffActor,
    id: string,
    freePreview: boolean,
  ): Promise<AdminResult<AdminReviewerPdfDetail>>;

  // Site pages (any Staff User; ticket 20; spec, Phase 2 → Site pages). Each
  // of the Website's five Site pages: its SEO title and description (blank
  // uses the text in code) and its share image, with an Exam page's rules.
  // Each page saves on its own, with its own stamp, and each write appends
  // one Staff Activity record and clears only the site-pages tag.

  /** A Site page as its editor opens it: its record, or nothing set while it has none. */
  getSitePageForAdmin(actor: StaffActor, page: SitePageKey): Promise<AdminSitePage>;
  /**
   * Saves a Site page's SEO title and description and its share image: the
   * page's own, a finished "site-page-share-image" upload's path, or none for
   * the site's. The same rules as updateExamSeo: a whole title over 60
   * characters with the site name, a description over 160, or a share image
   * that's neither is refused; an upload whose file hasn't arrived is told
   * "Wait for uploads to finish."
   */
  updateSitePageSeo(
    actor: StaffActor,
    page: SitePageKey,
    input: ExamSeoForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminSitePage>>;

  // About's text and photos (any Staff User; ticket 21; spec, Phase 2 → Site
  // pages): six sections, each saved on its own with its own stamp, over
  // today's text in src/content/about.ts. Blank saves as none, which shows
  // today's text again. Each write appends one Staff Activity record with the
  // section before and after, and clears only the site-pages tag; a photo it
  // replaced is deleted from Storage once it commits.

  /** About's saved text and photos, every field null until it's saved, and each section's stamp. */
  getAboutForAdmin(actor: StaffActor): Promise<AdminAbout>;
  /**
   * Saves one About section. Text over its limit (about 1.5× today's), a spec
   * chip over 20 characters, a fourth paragraph or a sixth chip is refused.
   * Each photo is today's (""), the one it has, or a finished "about-photo"
   * upload's path, with alt text of 1–150 characters; any other is refused,
   * and an upload whose file hasn't arrived is told "Wait for uploads to
   * finish."
   */
  updateAboutSection(
    actor: StaffActor,
    input: AboutSectionForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminAbout>>;

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

  // Plans & prices (Owners only; Phase 4, ticket 01; stories 145, 146, 151p,
  // 151q and 151r): what the Member App sells. Each Plan has an Exam, a name,
  // 30, 90, 180 or 365 days, a price in whole pesos (₱1–₱99,999), Best value
  // and On sale. At most one Best value per Exam (saving one clears the
  // others, in the same write) and one on sale per Exam and duration. Every
  // read and write refuses an Editor. Each write appends one Staff Activity
  // record per Plan it changed; nothing here touches an Access Pass or the
  // Website, so no tag is cleared.

  /** Every Plan, by Exam, duration and name, with the catalogue's Exams. */
  listPlansForAdmin(actor: StaffActor): Promise<AdminResult<AdminPlans>>;
  /** "Add plan": a new Plan. Refused for an Exam not in the catalogue, or a second on sale. */
  createPlan(actor: StaffActor, input: PlanForm): Promise<AdminResult<AdminPlan>>;
  /** "Save": a Plan's fields, against its stamp when the editor opened (the conflict check). */
  updatePlan(
    actor: StaffActor,
    id: string,
    input: PlanForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminPlan>>;
  /**
   * The On sale switch: always saves, with no conflict check, but moves the
   * Plan's stamp on, so an editor opened before it conflicts rather than
   * switching it back. Off hides the Plan from Members; Access Passes stay.
   */
  setPlanOnSale(actor: StaffActor, id: string, onSale: boolean): Promise<AdminResult<AdminPlan>>;
  /** Deletes a Plan that has never had an Order; one that has is refused (switch it off instead). */
  deletePlan(actor: StaffActor, id: string): Promise<AdminResult<Plan>>;

  // Orders & payments (Owners only; Phase 4, ticket 07; stories 147, 148,
  // 151o and 151z): every Order, its detail, and the CSV for the accountant.
  // Every read and write refuses an Editor. An Order's status reads as every
  // screen shows it (a Pending Order past its 24 hours is Expired). Nothing
  // here touches the Website, so no tag is cleared. Refunds are issued from
  // the PayMongo dashboard, never here.

  /**
   * The Orders list: the Orders the search (part of a reference or an email)
   * and filters (status, Payment Method, a range of Manila days, Test Orders
   * only when included) match, newest first, with the tiles: the Paid ones'
   * amounts, and the Orders, Pending and Failed.
   */
  listOrdersForAdmin(
    actor: StaffActor,
    query: OrderListQuery,
  ): Promise<AdminResult<AdminOrderList>>;
  /**
   * One Order's detail page: the Order, its buyer's User id while their Member
   * record is there, and its internal note with its stamp. A reference no
   * Order has, or that isn't a reference, is not-found.
   */
  getOrderForAdmin(actor: StaffActor, reference: string): Promise<AdminResult<AdminOrderDetail>>;
  /**
   * "Save note": an Order's internal note, which only Staff see, trimmed (a
   * blank one clears it), at most 2,000 characters, with the conflict check
   * against the stamp the page opened with. Appends Staff Activity.
   */
  saveOrderNote(
    actor: StaffActor,
    input: OrderNoteInput,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminOrderNote>>;
  /**
   * "Check status with PayMongo": the status-check backup's own check, with
   * `client`, on an Order recorded Pending (one past its 24 hours too); Paid
   * or Failed lands through the Order ledger, as the webhook's would. Any
   * other Order is answered "not-pending", asking nothing. Refused when the
   * server has no payments client.
   */
  checkOrderWithPayMongo(
    actor: StaffActor,
    reference: string,
    client: PaymentsClient | null,
  ): Promise<AdminResult<OrderStatusCheck>>;
  /**
   * "Mark invoice sent" (ticket 08): records that the official invoice an
   * Order's Invoice Request asked for was sent from the support inbox, when
   * and by whom, with Staff Activity. A request already marked sent is given
   * back as it is, changing and logging nothing. Refused for an Order with
   * no request. No email is sent.
   */
  markInvoiceSent(actor: StaffActor, reference: string): Promise<AdminResult<InvoiceRequest>>;
  /**
   * The CSV export: exactly the Orders the list's query matches, in its
   * order, with a header row always, and each Order's Invoice Request;
   * logged in Staff Activity.
   */
  exportOrdersCsv(actor: StaffActor, query: OrderListQuery): Promise<AdminResult<OrdersCsv>>;

  // Staff Activity (Owners only; Phase 4, ticket 15; spec, Phase 4 → Orders
  // Admin): the permanent record of every Admin write and of PayMongo's
  // outcomes ("PayMongo (system)"). Read-only: the seam has no way to change
  // or delete a record, and reading records nothing. Refuses an Editor, since
  // the values can hold personal data.

  /**
   * One page of the records the filters match (who made them, by the email
   * recorded; the area), newest first, 50 to a page, older pages by the
   * cursor (the last record's seq), so records added meanwhile are never
   * repeated or skipped; with every actor and entity recorded, for the filters.
   */
  listStaffActivity(
    actor: StaffActor,
    query: StaffActivityQuery,
  ): Promise<AdminResult<StaffActivityList>>;

  // The Course builder (Phase 5, ticket 01; spec, Phase 5 planning decisions
  // → A Course, The Course builder; stories 156, 174, 175, 177, 179): any
  // Staff User makes video Courses, their Modules and their Lessons. Each
  // write appends Staff Activity for the entity it changes ("course",
  // "course-module", "lesson"); edits run the conflict check, and ▲▼,
  // toggles and deletes always save. Nothing here writes how Members get a
  // Course, its price or On sale (an Owner's, from ticket 06). None returns
  // a cache tag, since nothing cached reads Courses yet.
  // src/services/course-editor.core.ts has the rules.

  /** "COURSES · N": each Course, oldest first, with its Lesson count, and the Exams a new one can take. */
  listCoursesForAdmin(actor: StaffActor): Promise<AdminCourseList>;
  /** One Course with its Modules and Lessons in order, or null when it isn't there. */
  getCourseForAdmin(actor: StaffActor, id: string): Promise<AdminCourse | null>;
  /**
   * "+ New course": Hidden, Included in its Exam's All-Access, with no price.
   * The Subject must be one of the Exam's; a cover is a finished
   * "course-cover" upload.
   */
  createCourse(actor: StaffActor, input: NewCourseForm): Promise<AdminResult<AdminCourseSummary>>;
  /** Course settings' "Save". Moving to another Exam needs one of that Exam's Subjects. */
  updateCourse(
    actor: StaffActor,
    input: CourseForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminCourseSummary>>;
  /** "Course visible to members": Visible is refused without a Published Lesson. */
  setCourseVisibility(
    actor: StaffActor,
    id: string,
    visible: boolean,
  ): Promise<AdminResult<{ visibility: ContentVisibility }>>;
  /**
   * "How members get it" (Owners only; Phase 5, ticket 06): Included in its
   * Exam's All-Access, or Sold separately, at once; it's off sale after,
   * every Course Ownership and all progress kept. Refused for an Editor.
   */
  setCourseAccess(
    actor: StaffActor,
    input: { id: string; access: Course["access"] },
  ): Promise<AdminResult<Course>>;
  /** Plans & prices → One-time purchases (Owners only; ticket 06): every separately sold Course. */
  listOneTimePurchases(actor: StaffActor): Promise<AdminResult<OneTimePurchase[]>>;
  /** A separately sold Course's price, in whole pesos as a Plan's (Owners only; ticket 06). */
  setCoursePrice(
    actor: StaffActor,
    input: { id: string; price: string | number },
  ): Promise<AdminResult<OneTimePurchase>>;
  /** A separately sold Course's On sale: on only with a price (Owners only; ticket 06). */
  setCourseOnSale(
    actor: StaffActor,
    input: { id: string; onSale: boolean },
  ): Promise<AdminResult<OneTimePurchase>>;
  /**
   * Deletes a Course with its Modules and Lessons, then their videos at the
   * video service (a delete it refuses is logged in Staff Activity, never
   * blocking). Refused while anyone owns it or any Order names it (ticket
   * 06): it can be hidden instead.
   */
  deleteCourse(
    actor: StaffActor,
    id: string,
    video: VideoService | null,
  ): Promise<AdminResult<Course>>;
  /** "+ Module": last in its Course. */
  createCourseModule(
    actor: StaffActor,
    input: NewCourseModuleForm,
  ): Promise<AdminResult<AdminCourseModule>>;
  /** A Module's title, edited in place. */
  renameCourseModule(
    actor: StaffActor,
    input: CourseModuleForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<{ id: string; title: string; stamp: RecordStamp }>>;
  /** ▲▼ on a Module: gives the Course's new order of Module ids. */
  moveCourseModule(
    actor: StaffActor,
    id: string,
    direction: ReviewMove,
  ): Promise<AdminResult<string[]>>;
  /** Deletes an empty Module; one with Lessons is refused until they're moved or deleted. */
  deleteCourseModule(actor: StaffActor, id: string): Promise<AdminResult<CourseModule>>;
  /** "+ Lesson": last in its Module, with no video and not Free Preview. */
  createLesson(actor: StaffActor, input: NewLessonForm): Promise<AdminResult<AdminLesson>>;
  /** The Lesson editor's "Save": title, notes and Free Preview. */
  updateLesson(
    actor: StaffActor,
    input: LessonForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminLesson>>;
  /** ▲▼ on a Lesson, within its Module: gives the Module's new order of Lesson ids. */
  moveLesson(actor: StaffActor, id: string, direction: ReviewMove): Promise<AdminResult<string[]>>;
  /** "Move to Module…": last in another Module of its Course; gives that Module's order. */
  moveLessonToModule(actor: StaffActor, input: LessonToModuleInput): Promise<AdminResult<string[]>>;
  /**
   * Publish or Unpublish: publishing needs a title and a ready video ("ADD A
   * VIDEO BEFORE PUBLISHING"); unpublishing a Visible Course's last Published
   * Lesson is refused ("Hide the course first").
   */
  setLessonPublished(
    actor: StaffActor,
    id: string,
    published: boolean,
  ): Promise<AdminResult<AdminLesson>>;
  /**
   * Deletes a Lesson (after typing DELETE in the builder), then its videos at
   * the video service (a delete it refuses is logged, never blocking).
   */
  deleteLesson(
    actor: StaffActor,
    id: string,
    video: VideoService | null,
  ): Promise<AdminResult<Lesson>>;

  // Lesson videos (Phase 5, ticket 02; spec, Phase 5 planning decisions →
  // Uploads, Access and playback): each is given this server's video service
  // (video.ts), or null when it isn't connected.

  /**
   * "Upload video" or "Replace video": checks the file (an MP4 or MOV of up
   * to 4 GB), asks the service for one-time upload permission for a Lesson
   * that's there, and records the new video on it (uploading; or, beside a
   * ready video, as its replacement) before the browser sends the file.
   * Refused with no service ("CONNECT THE VIDEO SERVICE TO UPLOAD").
   */
  startLessonUpload(
    actor: StaffActor,
    input: LessonUploadInput,
    video: VideoService | null,
  ): Promise<AdminResult<AdminLessonUpload>>;
  /** The browser's word on an upload: sent (processing) or failed ("Upload failed · Try again"). */
  finishLessonUpload(
    actor: StaffActor,
    input: LessonUploadOutcomeInput,
  ): Promise<AdminResult<AdminLessonUpload["lesson"]>>;
  /**
   * The editor's status poll: asks the service about the Lesson's video in
   * flight and makes it ready (a draft with its length; a replacement takes
   * over and the old video is deleted) or failed. Nothing in flight: the
   * Lesson as it is.
   */
  checkLessonVideo(
    actor: StaffActor,
    id: string,
    video: VideoService | null,
  ): Promise<AdminResult<AdminLessonUpload["lesson"]>>;
  /** The Lesson editor's preview: a playback pass watermarked with the Staff member's email, no device check. */
  previewLessonVideo(
    actor: StaffActor,
    id: string,
    video: VideoService | null,
  ): Promise<AdminResult<AdminLessonPreview>>;
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
export const listBetaTesters = impl.listBetaTesters;
export const addBetaTester = impl.addBetaTester;
export const removeBetaTester = impl.removeBetaTester;
export const listUsers = impl.listUsers;
export const getMemberForAdmin = impl.getMemberForAdmin;
export const forceSignOut = impl.forceSignOut;
export const grantAccess = impl.grantAccess;
export const extendAccess = impl.extendAccess;
export const endAccess = impl.endAccess;
export const giveCourse = impl.giveCourse;
export const removeCourse = impl.removeCourse;
export const listPrivacyRequests = impl.listPrivacyRequests;
export const getPrivacyRequestForAdmin = impl.getPrivacyRequestForAdmin;
export const exportMemberData = impl.exportMemberData;
export const deleteMemberAccount = impl.deleteMemberAccount;
export const markPrivacyRequestDone = impl.markPrivacyRequestDone;
export const getOverview = impl.getOverview;
export const getPaidToday = impl.getPaidToday;
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
export const createExam = impl.createExam;
export const addSubject = impl.addSubject;
export const deleteSubject = impl.deleteSubject;
export const deleteExam = impl.deleteExam;
export const listTopicsForAdmin = impl.listTopicsForAdmin;
export const createTopic = impl.createTopic;
export const renameTopic = impl.renameTopic;
export const moveTopic = impl.moveTopic;
export const deleteTopic = impl.deleteTopic;
export const planCardImport = impl.planCardImport;
export const confirmCardImport = impl.confirmCardImport;
export const planQuizImport = impl.planQuizImport;
export const confirmQuizImport = impl.confirmQuizImport;
export const getDeckForAdmin = impl.getDeckForAdmin;
export const getCardImageForAdmin = impl.getCardImageForAdmin;
export const createCard = impl.createCard;
export const updateCard = impl.updateCard;
export const moveCard = impl.moveCard;
export const deleteCard = impl.deleteCard;
export const setDeckVisibility = impl.setDeckVisibility;
export const setDeckFreePreview = impl.setDeckFreePreview;
export const getQuizForAdmin = impl.getQuizForAdmin;
export const getQuestionFigureForAdmin = impl.getQuestionFigureForAdmin;
export const updateQuizSettings = impl.updateQuizSettings;
export const setQuizVisibility = impl.setQuizVisibility;
export const setQuizFreePreview = impl.setQuizFreePreview;
export const createQuestion = impl.createQuestion;
export const updateQuestion = impl.updateQuestion;
export const moveQuestion = impl.moveQuestion;
export const deleteQuestion = impl.deleteQuestion;
export const listReviewerPdfsForAdmin = impl.listReviewerPdfsForAdmin;
export const recordReviewerPdf = impl.recordReviewerPdf;
export const deleteReviewerPdf = impl.deleteReviewerPdf;
export const runReviewerPdfJob = impl.runReviewerPdfJob;
export const restartStaleReviewerPdfJobs = impl.restartStaleReviewerPdfJobs;
export const getReviewerPdfForAdmin = impl.getReviewerPdfForAdmin;
export const getReviewerPdfPageForAdmin = impl.getReviewerPdfPageForAdmin;
export const placeReviewerPdf = impl.placeReviewerPdf;
export const setReviewerPdfPublished = impl.setReviewerPdfPublished;
export const setReviewerPdfFreePreview = impl.setReviewerPdfFreePreview;
export const getSitePageForAdmin = impl.getSitePageForAdmin;
export const updateSitePageSeo = impl.updateSitePageSeo;
export const getAboutForAdmin = impl.getAboutForAdmin;
export const updateAboutSection = impl.updateAboutSection;
export const getPromoForAdmin = impl.getPromoForAdmin;
export const updatePromoBanner = impl.updatePromoBanner;
export const setPromoBannerVisible = impl.setPromoBannerVisible;
export const getAnnouncementForAdmin = impl.getAnnouncementForAdmin;
export const updateAnnouncement = impl.updateAnnouncement;
export const listPlansForAdmin = impl.listPlansForAdmin;
export const createPlan = impl.createPlan;
export const updatePlan = impl.updatePlan;
export const setPlanOnSale = impl.setPlanOnSale;
export const deletePlan = impl.deletePlan;
export const listOrdersForAdmin = impl.listOrdersForAdmin;
export const getOrderForAdmin = impl.getOrderForAdmin;
export const saveOrderNote = impl.saveOrderNote;
export const checkOrderWithPayMongo = impl.checkOrderWithPayMongo;
export const markInvoiceSent = impl.markInvoiceSent;
export const exportOrdersCsv = impl.exportOrdersCsv;
export const listStaffActivity = impl.listStaffActivity;
export const listCoursesForAdmin = impl.listCoursesForAdmin;
export const getCourseForAdmin = impl.getCourseForAdmin;
export const createCourse = impl.createCourse;
export const updateCourse = impl.updateCourse;
export const setCourseVisibility = impl.setCourseVisibility;
export const setCourseAccess = impl.setCourseAccess;
export const listOneTimePurchases = impl.listOneTimePurchases;
export const setCoursePrice = impl.setCoursePrice;
export const setCourseOnSale = impl.setCourseOnSale;
export const deleteCourse = impl.deleteCourse;
export const createCourseModule = impl.createCourseModule;
export const renameCourseModule = impl.renameCourseModule;
export const moveCourseModule = impl.moveCourseModule;
export const deleteCourseModule = impl.deleteCourseModule;
export const createLesson = impl.createLesson;
export const updateLesson = impl.updateLesson;
export const moveLesson = impl.moveLesson;
export const moveLessonToModule = impl.moveLessonToModule;
export const setLessonPublished = impl.setLessonPublished;
export const deleteLesson = impl.deleteLesson;
export const startLessonUpload = impl.startLessonUpload;
export const finishLessonUpload = impl.finishLessonUpload;
export const checkLessonVideo = impl.checkLessonVideo;
export const previewLessonVideo = impl.previewLessonVideo;
