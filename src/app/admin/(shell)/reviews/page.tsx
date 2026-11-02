import type { Metadata } from "next";
import Link from "next/link";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import { ReviewList } from "@/components/admin/reviews/review-list";
import { ReviewPanel } from "@/components/admin/reviews/review-panel";
import { ReviewsTabs } from "@/components/admin/reviews/reviews-tabs";
import { requireStaff } from "@/lib/admin/guard";
import { parseReviewListParams, reviewListHref } from "@/lib/admin/review-list";
import { paths } from "@/paths";
import { getReviewForAdmin, listReviewsForAdmin, previewReviewDelete } from "@/services/admin";

import {
  addReview,
  countReviewDelete,
  moveReviewOnHome,
  removeReview,
  saveReview,
  setReviewPin,
} from "./actions";

export const metadata: Metadata = { title: adminScreen("reviews").title };

interface ReviewsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Reviews & FAQs (BUILD-MAP §3.4). The REVIEWS tab lists every Review, with
 * the filters and the selection in the URL, and the selected Review's editor
 * beside it, all read fresh on every request. The FAQS tab is ticket 08's.
 */
export default async function ReviewsPage({ searchParams }: ReviewsPageProps) {
  const actor = await requireStaff(paths.admin.reviews);
  const { tab, query, review } = parseReviewListParams(await searchParams);

  if (tab === "faqs") {
    return (
      <AdminScreen screen="reviews">
        <ReviewsTabs tab="faqs" />
      </AdminScreen>
    );
  }

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
