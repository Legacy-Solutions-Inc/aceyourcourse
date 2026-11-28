// The Admin seam's types (CONVENTIONS §3). Every Admin read and write goes
// through src/services/admin.ts; these are its inputs and outputs.

import type {
  BusinessDetails,
  AboutContent,
  AboutSectionKey,
  Exam,
  ExamPage,
  Faq,
  FaqGroup,
  Marketplace,
  Product,
  ProductFormat,
  ProductPhoto,
  ProductState,
  PromoBanner,
  Review,
  ShopStats,
  SitePage,
  SocialLinks,
  WebsiteSettings,
} from "@/services/catalogue.types";
import type { ImportCounts, ImportProblem } from "@/lib/content-import/plan";
import type { ImportMode } from "@/lib/content-import/modes";
import type { CardImageType } from "@/lib/cards/card-rules";
import type { QuizChoice } from "@/lib/quizzes/quiz-rules";
import type { PlanDays } from "@/lib/plans/plan-rules";
import type { InvoiceRequest } from "@/lib/payments/invoice-requests";
import type { OrderRefund } from "@/lib/payments/refunds";
import type { Order, OrderStatus } from "@/lib/payments/order-ledger";
import type { SalesFigures } from "@/lib/payments/sales-figures";
import type { PaymentMethod } from "@/lib/payments/payment-methods";
import type { MemberDataExport } from "@/lib/member-app/data-export";
import type { MemberProgress } from "@/lib/member-app/progress";
import type {
  AccessPass,
  AccessPassGrant,
  Card,
  ContentCounts,
  ContentVisibility,
  Question,
  ReviewerPdfStatus,
  ReviewerPdfUpload,
  TopicContent,
} from "@/services/content.types";
import type { PlaybackPass, UploadTarget } from "@/services/video.types";
import type { Course, Lesson } from "@/services/courses.types";
import type {
  ActiveDevice,
  ConsentRecord,
  DeviceSwitch,
  Member,
  PrivacyRequest,
  TargetExam,
} from "@/services/member.types";

export type StaffRole = "owner" | "editor";

/** The signed-in Staff User a write acts as, from the Staff Guard. */
export type StaffActor = { email: string; name: string; role: StaffRole };

export type AdminError =
  | { kind: "invalid"; fieldErrors: Record<string, string[]>; formError?: string }
  | { kind: "conflict"; savedBy: string | null; savedAt: string }
  | { kind: "not-found" }
  | { kind: "forbidden"; message: string };

/** What every Admin write returns: the value and the cache tags to clear, or an error. */
export type AdminResult<T> =
  { ok: true; value: T; tags: string[] } | { ok: false; error: AdminError };

/** Who may make a write: any Staff User, or Owners only. */
export type RequiredRole = "staff" | "owner";

/**
 * When an editable record was last saved, and by whom. Editors hold `savedAt`
 * from when they opened, for the conflict check. `savedBy` is null for a record
 * nobody has saved in the Admin yet.
 */
export interface RecordStamp {
  /** ISO time of the last save. */
  savedAt: string;
  savedBy: string | null;
}

// ── Staff, Invites and sign-in ──────────────────────────────────────────────

/** An active place on the staff list. Emails are stored lowercase. */
export interface StaffMember {
  email: string;
  name: string;
  role: StaffRole;
  /** ISO time the User joined the staff list. */
  addedAt: string;
  /** ISO time of the last sign-in, or null when never recorded. */
  lastSignedInAt: string | null;
}

/** A pending place on the staff list. It expires 7 days after it was made or last renewed. */
export interface Invite {
  email: string;
  role: StaffRole;
  /** ISO time the Invite was made or last renewed. */
  createdAt: string;
  /** ISO time the Invite stops working. */
  expiresAt: string;
}

/** Who can use the Admin, as an Owner manages it in Settings. */
export interface StaffList {
  staff: StaffMember[];
  invites: Invite[];
}

/**
 * A Beta Tester (CONTEXT.md): a Google email an Owner lets into the Member App
 * while its switch is off. No expiry and no role. Emails are stored lowercase.
 */
export interface BetaTester {
  email: string;
  /** ISO time an Owner added them. */
  addedAt: string;
  /** The Owner who added them, kept as they were then. */
  addedBy: { email: string; name: string };
}

/** Why a signed-in User was refused the Admin. */
export type DeniedReason = "not-staff" | "invite-expired";

/** Why the 403 screen shows: a refused User, or an Editor on an Owner-only screen. */
export type DeniedScreenReason = DeniedReason | "owners-only";

/** One recorded refused sign-in. */
export interface DeniedSignIn {
  id: string;
  email: string;
  reason: DeniedReason;
  /** ISO time of the attempt. */
  at: string;
}

/** The permanent record of one change made in the Admin. */
export interface StaffActivity {
  id: string;
  /** ISO time of the change. */
  at: string;
  actor: { email: string; name: string };
  entity: string;
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
}

/** A Staff Activity record with its place in the log: a later record always has a higher `seq`. */
export interface StaffActivityEntry extends StaffActivity {
  seq: number;
}

/** Who appears in Staff Activity: each email once, with the name its latest record gives. */
export interface StaffActivityActor {
  email: string;
  name: string;
}

/** The Staff Activity list's filters and cursor, as its URL holds them (ticket 15). */
export interface StaffActivityQuery {
  /** Only this actor's records, by the email recorded, or everyone's. */
  actor: string | null;
  /** Only this area's records (src/lib/admin/staff-activity-view.ts), or every area's. */
  area: string | null;
  /** The cursor: only records older than this `seq`, or the newest. */
  before: number | null;
}

/**
 * The Staff Activity list for Owners (Phase 4, ticket 15): one page of the
 * records the filters match, newest first; the cursor of the next (older)
 * page, or null on the last; and every actor and entity ever recorded, for
 * the filters.
 */
export interface StaffActivityList {
  query: StaffActivityQuery;
  entries: StaffActivityEntry[];
  next: number | null;
  actors: StaffActivityActor[];
  entities: string[];
}

/** Who is signing in: their verified email, and their name when the sign-in gives one. */
export interface SignInIdentity {
  email: string;
  name: string | null;
}

/** The staff list's answer to a sign-in. */
export type SignInResolution =
  { status: "staff"; actor: StaffActor } | { status: "denied"; reason: DeniedReason };

// ── Settings ────────────────────────────────────────────────────────────────

/**
 * What an Owner edits in Settings. The announcement and the promo banner are
 * Website settings too, but they're edited on their own screen.
 */
export interface EditableWebsiteSettings {
  contactEmail: string;
  shopLinks: WebsiteSettings["shopLinks"];
  socialLinks: SocialLinks;
  shopStats: ShopStats;
  /** The seller on Payment Acknowledgements (Phase 4, ticket 06). */
  business: BusinessDetails;
}

/** Settings as the Admin reads them: the values, and when and by whom they were last saved. */
export interface AdminWebsiteSettings {
  values: EditableWebsiteSettings;
  stamp: RecordStamp;
}

// ── Products ────────────────────────────────────────────────────────────────

/**
 * Where a Product's store button for one Marketplace goes, as the Products
 * list's S/L/T badges show it: its own Listing ("product", green), that
 * Marketplace's shop page from Settings ("shop", amber), or nowhere, so the
 * Website hides the button ("none"). A Coming Soon Product has no store
 * buttons, so every Marketplace is "none".
 */
export type StoreLinkStatus = "product" | "shop" | "none";

/** One row of the Products list. */
export interface AdminProductRow {
  id: string;
  slug: string;
  title: string;
  shortName: string;
  examCode: string;
  format: ProductFormat;
  state: ProductState;
  /** Centavos. Null only for Coming Soon. */
  priceFrom: number | null;
  /** Centavos. Set when the Product is priced as a range. */
  priceTo: number | null;
  /** From the Shopee figures; null when it has none (Coming Soon). */
  unitsSold: number | null;
  /** The first photo, or null when it has none. */
  cover: ProductPhoto | null;
  storeLinks: Record<Marketplace, StoreLinkStatus>;
  showOnWebsite: boolean;
  availableInApp: boolean;
  stamp: RecordStamp;
}

/** The Products list's filters, as its URL gives them. Each one is optional. */
export interface ProductListQuery {
  /** Matched case-insensitively against the title and the short name. */
  q?: string;
  /** An Exam code, in any case. An unknown one is ignored. */
  exam?: string;
  /** Live Products with at least one Marketplace on its shop page. */
  missing?: boolean;
}

/** The Products list: the rows that match, and the filters as they were applied. */
export interface AdminProductList {
  /** Live Products by units sold, then by title; then Coming Soon, by title. */
  rows: AdminProductRow[];
  /** The filters applied: the search trimmed, an unknown Exam dropped. */
  query: { q: string | null; exam: string | null; missing: boolean };
  /** Every Exam code, in the catalogue's order, for the Exam chips. */
  examCodes: string[];
  /** How many Products the catalogue has, whatever the filters. */
  total: number;
}

/**
 * One Product as its editor opens it: every field the catalogue holds, its
 * stamp for the conflict check, and how many Reviews it has, since a Product
 * with Reviews can't be Coming Soon.
 */
export interface AdminProduct {
  product: Product;
  stamp: RecordStamp;
  reviewCount: number;
}

/** What goes with a Product when it's deleted, as the typed-DELETE dialog counts it. */
export interface ProductDeletePreview {
  reviews: number;
  photos: number;
  /** FAQ quotes taken from its Reviews, which are removed from their FAQs. */
  faqQuotes: number;
}

/** A deleted Product: what its delete removed. */
export interface DeletedProduct extends ProductDeletePreview {
  id: string;
  slug: string;
}

// ── Reviews ─────────────────────────────────────────────────────────────────

/** The Reviews list's star chips: 5★, 4★, or "3★ and below". */
export type ReviewStarsFilter = "5" | "4" | "3-or-less";

/** The Reviews list's filters, as its URL gives them. Each one is optional. */
export interface ReviewListQuery {
  /** Matched case-insensitively against the Review's text. */
  q?: string;
  /** An Exam code, in any case. An unknown one is ignored. */
  exam?: string;
  stars?: ReviewStarsFilter;
  /** "Pinned on Home only": the pinned Reviews, in the Home order. */
  pinned?: boolean;
}

/** One row of the Reviews list: the Review, and the Product it's for. */
export interface AdminReviewRow {
  review: Review;
  product: { shortName: string; examCode: string };
}

/** A Live Product a Review can be for, as the editor's PRODUCT select lists it. */
export interface ReviewProductOption {
  id: string;
  slug: string;
  examCode: string;
  shortName: string;
  /** Its variations as a buyer sees them ("MSTC ONLY"), for VARIATION BOUGHT. */
  variations: string[];
}

/** The Reviews list: the rows that match, the filters as applied, and the counters. */
export interface AdminReviewList {
  /** In the catalogue's order; with "Pinned on Home only", in the Home order. */
  rows: AdminReviewRow[];
  /** The filters applied: the search trimmed, an unknown Exam dropped. */
  query: {
    q: string | null;
    exam: string | null;
    stars: ReviewStarsFilter | null;
    pinned: boolean;
  };
  /** Every Exam code, in the catalogue's order, for the Exam chips. */
  examCodes: string[];
  /** How many Reviews the catalogue has, whatever the filters. */
  total: number;
  /** The Home order, first to last, whatever the filters, for ▲▼. */
  homeOrder: string[];
  /**
   * How many pinned Reviews Home can show, their Products shown on the
   * website: "N OF 9 PINNED ON HOME". Home shows the first 9 of them.
   */
  pinnedOnHome: number;
  /** The Live Products, in the catalogue's order, for the editor. */
  products: ReviewProductOption[];
}

/** One Review as its editor opens it, with its stamp for the conflict check. */
export interface AdminReview {
  review: Review;
  stamp: RecordStamp;
}

/** What goes with a Review when it's deleted. */
export interface ReviewDeletePreview {
  /** FAQ quotes taken from it, which are removed from their FAQs. */
  faqQuotes: number;
}

/** A deleted Review: what its delete removed. */
export interface DeletedReview extends ReviewDeletePreview {
  id: string;
}

// ── FAQs ────────────────────────────────────────────────────────────────────

/** The FAQS tab's selection, as its URL gives it. Each one is optional. */
export interface FaqListQuery {
  /** One of the 5 groups. Any other falls back to the first. */
  group?: string;
  /** Matched case-insensitively against every group's questions and answers. */
  q?: string;
}

/** One of the 5 fixed groups, with how many FAQs it has, hidden ones included. */
export interface FaqGroupCount {
  group: FaqGroup;
  title: string;
  count: number;
}

/** A Review an FAQ can quote: one shown on the Website, with its Product. */
export interface FaqReviewOption {
  id: string;
  stars: Review["stars"];
  text: string;
  product: { shortName: string; examCode: string };
}

/** The FAQS tab: the groups, the FAQs that match, and the editor's choices. */
export interface AdminFaqList {
  /** The 5 groups, in the FAQ page's order. */
  groups: FaqGroupCount[];
  /** The selection applied: the group checked, the search trimmed. */
  query: { group: FaqGroup; q: string | null };
  /**
   * The group's FAQs, in order; while searching, the matches in every group,
   * in the FAQ page's order. Hidden and app-only FAQs are included.
   */
  rows: Faq[];
  /** The Reviews a quote can come from, in the catalogue's order. */
  reviews: FaqReviewOption[];
  /** Every FAQ's deep-link slug, so a new FAQ's can be shown before it's added. */
  slugs: string[];
}

/** One FAQ as its editor opens it, with its stamp for the conflict check. */
export interface AdminFaq {
  faq: Faq;
  stamp: RecordStamp;
}

/** A deleted FAQ. */
export interface DeletedFaq {
  id: string;
}

// ── Exam pages ──────────────────────────────────────────────────────────────

/**
 * A part of an Exam page that its own editor saves, with its own stamp for
 * the conflict check. The section toggles always save, so theirs is never
 * checked.
 */
export type ExamPagePart =
  "header" | "subjects" | "sections" | "bundleOffer" | "seo" | "officialExamDate";

/** A Product a bundle offer can be of: one of the Exam's, Live or not, shown or not. */
export interface BundleProductOption {
  id: string;
  shortName: string;
  state: ProductState;
  showOnWebsite: boolean;
}

/** One Exam's page as its editors open it: the Exam, its page record, and each part's stamp. */
export interface AdminExamPage {
  exam: Exam;
  /** Its record, or the defaults while it has none. */
  page: ExamPage;
  stamps: Record<ExamPagePart, RecordStamp>;
  /**
   * The Exam's Products, in the catalogue's order, Live, Coming Soon or
   * hidden: for the bundle offer, and while there's any, why "Delete exam"
   * is refused.
   */
  products: BundleProductOption[];
  /** How many Products are tagged with each of the Exam's Subjects, for its remove button. */
  subjectProducts: Record<string, number>;
  /**
   * The Member App content each Subject's Topics hold, Hidden and Draft
   * included, for its remove button (Phase 3: content blocks a delete).
   */
  subjectContent: Record<string, ContentCounts>;
  /** The Member App content all the Exam's Topics hold, for "Delete exam". */
  content: ContentCounts;
  /** How many video Courses use each of the Exam's Subjects, Hidden ones too (Phase 5). */
  subjectCourses: Record<string, number>;
  /** How many video Courses belong to the Exam, for "Delete exam" (Phase 5). */
  courses: number;
  /**
   * The codes of the Exams the Website shows, those with a Product on it, for
   * the chips' "NOT ON SITE" (ticket 23).
   */
  examsOnWebsite: string[];
}

// ── Site pages ──────────────────────────────────────────────────────────────

/** The parts of a Site page that save on their own, each with its own stamp. */
export type SitePagePart = "seo";

/** One Site page as its editors open it: its record (or nothing set) and each part's stamp. */
export interface AdminSitePage {
  page: SitePage;
  stamps: Record<SitePagePart, RecordStamp>;
}

/**
 * About's text and photos as their editors open them (ticket 21): what's
 * saved, every field null until then, and each section's own stamp.
 */
export interface AdminAbout {
  about: AboutContent;
  stamps: Record<AboutSectionKey, RecordStamp>;
}

// ── Home promo banner and announcement bar ──────────────────────────────────

/** The Home promo banner as its editor opens it, with the stamp its Save checks. */
export interface AdminPromoBanner {
  /** null while the Website has none: the first Save makes it, turned off. */
  banner: PromoBanner | null;
  stamp: RecordStamp;
}

/** The announcement bar as its editor opens it, with the stamp its Save checks. */
export interface AdminAnnouncement {
  announcement: WebsiteSettings["announcement"];
  /** The Member App switch: while it's off, messages that need it don't show. */
  memberAppLive: boolean;
  stamp: RecordStamp;
}

// ── Overview ────────────────────────────────────────────────────────────────

/**
 * What the Overview works out what needs Staff from (src/lib/admin/needs-attention.ts):
 * every Product, hidden and Coming Soon ones included, the Exams and their
 * page records, and the settings it checks; and for an Owner, the sales.
 */
export interface AdminOverview {
  products: Product[];
  exams: Exam[];
  /** Only the Exams that have one; the others have the defaults. */
  examPages: ExamPage[];
  settings: OverviewSettings;
  /** Owners only (Phase 4, ticket 11): null for an Editor, whatever the page shows. */
  sales: SalesOverview | null;
}

/**
 * The Overview's sales for an Owner (Phase 4, ticket 11; stories 151, 151w
 * and 151x): the money (src/lib/payments/sales-figures.ts), the Member
 * figures, and the payment work waiting for Needs attention.
 */
export interface SalesOverview {
  figures: SalesFigures;
  /** Members with an active Access Pass, paid or granted; Staff left out. */
  activeMembers: number;
  /** Access Passes ending in the next 7 days; Staff's left out. */
  passesEndingSoon: number;
  payments: PaymentWork;
}

/** The sidebar's "PAID TODAY" card, for Owners only (ticket 11). */
export interface PaidToday {
  /** Today in Manila, YYYY-MM-DD. */
  date: string;
  /** Today's money so far, refunds made today taken off, in centavos. */
  netCentavos: number;
  /** The Orders paid today. */
  orders: number;
  /** The Pending payments not yet expired. */
  pending: number;
}

/** The Website's settings the Overview checks: the shop pages, the trust figures and the promo banner. */
export type OverviewSettings = Pick<WebsiteSettings, "shopLinks" | "shopStats" | "promoBanner">;

// ── Member App content: Topics (Phase 3, ticket 05) ─────────────────────────

/** One Topic in its Subject's Topics list, as the Admin shows it. */
export interface AdminTopic {
  id: string;
  name: string;
  /** Its place in its Subject's order, from 1. */
  position: number;
  /** What it holds, Hidden and Draft content too. */
  content: TopicContent;
  /** Why it can't be deleted (it isn't empty), or null when it can. */
  deleteBlocker: string | null;
  /** Its name's last save, which a rename's conflict check compares. */
  stamp: RecordStamp;
}

/** One Subject's Topics list: the Subject, its Exam, and its Topics in order. */
export interface AdminTopicList {
  exam: { code: string; board: string; name: string };
  subject: { code: string; name: string };
  topics: AdminTopic[];
}

// ── Member App content: spreadsheet imports (Phase 3, tickets 06 and 09) ────

/** What a card or quiz import does to one Topic the CSV names, as the preview shows it. */
export interface ImportTopicPreview {
  /** The existing Topic's name, or the new one's. */
  name: string;
  /** The existing Topic, or null for one the import creates. */
  topicId: string | null;
  /** For a new Topic: the existing Topic whose name is close to it ("did you rename it?"). */
  similarTo: string | null;
  /** Where the rows go: a new deck or quiz (made Hidden), or the Topic's own, Hidden or Visible. */
  content: "new" | ContentVisibility;
  /** Replace only when the Topic has cards or questions and the import replaces; otherwise its rows are added. */
  mode: ImportMode;
  counts: ImportCounts;
}

/** An import's preview: nothing is saved until Staff confirm one with no problems. */
export interface ImportPreview {
  exam: { code: string; name: string };
  subject: { code: string; name: string };
  mode: ImportMode;
  /** Each Topic the CSV names, in order of first appearance. */
  topics: ImportTopicPreview[];
  /** Every problem with the files; while there are any, the import can't be confirmed. */
  problems: ImportProblem[];
  /**
   * The Subject's Topics and what they hold as the preview read them.
   * Confirming sends it back, and is refused (a conflict) if they've changed
   * since.
   */
  basedOn: string;
}

/** What a confirmed import did to one Topic. */
export interface ImportTopicResult {
  topicId: string;
  /** The Topic's deck or quiz, which the import may have made. */
  contentId: string;
  name: string;
  /** Whether the import created the Topic. */
  created: boolean;
  counts: ImportCounts;
}

/** A confirmed import: each Topic it changed, in the preview's order. */
export interface ImportResult {
  topics: ImportTopicResult[];
}

// ── Member App content: the card editor (Phase 3, ticket 07) ────────────────

/** A card as the deck screen and its form show it. */
export interface AdminCard {
  id: string;
  /** Its place in its deck's order, from 1. */
  position: number;
  front: string;
  back: string;
  note: string | null;
  /** Where its back image is in the private content bucket, or null. Staff see it through the Admin's image route. */
  image: string | null;
  /** Its last save, which an edit's conflict check compares. */
  stamp: RecordStamp;
}

/** A Topic's deck as its settings show it: Visible or Hidden, and Free Preview. */
export interface AdminDeckSettings {
  id: string;
  visibility: ContentVisibility;
  freePreview: boolean;
}

/** A Topic's deck screen: where the Topic is, its deck (or null when it has none yet) and the cards in order. */
export interface AdminDeck {
  exam: { code: string; name: string };
  subject: { code: string; name: string };
  topic: { id: string; name: string; position: number };
  deck: AdminDeckSettings | null;
  cards: AdminCard[];
}

/** A deleted card, and whether deleting it made its Visible deck Hidden (it was the last card). */
export interface DeletedCard {
  card: Card;
  deckHidden: boolean;
}

/** A card's back image, as the Admin's image route sends it to Staff. */
export interface CardImageFile {
  contentType: CardImageType;
  bytes: Uint8Array;
}

// ── Member App content: quizzes (Phase 3, ticket 09) ────────────────────────

/** A question in a quiz, as the quiz screen shows it. */
export interface AdminQuestion {
  id: string;
  /** Its place in its quiz's order, from 1. */
  position: number;
  question: string;
  choices: Record<QuizChoice, string>;
  correct: QuizChoice;
  explanation: string;
  /** Where its figure is in the private content bucket, or null. Staff see it through the Admin's figure route. */
  figure: string | null;
  /** Its last save, which an edit's conflict check compares (ticket 10). */
  stamp: RecordStamp;
}

/**
 * A deleted question as it was, and whether deleting it made its Visible quiz
 * Hidden (it was the last question). The question itself is kept, marked
 * removed, for Members' old attempts (ticket 10).
 */
export interface DeletedQuestion {
  question: Question;
  quizHidden: boolean;
}

/**
 * A Reviewer PDF as the Admin's Reviewer PDFs screen lists it (ticket 12):
 * its status, its uploaded file and the job splitting it into page images,
 * and the Topic it's placed under.
 */
export interface AdminReviewerPdf {
  id: string;
  status: ReviewerPdfStatus;
  /** Its file and job, or null for the sample data's Reviewer PDFs, from before uploads. */
  upload: ReviewerPdfUpload | null;
  /** The Topic it's placed under, or null until an Editor places it (ticket 13). */
  placement: { examCode: string; subjectCode: string; topicName: string } | null;
}

/**
 * One Reviewer PDF as its screen shows it (ticket 13): as listed, with the
 * Topic it's placed under by id, whether it's Free Preview, and its
 * placement's last save, the stamp the placement form's conflict check reads.
 */
export interface AdminReviewerPdfDetail extends AdminReviewerPdf {
  topicId: string | null;
  freePreview: boolean;
  stamp: RecordStamp;
}

/** A Topic a Reviewer PDF can be placed under, with the one already there (one per Topic). */
export interface PlacementTopic {
  id: string;
  examCode: string;
  subjectCode: string;
  name: string;
  position: number;
  /** The Reviewer PDF placed under it, or null. */
  reviewerPdfId: string | null;
}

/** A Reviewer PDF's screen: the Reviewer PDF, and every Topic it can be placed under. */
export interface AdminReviewerPdfScreen {
  pdf: AdminReviewerPdfDetail;
  topics: PlacementTopic[];
}

/**
 * What one run of the Reviewer PDF job did: rendered its pages with more to
 * come ("more", so the next run starts), rendered the last page ("done", a
 * Draft now), failed it ("failed"), or found nothing for it to do
 * ("stopped": it's not Processing, it's gone, or another run has its pages).
 */
export type ReviewerPdfRun = "more" | "done" | "failed" | "stopped";

/** What the cron did with the Reviewer PDF jobs whose runs had stopped. */
export interface StaleReviewerPdfJobs {
  /** The ones it restarted: each needs a run started. */
  restarted: string[];
  /** The ones it failed, after too many restarts. */
  failed: string[];
}

/** A Topic's quiz as its settings show it. */
export interface AdminQuizSettings {
  id: string;
  visibility: ContentVisibility;
  freePreview: boolean;
  /** The passing score, a whole percentage from 1 to 100. */
  passingScore: number;
  shuffle: boolean;
  /** Whether Members see each missed question's answer and explanation after scoring. */
  showAnswers: boolean;
  /** The settings' last save, which the settings form's conflict check compares. */
  stamp: RecordStamp;
}

/** A Topic's quiz screen: where the Topic is, its quiz (or null when it has none) and its questions in order. */
export interface AdminQuiz {
  exam: { code: string; name: string };
  subject: { code: string; name: string };
  topic: { id: string; name: string; position: number };
  quiz: AdminQuizSettings | null;
  /** The questions in the quiz, in order; removed ones aren't shown. */
  questions: AdminQuestion[];
}

// ── Users (Owners only; Phase 3, ticket 16) ─────────────────────────────────

/**
 * The Users list's filters (story 129): everyone, an Access Pass active now,
 * passes that have all ended, no pass at all, active Staff, or Beta Testers.
 * Active, Expired and None never overlap.
 */
export const USER_FILTERS = ["all", "active", "expired", "none", "staff", "beta"] as const;

export type UserFilter = (typeof USER_FILTERS)[number];

/** The Users list's search, filter and page, as its URL holds them. */
export interface UserListQuery {
  /** Part of a name or an email, matched ignoring case; null for none. */
  q: string | null;
  filter: UserFilter;
  /** The page, from 1. */
  page: number;
}

/** A User's role in the list: a Member, or a Member who is also active Staff. */
export type UserRole = "member" | StaffRole;

/** One Member in the Users list. */
export interface AdminUserRow {
  userId: string;
  name: string | null;
  email: string;
  /** ISO time of their first pass through the Member App gate. */
  joinedAt: string;
  /** Their Target Exams' codes, in the order first added; removed ones aren't shown. */
  targetExams: string[];
  /** Their Access Passes, at most one per Exam, by Exam code. */
  accessPasses: Pick<AccessPass, "examCode" | "endsAt">[];
  /** Their Active Device, or null before their first claim or after a forced sign-out. */
  activeDevice: ActiveDevice | null;
  role: UserRole;
  betaTester: boolean;
}

/** One page of the Users list, newest Member first. */
export interface AdminUserList {
  /** The query as applied: a page past the last shows the last. */
  query: UserListQuery;
  rows: AdminUserRow[];
  /** The Members the search and filter match, on every page. */
  matching: number;
  /** Every Member. */
  total: number;
  /** How many pages the matching Members fill, at least 1. */
  pageCount: number;
}

/** One of a Member's Access Passes as an arm reads it, with every history row that made it, oldest first. */
export interface AccessPassRecord extends Pick<AccessPass, "examCode" | "endsAt"> {
  /** Grants, extensions and Paid Orders' days (orderId set), in the order added. */
  grants: Omit<AccessPassGrant, "userId" | "examCode">[];
}

/**
 * What "End access now" would do to a pass at the read (Phase 4, ticket 10;
 * story 151t): end it now, when it holds no paid days after its granted
 * ones ("End access now"); or end it on `endsAt`, the paid days kept ("End
 * granted access").
 */
export type PassEnding = { kind: "now" } | { kind: "keeps-paid"; endsAt: string };

/** One of a Member's Access Passes on their detail page. */
export interface AdminAccessPass extends AccessPassRecord {
  /** What ending its granted days would do now; null when there are none to end (it has ended, or only paid days are left). */
  ending: PassEnding | null;
}

/** A Member's progress in one of their Target Exams (ticket 15's calculator). */
export interface AdminExamProgress {
  examCode: string;
  progress: MemberProgress;
}

/** A Member's detail page (story 130), read fresh. */
export interface AdminMemberDetail {
  member: Member;
  role: UserRole;
  betaTester: boolean;
  /** Their Target Exams with their Exam Dates, in the order first added. */
  targetExams: TargetExam[];
  accessPasses: AdminAccessPass[];
  /** Their progress in each Target Exam, in the same order. */
  progress: AdminExamProgress[];
  activeDevice: ActiveDevice | null;
  /** Every Active Device claim, the first one too, newest first. */
  deviceSwitches: Omit<DeviceSwitch, "userId">[];
  /** Every agreement to the Terms and Privacy Policy, newest first. */
  consents: Omit<ConsentRecord, "userId">[];
  /** Every Order they made, newest first, each as the Orders list shows it (Phase 4, ticket 07). */
  orders: AdminOrder[];
}

/** What a forced sign-out did: the Active Device it cleared, and why. */
export interface ForcedSignOut {
  userId: string;
  signedOut: ActiveDevice;
  reason: string;
}

/**
 * One Privacy Request as the Owners' list shows it (ticket 18; story 133):
 * who asked, when it's due, and whether it's overdue now.
 */
export interface AdminPrivacyRequest extends Omit<PrivacyRequest, "userId"> {
  /** Still open after its due date, in Manila. */
  overdue: boolean;
  /** Who asked, or null once their account is deleted: the request stays, saying nothing of them. */
  member: Pick<Member, "userId" | "email" | "name"> | null;
  /** ISO time an Owner marked it done, or null while it's open (ticket 19). */
  doneAt: string | null;
  /** The Owner who marked it done, as they were then, or null while it's open. */
  doneBy: { email: string; name: string } | null;
}

/**
 * One Privacy Request's own screen (ticket 19; stories 133q and 133r): the
 * list's fields, and what carrying it out depends on now.
 */
export interface AdminPrivacyRequestDetail extends AdminPrivacyRequest {
  /**
   * Why "Delete this account" is refused now, or null when it isn't: the
   * Member's email is on the staff list (an active Staff User or an Invite),
   * or they're the last Owner, or they have a payment in progress (ticket 14).
   */
  deletionBlocked: string | null;
  /**
   * A deletion that removed the account's Member data but not yet its
   * Supabase User: deleting again finishes it. False once it's done.
   */
  deletionUnfinished: boolean;
  /** Whether the Member's email is on the Beta Tester list, where deleting the account leaves it. */
  betaTester: boolean;
  /**
   * The Member's Orders ever Paid (Refunded ones too), which deleting the
   * account keeps for tax records, without it (ticket 14); 0 with no Member.
   */
  paidOrders: number;
}

/** "Download this Member's data" (story 133q): the JSON file, and the name it downloads as. */
export interface MemberDataFile {
  filename: string;
  data: MemberDataExport;
}

/**
 * What a grant, an extension or "End access now" did to a Member's Access
 * Pass for an Exam (ticket 17; stories 131, 133h and 133j).
 */
export interface AccessPassChange {
  userId: string;
  examCode: string;
  /** ISO end before the change, or null when the Member held no pass for the Exam. */
  endsBefore: string | null;
  /** ISO end after it: for "End access now", the time it ended. */
  endsAt: string;
  /** The days it added, or null for "End access now". */
  days: number | null;
  reason: string;
  /**
   * What a grant did to the Member's Target Exams: added the Exam, brought
   * back one they removed, or nothing when it was theirs already. Always
   * null for an extension or an end.
   */
  targetExam: "added" | "restored" | null;
}

// ── Plans (Owners only; Phase 4, ticket 01) ─────────────────────────────────

/**
 * A Plan: what the Member App sells (CONTEXT.md, Plan): all of one Exam's
 * content (ADR 0010) for 30, 90, 180 or 365 days, at a price in centavos
 * (whole pesos). At most one per Exam is Best value, and at most one per Exam
 * and duration is On sale; one that's off is hidden from Members and leaves
 * every Access Pass as it is. A Plan never renews by itself.
 */
export interface Plan {
  id: string;
  examCode: string;
  name: string;
  days: PlanDays;
  priceCentavos: number;
  bestValue: boolean;
  onSale: boolean;
}

/** A Plan as the Admin opens it, with its stamp for the conflict check. */
export interface AdminPlan extends Plan {
  stamp: RecordStamp;
}

/** The Plans & prices screen: every Plan, by Exam, duration and name, and the Exams in order. */
export interface AdminPlans {
  plans: AdminPlan[];
  exams: Pick<Exam, "code" | "name">[];
}

// ── Orders & payments (Owners only; Phase 4, ticket 07) ─────────────────────

/** The Orders list's status chips: any, then each state as every screen shows it. */
export const ORDER_STATUS_FILTERS = [
  "any",
  "paid",
  "pending",
  "failed",
  "expired",
  "refunded",
] as const;
export type OrderStatusFilter = (typeof ORDER_STATUS_FILTERS)[number];

/** The Orders list's Payment Method filter: every method, or one of the four. */
export type OrderMethodFilter = "all" | PaymentMethod;

/** The Orders list's date range, on Manila days: the last 7, the last 30 (the default), or all time. */
export const ORDER_RANGES = ["7d", "30d", "all"] as const;
export type OrderRange = (typeof ORDER_RANGES)[number];

/** The Orders list's search and filters, as its URL holds them. */
export interface OrderListQuery {
  /** "Search by order number or email": part of a reference or of the buyer's email, or none. */
  q: string | null;
  status: OrderStatusFilter;
  method: OrderMethodFilter;
  range: OrderRange;
  /** "Include test orders": Test Orders are left out unless it's ticked. */
  tests: boolean;
  /** "Invoice requested" (ticket 08): only the Orders whose invoice was requested and not yet sent. */
  invoiceRequested: boolean;
  /** "Paid after expiry" (ticket 11): only the Orders PayMongo confirmed after they expired. */
  paidAfterExpiry: boolean;
  /** "Paid, account deleted" (ticket 14): only the Orders paid after their account was deleted. */
  paidWithoutAccount: boolean;
  /** "Course already owned" (Phase 5, ticket 06): only the Course Orders paid while it was owned. */
  paidAlreadyOwned: boolean;
}

/** An Order as the Admin shows it. */
export interface AdminOrder extends Order {
  /** Its status as every screen shows it: a Pending Order past its 24 hours reads Expired. */
  status: OrderStatus;
  /** The status recorded on it, which the status check reads. */
  recordedStatus: OrderStatus;
  paidAfterExpiry: boolean;
  /** Its Invoice Request (ticket 08), or null for none. */
  invoice: InvoiceRequest | null;
  /** Its succeeded PayMongo refunds, oldest first (ticket 09). */
  refunds: OrderRefund[];
  /** What PayMongo refunded of it, in centavos: less than its price on a Paid Order is a partial refund. */
  refundedCentavos: number;
}

/** The Orders list's tiles, for the Orders the filters match. */
export interface OrderStats {
  /** The Paid Orders' amounts, in centavos. */
  paidCentavos: number;
  orders: number;
  pending: number;
  failed: number;
}

/** The payment work waiting for an Owner, as the Overview's Needs attention lists it (ticket 11). */
export interface PaymentWork {
  /** The Pending payments not yet expired, and when the oldest of them was made (null for none). */
  pending: number;
  oldestPendingAt: string | null;
  /** The official invoices requested and not yet marked sent. */
  invoicesToSend: number;
  /** The Orders paid after expiry, made in the last 7 Manila days. */
  paidAfterExpiry: number;
  /** The Orders of any age paid after their account was deleted and still Paid, to refund in PayMongo (ticket 14). */
  paidAccountDeleted: number;
  /** The Course Orders of any age paid while the Course was owned and still Paid, to refund in PayMongo (Phase 5, ticket 06). */
  paidAlreadyOwned: number;
}

/** The Orders list: the Orders its filters match, newest first, and their tiles. */
export interface AdminOrderList {
  query: OrderListQuery;
  rows: AdminOrder[];
  stats: OrderStats;
}

/** An Order's internal note, which only Staff see, with its stamp for the conflict check. */
export interface AdminOrderNote {
  reference: string;
  /** The note's text; "" while it has none. */
  text: string;
  stamp: RecordStamp;
}

/** One Order's detail page. */
export interface AdminOrderDetail {
  order: AdminOrder;
  /**
   * The buyer's User id while their Member record is there, for the link to
   * their detail page; null once their account is deleted.
   */
  memberUserId: string | null;
  note: AdminOrderNote;
}

/**
 * What "Check status with PayMongo" found: still pending, Paid or Failed now
 * (applied through the Order ledger), PayMongo couldn't say, or the Order
 * isn't recorded Pending, so nothing was asked.
 */
export type OrderCheckOutcome = "still-pending" | "paid" | "failed" | "unknown" | "not-pending";

/** "Check status with PayMongo": what it found, and the Order as it is now. */
export interface OrderStatusCheck {
  outcome: OrderCheckOutcome;
  order: AdminOrder;
}

/** The Orders list's CSV export: the file's name and text, and how many Orders it holds. */
export interface OrdersCsv {
  filename: string;
  csv: string;
  rows: number;
}

// ── Courses (Phase 5, ticket 01) ────────────────────────────────────────────

/** An Exam a Course can belong to, with the Subjects it can pick from. */
export interface CourseExamChoice {
  code: string;
  name: string;
  subjects: { code: string; name: string }[];
}

/** One Course in the builder's list: "CE · 9 LESSONS", HIDDEN or VISIBLE. */
export interface AdminCourseSummary {
  id: string;
  title: string;
  examCode: string;
  subjectCode: string;
  lessons: number;
  visibility: ContentVisibility;
}

/** The Course builder's list ("COURSES · N"), oldest first, and the Exams a new Course can take. */
export interface AdminCourseList {
  courses: AdminCourseSummary[];
  exams: CourseExamChoice[];
}

/** A Lesson in the builder, with its last save and what deleting it takes from Members. */
export interface AdminLesson extends Lesson {
  stamp: RecordStamp;
  /** How many Members have progress saved in it (ticket 04): what deleting it loses. */
  savedPositions: number;
}

/**
 * Upload permission for a Lesson's video (ticket 02): the Lesson as it now is
 * (uploading, or still playing its ready video while the replacement
 * uploads), the new video's id, and where the browser sends the file.
 */
export interface AdminLessonUpload {
  lesson: AdminLesson;
  videoId: string;
  target: UploadTarget;
}

/** The Lesson editor's preview (ticket 02): a playback pass watermarked with the Staff member's email, and the length. */
export interface AdminLessonPreview {
  pass: PlaybackPass;
  seconds: number;
}

/** A Module in the builder, with its last save and its Lessons in order. */
export interface AdminCourseModule {
  id: string;
  position: number;
  title: string;
  stamp: RecordStamp;
  lessons: AdminLesson[];
}

/** One Course in the builder: its settings and last save, its Modules in order, and the Exams it can move to. */
export interface AdminCourse {
  course: Course;
  exam: { code: string; name: string };
  subject: { code: string; name: string };
  stamp: RecordStamp;
  modules: AdminCourseModule[];
  exams: CourseExamChoice[];
  /**
   * What switching how Members get it would do now (Phase 5, ticket 06), for
   * the confirmation: `losing`, the Members who watched it through an active
   * Access Pass for its Exam and don't own it (Included → Sold separately);
   * `gaining`, the Members with an active Access Pass for its Exam who don't
   * own it (Sold separately → Included). Counted for Owners only; zero for
   * an Editor, who can't switch it.
   */
  accessChange: CourseAccessChange;
  /** Why it can't be deleted: someone owns it, or an Order names it (ticket 06); null when it can. */
  deleteBlocked: "owned" | "ordered" | null;
}

/** How many Members a switch of how Members get a Course affects (ticket 06). */
export interface CourseAccessChange {
  losing: number;
  gaining: number;
}

/**
 * A separately sold Course, as Plans & prices → One-time purchases lists it
 * (Owners only; Phase 5, ticket 06): its price (null until an Owner sets
 * one) and On sale, and whether Members can see it.
 */
export interface OneTimePurchase {
  id: string;
  title: string;
  examCode: string;
  subjectCode: string;
  priceCentavos: number | null;
  onSale: boolean;
  visible: boolean;
}
