import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PlanRowView } from "./plans-view";
import { Plans, type PlansProps } from "./plans";

// The Member's Plans page body (Phase 4, ticket 02; BUILD-MAP §3 Plans;
// stories 134, 135, 151c and 151m): the Exam pills, the Plan rows as radio
// buttons, the order summary with the Payment Method, and "Pay {price} with
// PayMongo" wherever buying is set up (ticket 03), or "Buying opens soon",
// disabled.

const row = (fields: Partial<PlanRowView> & Pick<PlanRowView, "id" | "period">): PlanRowView => ({
  price: "₱499",
  perMonth: "for 30 days",
  bestValue: false,
  until: "17 Dec 2026",
  coversExamOn: null,
  summary: `CE All-Access · ${fields.period}`,
  summaryUntil: "UNTIL 17 DEC 2026 · NO AUTO-RENEWAL",
  ...fields,
});

const CE_ROWS = [
  row({ id: "ce-30", period: "1 month" }),
  row({
    id: "ce-90",
    period: "3 months",
    price: "₱1,299",
    perMonth: "₱433 / month",
    bestValue: true,
    until: "15 Feb 2027",
    coversExamOn: "10 Feb 2027",
    summaryUntil: "UNTIL 15 FEB 2027 · NO AUTO-RENEWAL",
  }),
  row({
    id: "ce-180",
    period: "6 months",
    price: "₱2,299",
    perMonth: "₱383 / month",
    until: "16 May 2027",
    coversExamOn: "10 Feb 2027",
    summaryUntil: "UNTIL 16 MAY 2027 · NO AUTO-RENEWAL",
  }),
];

function renderPlans(props: Partial<PlansProps> = {}) {
  return render(
    <Plans
      pills={[
        { code: "CE", name: "Civil Engineering", href: "/app/plans?exam=CE", current: true },
        { code: "ME", name: "Mechanical Engineering", href: "/app/plans?exam=ME", current: false },
      ]}
      exam={{ code: "CE", rows: CE_ROWS }}
      staff={false}
      contactEmail="help@example.com"
      pay={null}
      {...props}
    />,
  );
}

const planGroup = () => screen.getByRole("radiogroup", { name: /^CE ALL-ACCESS/ });
const summary = () => screen.getByRole("region", { name: "ORDER SUMMARY" });

describe("Plans", () => {
  it("says what a Plan is: paid once, for a fixed period, never renewed", () => {
    renderPlans();
    expect(
      screen.getByText("Pay once for a fixed period. Nothing renews automatically."),
    ).toBeInTheDocument();
  });

  it("gives each Exam with a Plan on sale a pill, marking the open one", () => {
    renderPlans();
    const pills = screen.getByRole("navigation", { name: "Exams" });
    expect(
      within(pills)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["CE · Civil Engineering", "ME · Mechanical Engineering"]);
    expect(within(pills).getByRole("link", { name: /^CE/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(pills).getByRole("link", { name: /^ME/ })).toHaveAttribute(
      "href",
      "/app/plans?exam=ME",
    );
    expect(within(pills).getByRole("link", { name: /^ME/ })).not.toHaveAttribute("aria-current");
  });

  it("heads the Plans with the Exam's All-Access and what it opens", () => {
    renderPlans();
    expect(planGroup()).toHaveAccessibleName("CE ALL-ACCESS · FLASHCARDS, QUIZZES, REVIEWERS");
  });

  it("shows each Plan as a radio button with its period, price, end and Best value", () => {
    renderPlans();
    const radios = within(planGroup()).getAllByRole("radio");
    expect(radios).toHaveLength(3);

    const quarter = within(planGroup()).getByRole("radio", { name: /^3 months/ });
    const label = quarter.closest("label");
    expect(label).toHaveTextContent("BEST VALUE");
    expect(label).toHaveTextContent("₱1,299");
    expect(label).toHaveTextContent("₱433 / month");
    expect(label).toHaveTextContent("Until 15 Feb 2027 · covers your exam on 10 Feb 2027");
  });

  it("says covers your exam only on the Plans that reach it", () => {
    renderPlans();
    const month = within(planGroup())
      .getByRole("radio", { name: /^1 month/ })
      .closest("label");
    expect(month).toHaveTextContent("Until 17 Dec 2026");
    expect(month).not.toHaveTextContent("covers your exam");
    expect(month).not.toHaveTextContent("BEST VALUE");
  });

  it("opens with the Best value Plan picked, in the order summary", () => {
    renderPlans();
    expect(within(planGroup()).getByRole("radio", { name: /^3 months/ })).toBeChecked();
    expect(summary()).toHaveTextContent("CE All-Access · 3 months");
    expect(summary()).toHaveTextContent("₱1,299");
    expect(summary()).toHaveTextContent("UNTIL 15 FEB 2027 · NO AUTO-RENEWAL");
  });

  it("follows the Plan the Member picks in the order summary", async () => {
    const user = userEvent.setup();
    renderPlans();
    await user.click(within(planGroup()).getByRole("radio", { name: /^6 months/ }));

    expect(summary()).toHaveTextContent("CE All-Access · 6 months");
    expect(summary()).toHaveTextContent("₱2,299");
    expect(summary()).toHaveTextContent("UNTIL 16 MAY 2027 · NO AUTO-RENEWAL");
  });

  it("offers QR Ph, GCash, Maya and Card to pay with, QR Ph first and picked", async () => {
    const user = userEvent.setup();
    renderPlans();
    const methods = within(summary()).getByRole("radiogroup", { name: "PAY WITH" });
    expect(
      within(methods)
        .getAllByRole("radio")
        .map((radio) => radio.closest("label")?.textContent),
    ).toEqual(["QR Ph", "GCash", "Maya", "Card"]);
    expect(within(methods).getByRole("radio", { name: "QR Ph" })).toBeChecked();

    await user.click(within(methods).getByRole("radio", { name: "Maya" }));
    expect(within(methods).getByRole("radio", { name: "Maya" })).toBeChecked();
  });

  it("reads Buying opens soon, disabled, where buying isn't set up", () => {
    renderPlans();
    const button = within(summary()).getByRole("button", { name: "Buying opens soon" });
    expect(button).toBeDisabled();
    expect(within(summary()).queryByRole("button", { name: /^Pay / })).not.toBeInTheDocument();
  });

  it("offers Pay with the picked Plan's price wherever buying is set up", async () => {
    const user = userEvent.setup();
    renderPlans({ pay: async () => ({ error: null }) });

    const button = within(summary()).getByRole("button", { name: "Pay ₱1,299 with PayMongo" });
    expect(button).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Buying opens soon" })).not.toBeInTheDocument();

    await user.click(within(planGroup()).getByRole("radio", { name: /^6 months/ }));
    expect(
      within(summary()).getByRole("button", { name: "Pay ₱2,299 with PayMongo" }),
    ).toBeInTheDocument();
  });

  it("sends the Exam, the Plan picked and the method on Pay", async () => {
    const user = userEvent.setup();
    const pay = vi.fn(async (_previous: { error: string | null }, _form: FormData) => ({
      error: null,
    }));
    renderPlans({ pay });

    await user.click(within(planGroup()).getByRole("radio", { name: /^6 months/ }));
    await user.click(screen.getByRole("radio", { name: "GCash" }));
    await user.click(screen.getByRole("button", { name: "Pay ₱2,299 with PayMongo" }));

    await waitFor(() => expect(pay).toHaveBeenCalledOnce());
    const sent = pay.mock.calls[0]?.[1];
    expect(Object.fromEntries(sent?.entries() ?? [])).toEqual({
      examCode: "CE",
      plan: "ce-180",
      method: "gcash",
    });
  });

  it("says why Pay was refused", async () => {
    const user = userEvent.setup();
    renderPlans({
      pay: async () => ({ error: "That plan isn’t on sale any more. Pick another one." }),
    });

    await user.click(screen.getByRole("button", { name: "Pay ₱1,299 with PayMongo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That plan isn’t on sale any more. Pick another one.",
    );
  });

  it("says payment is finished on PayMongo's page, and links the Terms of Use", () => {
    renderPlans();
    expect(summary()).toHaveTextContent(
      "You’ll finish payment on PayMongo’s secure page. We never see or store your card details.",
    );
    expect(summary()).toHaveTextContent(
      "By paying you agree to the Terms of Use, including Payments and refunds.",
    );
    expect(within(summary()).getByRole("link", { name: "Terms of Use" })).toHaveAttribute(
      "href",
      "/legal/terms",
    );
  });

  it("tells Staff they already open all content", () => {
    renderPlans({ staff: true });
    expect(screen.getByRole("note")).toHaveTextContent("As Staff you already open all content.");
  });

  it("has no Staff note for a Member", () => {
    renderPlans();
    expect(screen.queryByText(/As Staff/)).not.toBeInTheDocument();
  });

  it("says nothing is on sale, and how to ask for access, when no Exam has a Plan on sale", () => {
    renderPlans({ pills: [], exam: null });
    expect(screen.queryByRole("navigation", { name: "Exams" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByText(/No plans are on sale right now\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "help@example.com" })).toHaveAttribute(
      "href",
      "mailto:help@example.com",
    );
  });
});
