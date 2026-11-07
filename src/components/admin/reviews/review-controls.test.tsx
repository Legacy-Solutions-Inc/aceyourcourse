import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import type { AdminActionState } from "@/lib/admin/action";
import type { AdminReview, DeletedReview } from "@/services/admin.types";

import { type ReviewEditorActions } from "./review-editor";
import { ReviewMoveButtons } from "./review-move-buttons";
import { ReviewPanel } from "./review-panel";
import { ReviewPinSwitch } from "./review-pin-switch";

// The REVIEWS tab's single toggles and the panel, saving through stub Server
// Actions that answer as adminAction would. The router is the framework
// boundary, so it's replaced.
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  unstable_rethrow: () => {},
}));

type Submission = { input: unknown; expected?: { savedAt: string } };

function answering<T>(...answers: AdminActionState<T>[]) {
  return vi.fn(async (_previous: AdminActionState<T>, _submission: Submission) => {
    const next = answers.shift();
    if (!next) throw new Error("no more answers");
    return next;
  });
}

const REVIEW: AdminReview = {
  review: {
    id: "rev-002",
    productId: "prd-001",
    stars: 5,
    text: "hiii kaka receive ko lang",
    variation: null,
    helpful: 5,
    marketplace: "shopee",
    homePin: 10,
  },
  stamp: { savedAt: "2026-10-22T03:42:00.000Z", savedBy: null },
};

beforeEach(() => {
  router.refresh.mockClear();
  router.replace.mockClear();
});

describe("ReviewPinSwitch", () => {
  function renderSwitch(action = answering<AdminReview>({ status: "saved", value: REVIEW })) {
    const user = userEvent.setup();
    render(
      <>
        <ReviewPinSwitch
          reviewId="rev-002"
          pinned={false}
          action={action}
          aria-label="Pin on Home"
        />
        <Toaster />
      </>,
    );
    return { user, action };
  }

  it("pins at once, then reads the list again", async () => {
    const { user, action } = renderSwitch();

    await user.click(screen.getByRole("switch", { name: "Pin on Home" }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(action).toHaveBeenCalledWith(expect.anything(), {
      input: { id: "rev-002", pinned: true },
    });
  });

  it("says when the Review is gone", async () => {
    const { user } = renderSwitch(
      answering<AdminReview>({ status: "refused", error: { kind: "not-found" } }),
    );

    await user.click(screen.getByRole("switch", { name: "Pin on Home" }));

    expect(
      await screen.findByText(
        "That Review is no longer in the catalogue, so nothing was changed. The list is up to date.",
      ),
    ).toBeInTheDocument();
  });

  it("switches back with the “Couldn't save” toast when the save breaks down", async () => {
    const { user } = renderSwitch(answering<AdminReview>({ status: "failed" }));

    await user.click(screen.getByRole("switch", { name: "Pin on Home" }));

    expect(
      await screen.findByText("The switch is back as it was.", { exact: false }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Pin on Home" })).toHaveAttribute(
        "aria-checked",
        "false",
      ),
    );
  });
});

describe("ReviewMoveButtons", () => {
  function renderButtons(
    props: Partial<Parameters<typeof ReviewMoveButtons>[0]> = {},
    action = answering<string[]>({ status: "saved", value: ["rev-006", "rev-013"] }),
  ) {
    const user = userEvent.setup();
    render(
      <>
        <ReviewMoveButtons
          reviewId="rev-006"
          name="“Suitability: Good”"
          first={false}
          last={false}
          disabledReason={null}
          action={action}
          {...props}
        />
        <Toaster />
      </>,
    );
    return { user, action };
  }

  it("moves the Review up or down, then reads the list again", async () => {
    const { user, action } = renderButtons();

    await user.click(screen.getByRole("button", { name: "Move up on Home: “Suitability: Good”" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(action).toHaveBeenCalledWith(expect.anything(), {
      input: { id: "rev-006", direction: "up" },
    });
  });

  it("disables ▲ on the first and ▼ on the last", () => {
    renderButtons({ first: true, last: true });

    expect(screen.getByRole("button", { name: /^Move up/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Move down/ })).toBeDisabled();
  });

  it("disables both, saying why, while another filter is on", () => {
    renderButtons({ disabledReason: "Clear the search, Exam and stars to reorder" });

    expect(screen.getByRole("button", { name: /^Move up/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Move down/ })).toHaveAttribute(
      "title",
      "Clear the search, Exam and stars to reorder",
    );
  });

  it("says why the server refused a move", async () => {
    const { user } = renderButtons(
      {},
      answering<string[]>({
        status: "refused",
        error: { kind: "invalid", fieldErrors: {}, formError: "IT’S ALREADY FIRST ON HOME" },
      }),
    );

    await user.click(screen.getByRole("button", { name: /^Move up/ }));

    expect(await screen.findByText("IT’S ALREADY FIRST ON HOME")).toBeInTheDocument();
  });
});

describe("ReviewPanel", () => {
  const actions: ReviewEditorActions = {
    save: answering<AdminReview>(),
    add: answering<AdminReview>({ status: "saved", value: REVIEW }),
    remove: answering<DeletedReview>(),
    countDelete: answering(),
    setPin: answering<AdminReview>(),
  };
  const list = {
    products: [
      {
        id: "prd-001",
        slug: "ce-formula-flash-cards",
        examCode: "CE",
        shortName: "CE Formula Flash Cards",
        variations: [],
      },
    ],
    pinnedOnHome: 0,
    query: { q: null, exam: "CE", stars: null, pinned: false },
  };

  it("prompts to pick a Review when none is selected", () => {
    render(
      <ReviewPanel
        selected={null}
        opened={null}
        deletePreview={null}
        list={list}
        actions={actions}
      />,
    );
    expect(screen.getByRole("complementary", { name: "Review editor" })).toHaveTextContent(
      "Select a review",
    );
  });

  it("opens a Review just added at its own address, keeping the filters", async () => {
    const user = userEvent.setup();
    render(
      <ReviewPanel
        selected="new"
        opened={null}
        deletePreview={null}
        list={list}
        actions={actions}
      />,
    );

    await user.type(screen.getByLabelText("REVIEW TEXT · COPY WORD FOR WORD"), "Sulit!");
    await user.click(screen.getByRole("button", { name: "Add review" }));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/admin/reviews?exam=ce&review=rev-002", {
        scroll: false,
      }),
    );
  });
});
