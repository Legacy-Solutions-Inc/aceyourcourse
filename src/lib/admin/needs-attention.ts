import { MARKETPLACES } from "@/content/website";
import { examPagesHref } from "@/lib/admin/exam-pages-view";
import { ordersHref, PAYMENT_WORK } from "@/lib/admin/orders-list";
import { hasMissingLinks, productListHref, storeLinkStatuses } from "@/lib/admin/product-list";
import { dayMonth, promoStatus } from "@/lib/admin/promo-status";
import { seoCheck } from "@/lib/admin/seo-check";
import { examPageSeo } from "@/lib/catalogue/exam-copy";
import { formatDate, manilaDate, manilaDayStart } from "@/lib/manila-time";
import { paths } from "@/paths";
import type { OverviewSettings, PaymentWork, StaffRole } from "@/services/admin.types";
import { examPageDefaults } from "@/services/catalogue.schema";
import type { Exam, ExamPage, Product } from "@/services/catalogue.types";

// The Overview's Needs attention list (spec, Phase 2 story 61; BUILD-MAP
// §3.1): what needs Staff today, each item linking to the screen that fixes
// it. Each item reuses the rule of the screen it links to, never a copy of it.
// The links item counts store buttons, not Products, as its copy says ("16
// product links use the shop page"), so adding one Listing lowers it even
// while that Product still shows under Missing product links. Days are whole
// Asia/Manila days.
//
// Phase 4, ticket 11 (story 151x) adds an Owner's payment work first: the
// Pending payments, the invoice requests to send, the Orders paid after
// expiry, and the payments that landed after an account was deleted (ticket
// 14 fills that one). The seam counts each with the Orders list's filters
// its link opens (PAYMENT_WORK), and gives an Editor none.

/** Which item: they're listed in this order. */
export type AttentionKind =
  | "payments-pending"
  | "invoices"
  | "paid-after-expiry"
  | "paid-account-deleted"
  | "missing-links"
  | "promo"
  | "search"
  | "hidden"
  | "trust-figures";

/** The row's square: amber for something to fix, blue for a check, grey for something off. */
export type AttentionTone = "warning" | "info" | "quiet";

export interface AttentionItem {
  kind: AttentionKind;
  title: string;
  detail: string;
  /** The link's label, "Add links", shown with "→". */
  action: string;
  href: string;
  tone: AttentionTone;
}

export interface NeedsAttentionInput {
  products: Product[];
  settings: OverviewSettings;
  exams: Exam[];
  /** The Exam pages' records; an Exam without one has the defaults. */
  examPages: ExamPage[];
  now: Date;
  /** Only Owners can update the trust figures, so only Owners are told about them. */
  role: StaffRole;
  /** An Owner's payment work (ticket 11); null for an Editor, whom the seam gives none. */
  payments: PaymentWork | null;
}

/** A banner ending within this many days (today counts as 0) is listed. */
const PROMO_ENDING_DAYS = 3;
/** Trust figures older than this many days are listed. */
const TRUST_FIGURES_MAX_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pure: whole Manila days from one YYYY-MM-DD date to another. Manila has no daylight saving. */
const daysBetween = (from: string, to: string) =>
  Math.round((manilaDayStart(to).getTime() - manilaDayStart(from).getTime()) / DAY_MS);

/** Pure: "Lazada", "Lazada and TikTok Shop", "Shopee, Lazada and TikTok Shop". */
function listOf(names: string[]): string {
  const last = names.at(-1) ?? "";
  return names.length < 2 ? last : `${names.slice(0, -1).join(", ")} and ${last}`;
}

/** Pure: "1 product link uses", "3 product links use". */
const counted = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/** Pure: how old something made at `madeAt` is at `now`: "under a minute", "1 minute", "18 hours". */
function ageOf(madeAt: string, now: Date): string {
  const age = now.getTime() - new Date(madeAt).getTime();
  if (age < MINUTE_MS) return "under a minute";
  if (age < HOUR_MS) return counted(Math.floor(age / MINUTE_MS), "minute", "minutes");
  return counted(Math.floor(age / HOUR_MS), "hour", "hours");
}

function pendingItem({ payments, now }: NeedsAttentionInput): AttentionItem | null {
  if (!payments || payments.pending === 0) return null;
  const oldest = payments.oldestPendingAt
    ? `Oldest is ${ageOf(payments.oldestPendingAt, now)} old. `
    : "";
  return {
    kind: "payments-pending",
    title: `${counted(payments.pending, "payment", "payments")} pending`,
    detail: `${oldest}Pending payments expire after 24 hours.`,
    action: "Review",
    href: ordersHref(PAYMENT_WORK.pending),
    tone: "info",
  };
}

function invoicesItem({ payments }: NeedsAttentionInput): AttentionItem | null {
  if (!payments || payments.invoicesToSend === 0) return null;
  return {
    kind: "invoices",
    title: `${counted(payments.invoicesToSend, "invoice request", "invoice requests")} to send`,
    detail: "Send each official invoice from the support inbox, then mark it sent on its Order.",
    action: "Send",
    href: ordersHref(PAYMENT_WORK.invoicesToSend),
    tone: "warning",
  };
}

function paidAfterExpiryItem({ payments }: NeedsAttentionInput): AttentionItem | null {
  if (!payments || payments.paidAfterExpiry === 0) return null;
  const one = payments.paidAfterExpiry === 1;
  return {
    kind: "paid-after-expiry",
    title: `${counted(payments.paidAfterExpiry, "Order", "Orders")} paid after expiry`,
    detail: one
      ? "PayMongo confirmed it after the Order had expired, in the last 7 days, and its days were added. Check the Member didn’t pay twice."
      : "PayMongo confirmed them after the Orders had expired, in the last 7 days, and their days were added. Check no Member paid twice.",
    action: "Review",
    href: ordersHref(PAYMENT_WORK.paidAfterExpiry),
    tone: "warning",
  };
}

function paidAccountDeletedItem({ payments }: NeedsAttentionInput): AttentionItem | null {
  if (!payments || payments.paidAccountDeleted === 0) return null;
  const count = payments.paidAccountDeleted;
  return {
    kind: "paid-account-deleted",
    title: "Paid, account deleted · refund in PayMongo",
    detail:
      count === 1
        ? "1 payment landed after the Member’s account was deleted, so it gave no access. Refund it in the PayMongo dashboard."
        : `${count} payments landed after the Members’ accounts were deleted, so they gave no access. Refund them in the PayMongo dashboard.`,
    action: "Review",
    href: ordersHref(PAYMENT_WORK.paidAccountDeleted),
    tone: "warning",
  };
}

function missingLinksItem({ products, settings }: NeedsAttentionInput): AttentionItem | null {
  const statuses = products
    .map((product) => storeLinkStatuses(product, settings.shopLinks))
    .filter(hasMissingLinks);
  const onShopPage = MARKETPLACES.filter(({ id }) =>
    statuses.some((links) => links[id] === "shop"),
  );
  const count = statuses.reduce(
    (total, links) => total + Object.values(links).filter((status) => status === "shop").length,
    0,
  );
  if (count === 0) return null;
  return {
    kind: "missing-links",
    title: `${counted(count, "product link uses", "product links use")} the shop page`,
    detail: `${listOf(onShopPage.map(({ name }) => name))} buttons open the shop. Add product links to go straight to each item.`,
    action: "Add links",
    href: productListHref({ q: null, exam: null, missing: true }),
    tone: "warning",
  };
}

function promoItem({ settings, now }: NeedsAttentionInput): AttentionItem | null {
  const banner = settings.promoBanner;
  const status = promoStatus(banner, now);
  const href = examPagesHref({ page: "promo" });
  if (status.kind === "off" || status.kind === "ended") {
    return {
      kind: "promo",
      title: "Promo banner is off",
      detail: "Turn it on in Pages & promo when the next sale starts.",
      action: "Open",
      href,
      tone: "quiet",
    };
  }
  if (
    status.kind === "on" &&
    banner &&
    daysBetween(manilaDate(now), banner.endDate) <= PROMO_ENDING_DAYS
  ) {
    return {
      kind: "promo",
      title: `Promo banner ends ${dayMonth(banner.endDate)}`,
      detail: "It turns itself off after that day. Set the next sale in Pages & promo.",
      action: "Open",
      href,
      tone: "warning",
    };
  }
  return null;
}

function searchFixesItem({ exams, examPages }: NeedsAttentionInput): AttentionItem | null {
  const needFixes = exams.filter((exam) => {
    const page = examPages.find((p) => p.examCode === exam.code) ?? examPageDefaults(exam.code);
    return seoCheck(examPageSeo(exam, page)) !== "good";
  });
  const [first] = needFixes;
  if (!first) return null;
  return {
    kind: "search",
    title: `${counted(needFixes.length, "exam page needs", "exam pages need")} search fixes`,
    detail: `${needFixes.map((exam) => exam.code).join(" · ")}: the title or description doesn't fit a search result.`,
    action: "Fix",
    href: examPagesHref({ exam: first.code, section: "seo" }),
    tone: "warning",
  };
}

function hiddenItem({ products }: NeedsAttentionInput): AttentionItem | null {
  const count = products.filter((product) => !product.showOnWebsite).length;
  if (count === 0) return null;
  return {
    kind: "hidden",
    title: `${counted(count, "product is", "products are")} hidden from the website`,
    detail:
      count === 1
        ? "Visitors can't see it. Turn on Show on website once it's ready."
        : "Visitors can't see them. Turn on Show on website once they're ready.",
    action: "Review",
    href: paths.admin.products,
    tone: "info",
  };
}

function trustFiguresItem({ settings, now, role }: NeedsAttentionInput): AttentionItem | null {
  if (role !== "owner") return null;
  const { asOf } = settings.shopStats;
  const age = daysBetween(asOf, manilaDate(now));
  if (age <= TRUST_FIGURES_MAX_DAYS) return null;
  return {
    kind: "trust-figures",
    title: `Trust figures are ${age} days old`,
    detail: `The Shopee rating and followers are from ${formatDate(asOf)}. Copy today's from Shopee.`,
    action: "Update",
    href: paths.admin.settings,
    tone: "warning",
  };
}

/** Pure: what needs Staff today, in the Overview's order. Empty when nothing does. */
export function needsAttention(input: NeedsAttentionInput): AttentionItem[] {
  return [
    pendingItem,
    invoicesItem,
    paidAfterExpiryItem,
    paidAccountDeletedItem,
    missingLinksItem,
    promoItem,
    searchFixesItem,
    hiddenItem,
    trustFiguresItem,
  ].flatMap((item) => item(input) ?? []);
}

/** Pure: the greeting's line, "3 things need you today.", or "Nothing needs you today." */
export function needsYouToday(count: number): string {
  if (count === 0) return "Nothing needs you today.";
  return `${counted(count, "thing needs", "things need")} you today.`;
}
