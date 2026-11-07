import type { Metadata } from "next";
import Link from "next/link";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import { FaqGroups, FaqList } from "@/components/admin/faqs/faq-list";
import { FaqPanel } from "@/components/admin/faqs/faq-panel";
import { ReviewList } from "@/components/admin/reviews/review-list";
import { ReviewPanel } from "@/components/admin/reviews/review-panel";
import { ReviewsTabs } from "@/components/admin/reviews/reviews-tabs";
import { faqListHref, parseFaqListParams } from "@/lib/admin/faq-list";
import { requireStaff } from "@/lib/admin/guard";
import { parseReviewListParams, reviewListHref } from "@/lib/admin/review-list";
import { paths } from "@/paths";
import {
  getFaqForAdmin,
  getReviewForAdmin,
  listFaqsForAdmin,
  listReviewsForAdmin,
  previewReviewDelete,
} from "@/services/admin";
import type { StaffActor } from "@/services/admin.types";

import {
  addFaq,
  addReview,
  countReviewDelete,
  moveFaqInGroup,
  moveReviewOnHome,
  removeFaq,
  removeReview,
  saveFaq,
  saveReview,
  setReviewPin,
} from "./actions";

export const metadata: Metadata = { title: adminScreen("reviews").title };

type SearchParams = Record<string, string | string[] | undefined>;

interface ReviewsPageProps {
  searchParams: Promise<SearchParams>;
}

/**
 * Reviews & FAQs (BUILD-MAP §3.4). The REVIEWS tab lists every Review, with
 * the filters and the selection in the URL, and the selected Review's editor
 * beside it. The FAQS tab lists the FAQ groups, the group's questions (or a
 * search's matches) and the selected FAQ's editor. Everything is read fresh
 * on every request.
 */
export default async function ReviewsPage({ searchParams }: ReviewsPageProps) {
  const actor = await requireStaff(paths.admin.reviews);
  const params = await searchParams;
  const { tab, query, review } = parseReviewListParams(params);

  if (tab === "faqs") return renderFaqsTab(actor, params);

  // The selected Review is read by id: the filters may leave it out of the list.
  const editing = review && review !== "new" ? review : null;
  const [list, opened, deletePreview] = await Promise.all([
    listReviewsForAdmin(actor, query),
    editing ? getReviewForAdmin(actor, editing) : null,
    editing ? previewReviewDelete(actor, editing) : null,
  ]);
  return (
    <AdminScreen
      screen="reviews"
      primaryAction={
        <Link
          href={reviewListHref(list.query, "new")}
          scroll={false}
          className="flex min-h-10 items-center border-[1.5px] bg-ayc-orange px-4 text-sm font-bold text-ayc-navy shadow-hard-sm"
        >
          + Add<span className="sr-only"> review</span>
        </Link>
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        <ReviewsTabs tab="reviews" />
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <ReviewList list={list} selected={review} setPin={setReviewPin} move={moveReviewOnHome} />
          <ReviewPanel
            selected={review}
            opened={opened}
            deletePreview={deletePreview}
            list={list}
            actions={{
              save: saveReview,
              add: addReview,
              remove: removeReview,
              countDelete: countReviewDelete,
              setPin: setReviewPin,
            }}
          />
        </div>
      </div>
    </AdminScreen>
  );
}

/** The FAQS tab (mockup 279–313): GROUPS, the questions, and the editor. */
async function renderFaqsTab(actor: StaffActor, params: SearchParams) {
  const { query, faq } = parseFaqListParams(params);
  const editing = faq && faq !== "new" ? faq : null;
  const [list, opened] = await Promise.all([
    listFaqsForAdmin(actor, query),
    editing ? getFaqForAdmin(actor, editing) : null,
  ]);
  return (
    <AdminScreen
      screen="reviews"
      primaryAction={
        <Link
          href={faqListHref(list.query, "new")}
          scroll={false}
          className="flex min-h-10 items-center border-[1.5px] bg-ayc-orange px-4 text-sm font-bold text-ayc-navy shadow-hard-sm"
        >
          + Add<span className="sr-only"> question</span>
        </Link>
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        <ReviewsTabs tab="faqs" />
        <div className="grid items-start gap-4 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_380px]">
          <FaqGroups list={list} />
          <FaqList list={list} selected={faq} move={moveFaqInGroup} />
          <div className="lg:col-span-2 xl:col-span-1">
            <FaqPanel
              selected={faq}
              opened={opened}
              list={list}
              actions={{ save: saveFaq, add: addFaq, remove: removeFaq }}
            />
          </div>
        </div>
      </div>
    </AdminScreen>
  );
}
