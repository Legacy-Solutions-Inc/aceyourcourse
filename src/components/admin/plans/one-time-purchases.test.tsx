import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type { OneTimePurchase } from "@/services/admin.types";

import { OneTimePurchases, type OneTimePurchaseActions } from "./one-time-purchases";

// Plans & prices → One-time purchases (Phase 5, ticket 06; BUILD-MAP §3.8):
// each separately sold Course with its price in whole pesos and its On sale
// switch. The Server Actions are the boundary, so they're replaced; the list
// shows what each one answers.
const { refresh, toast } = vi.hoisted(() => ({ refresh: vi.fn(), toast: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  unstable_rethrow: () => {},
}));
vi.mock("sonner", () => ({ toast }));

const PSAD: OneTimePurchase = {
  id: "6a1e2d3c-4b5a-4f6e-8d7c-9b0a1f2e3d4c",
  title: "PSAD Masterclass",
  examCode: "CE",
  subjectCode: "PSAD",
  priceCentavos: 149_900,
  onSale: true,
  visible: true,
};
const HPGE: OneTimePurchase = {
  ...PSAD,
  id: "7b2f3e4d-5c6b-4a7f-9e8d-0c1b2a3f4e5d",
  title: "HPGE Crash Course",
  subjectCode: "HPGE",
  priceCentavos: null,
  onSale: false,
};

const saved = <T,>(value: T): AdminActionState<T> => ({ status: "saved", value });

function actionsWith(overrides: Partial<OneTimePurchaseActions> = {}) {
  return {
    setPrice: vi.fn(async () => saved(PSAD)),
    setOnSale: vi.fn(async () => saved(PSAD)),
    ...overrides,
  } as OneTimePurchaseActions & Record<string, ReturnType<typeof vi.fn>>;
}

beforeEach(() => {
  refresh.mockClear();
  toast.mockClear();
});

describe("OneTimePurchases", () => {
  it("lists each separately sold Course with its price and On sale, marking one not on sale", () => {
    render(<OneTimePurchases purchases={[PSAD, HPGE]} examChip={null} actions={actionsWith()} />);

    expect(
      screen.getByRole("heading", { name: "ONE-TIME PURCHASES · NO EXPIRY · 2" }),
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Price: PSAD Masterclass" })).toHaveValue("1499");
    expect(screen.getByRole("textbox", { name: "Price: HPGE Crash Course" })).toHaveValue("");
    expect(screen.getByRole("switch", { name: "On sale: PSAD Masterclass" })).toBeChecked();
    const hpge = screen.getByText("HPGE Crash Course").closest("li");
    expect(within(hpge as HTMLElement).getByText("NOT ON SALE")).toBeVisible();
  });

  it("keeps to the Exam chip picked", () => {
    render(
      <OneTimePurchases
        purchases={[PSAD, { ...HPGE, examCode: "ME" }]}
        examChip="ME"
        actions={actionsWith()}
      />,
    );
    expect(screen.queryByText("PSAD Masterclass")).toBeNull();
    expect(screen.getByText("HPGE Crash Course")).toBeVisible();
  });

  it("saves a price as typed, then refreshes", async () => {
    const user = userEvent.setup();
    const actions = actionsWith({
      setPrice: vi.fn(async () => saved({ ...HPGE, priceCentavos: 129_900 })),
    });
    render(<OneTimePurchases purchases={[HPGE]} examChip={null} actions={actions} />);

    await user.type(screen.getByRole("textbox", { name: "Price: HPGE Crash Course" }), "1,299");
    await user.click(screen.getByRole("button", { name: "Save price" }));

    expect(actions.setPrice).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { id: HPGE.id, price: "1,299" } },
    );
    expect(toast).toHaveBeenCalledWith("✓ HPGE CRASH COURSE · ₱1,299");
    expect(screen.getByRole("textbox", { name: "Price: HPGE Crash Course" })).toHaveValue("1299");
    expect(refresh).toHaveBeenCalled();
  });

  it("says why the server refused a price", async () => {
    const user = userEvent.setup();
    const actions = actionsWith({
      setPrice: vi.fn(async () => ({
        status: "refused" as const,
        error: { kind: "invalid" as const, fieldErrors: { price: ["ENTER A WHOLE PESO AMOUNT"] } },
      })),
    });
    render(<OneTimePurchases purchases={[HPGE]} examChip={null} actions={actions} />);

    await user.type(screen.getByRole("textbox", { name: "Price: HPGE Crash Course" }), "12.50");
    await user.click(screen.getByRole("button", { name: "Save price" }));

    expect(screen.getByRole("alert")).toHaveTextContent("ENTER A WHOLE PESO AMOUNT");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("says how to add one when no Course is sold separately", () => {
    render(<OneTimePurchases purchases={[]} examChip={null} actions={actionsWith()} />);
    expect(
      screen.getByText(
        "No course is sold separately. Switch one to Sold separately in its Course settings.",
      ),
    ).toBeVisible();
  });
});
