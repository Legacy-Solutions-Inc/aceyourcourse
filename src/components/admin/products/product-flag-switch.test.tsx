import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import type { AdminActionState } from "@/lib/admin/action";
import type { AdminProductRow } from "@/services/admin.types";

import { ProductFlagSwitch } from "./product-flag-switch";

// An inline App or Site toggle on the Products list, with its Server Action
// stubbed as adminAction would answer. It flips at once, saves with no conflict
// check, and reads the list again after every answer (router.refresh).
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  unstable_rethrow: () => {},
}));

type State = AdminActionState<AdminProductRow>;

const ROW: AdminProductRow = {
  id: "prd-001",
  slug: "ce-formula-flash-cards",
  title: "Civil Engineering Formula Flash Cards",
  shortName: "CE Formula Flash Cards",
  examCode: "CE",
  format: "flash-cards",
  state: "live",
  priceFrom: 120000,
  priceTo: null,
  unitsSold: 764,
  cover: null,
  storeLinks: { shopee: "product", lazada: "shop", tiktok: "shop" },
  showOnWebsite: false,
  availableInApp: true,
  stamp: { savedAt: "2026-10-22T03:43:00.000Z", savedBy: "AYC Content Team" },
};

const SAVED: State = { status: "saved", value: ROW };

/** A stub Server Action that answers once, when `release` is called. */
function answeringLater(answer: State | Error) {
  let release = () => {};
  const action = vi.fn(
    (_previous: State, _submission: { input: unknown }) =>
      new Promise<State>((resolve, reject) => {
        release = () => (answer instanceof Error ? reject(answer) : resolve(answer));
      }),
  );
  return { action, release: () => release() };
}

function renderSwitch(action: ReturnType<typeof answeringLater>["action"], checked = true) {
  const user = userEvent.setup();
  render(
    <>
      <ProductFlagSwitch
        productId="prd-001"
        flag="showOnWebsite"
        checked={checked}
        label="Show CE Formula Flash Cards on the website"
        title="CE Formula Flash Cards"
        action={action}
      />
      <Toaster />
    </>,
  );
  const toggle = screen.getByRole("switch", { name: "Show CE Formula Flash Cards on the website" });
  return { user, toggle };
}

beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => {};
});

beforeEach(() => {
  refresh.mockClear();
  // Sonner's toasts outlive each test's render.
  toast.dismiss();
});

describe("ProductFlagSwitch", () => {
  it("shows the flag as it is", () => {
    const { toggle } = renderSwitch(answeringLater(SAVED).action, false);
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("flips at once and sends only the Product and the flag, with no stamp", async () => {
    const { action, release } = answeringLater(SAVED);
    const { user, toggle } = renderSwitch(action);

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(action).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { id: "prd-001", showOnWebsite: false } },
    );
    release();
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("reverts a toggle that failed and shows the Couldn't save toast, whose Try again sends it again", async () => {
    const failed = answeringLater({ status: "failed" });
    const { user, toggle } = renderSwitch(failed.action);

    await user.click(toggle);
    failed.release();

    expect(await screen.findByText("COULDN’T SAVE")).toBeInTheDocument();
    expect(screen.getByText(/“CE Formula Flash Cards” wasn’t saved/)).toBeInTheDocument();
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(failed.action).toHaveBeenCalledTimes(2);
    expect(failed.action).toHaveBeenLastCalledWith(
      { status: "idle" },
      { input: { id: "prd-001", showOnWebsite: false } },
    );
    failed.release();
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
  });

  it("treats a request that never arrived as a failed toggle", async () => {
    const lost = answeringLater(new Error("network"));
    const { user, toggle } = renderSwitch(lost.action);

    await user.click(toggle);
    lost.release();

    expect(await screen.findByText("COULDN’T SAVE")).toBeInTheDocument();
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
  });

  it("says a Product deleted elsewhere is gone, and reads the list again", async () => {
    const gone = answeringLater({ status: "refused", error: { kind: "not-found" } });
    const { user, toggle } = renderSwitch(gone.action);

    await user.click(toggle);
    gone.release();

    expect(
      await screen.findByText(
        "CE Formula Flash Cards is no longer in the catalogue, so nothing was changed. The list is up to date.",
      ),
    ).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("COULDN’T SAVE")).not.toBeInTheDocument();
  });
});
