import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type { BetaTester } from "@/services/admin.types";

import { BetaTesters } from "./beta-testers";

// The Beta Testers tab (stories 133a and 133b): an Owner adds a Google email
// and removes one. The Server Actions are the boundary, so they are replaced;
// the screen shows what each one answers and reads the list again.
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  unstable_rethrow: () => {},
}));

const OWNER = { email: "angel@aceyourcourse.ph", name: "Angel Rose L. Lepaña" };
const BEA: BetaTester = {
  email: "tester@example.com",
  addedAt: "2026-11-14T03:42:00.000Z",
  addedBy: OWNER,
};
const NEW: BetaTester = {
  email: "new.tester@example.com",
  addedAt: "2026-11-17T03:42:00.000Z",
  addedBy: OWNER,
};

const saved = (value: BetaTester): AdminActionState<BetaTester> => ({ status: "saved", value });
const refused = (
  error: Extract<AdminActionState<BetaTester>, { status: "refused" }>["error"],
): AdminActionState<BetaTester> => ({ status: "refused", error });

function renderTab({ testers = [BEA], memberAppLive = false } = {}) {
  const addTester = vi.fn(async (): Promise<AdminActionState<BetaTester>> => saved(NEW));
  const removeTester = vi.fn(async (): Promise<AdminActionState<BetaTester>> => saved(BEA));
  const user = userEvent.setup();
  render(
    <BetaTesters
      testers={testers}
      memberAppLive={memberAppLive}
      actions={{ addTester, removeTester }}
    />,
  );
  return { user, addTester, removeTester };
}

const emailField = () => screen.getByLabelText("GOOGLE ACCOUNT EMAIL");
const addButton = () => screen.getByRole("button", { name: "Add Beta Tester" });
const status = () => screen.getByRole("status");

describe("BetaTesters", () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  it("lists each Beta Tester with the date added, in Manila, and who added them", () => {
    renderTab({ testers: [BEA, NEW] });

    const rows = within(screen.getByRole("list", { name: "Beta Testers" })).getAllByRole(
      "listitem",
    );
    expect(rows.map((row) => row.textContent)).toEqual([
      "tester@example.comADDED 14 NOV 2026 · BY ANGEL ROSE L. LEPAÑARemove tester@example.com",
      "new.tester@example.comADDED 17 NOV 2026 · BY ANGEL ROSE L. LEPAÑARemove new.tester@example.com",
    ]);
  });

  it("says so when there are none yet", () => {
    renderTab({ testers: [] });
    expect(screen.queryByRole("list", { name: "Beta Testers" })).not.toBeInTheDocument();
    expect(screen.getByText("No Beta Testers yet. Add the first one below.")).toBeInTheDocument();
  });

  it("says the list no longer decides once the Member App is open to everyone", () => {
    renderTab({ memberAppLive: true });
    expect(
      screen.getByText(
        "The Member App is open to everyone, so this list no longer decides who gets in.",
      ),
    ).toBeInTheDocument();
  });

  it("adds the typed email, says so, clears the field and reads the list again", async () => {
    const { user, addTester } = renderTab();

    await user.type(emailField(), "New.Tester@Example.com");
    await user.click(addButton());

    expect(addTester).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { email: "New.Tester@Example.com" } },
    );
    expect(await screen.findByText("✓ ADDED · NEW.TESTER@EXAMPLE.COM IS A BETA TESTER")).toBe(
      status(),
    );
    expect(emailField()).toHaveValue("");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    "Enter a valid email address, like name@example.com.",
    "This email is already a Beta Tester.",
  ])("shows the refusal “%s” under the email field, and keeps what was typed", async (message) => {
    const { user, addTester } = renderTab();
    addTester.mockResolvedValue(refused({ kind: "invalid", fieldErrors: { email: [message] } }));

    await user.type(emailField(), "tester@example.com");
    await user.click(addButton());

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(emailField()).toHaveAttribute("aria-invalid", "true");
    expect(emailField()).toHaveAccessibleDescription(message);
    expect(emailField()).toHaveValue("tester@example.com");
    expect(status()).toBeEmptyDOMElement();
  });

  it("says an Editor's add was refused", async () => {
    const { user, addTester } = renderTab();
    addTester.mockResolvedValue(
      refused({ kind: "forbidden", message: "ONLY AN OWNER CAN MANAGE BETA TESTERS" }),
    );

    await user.type(emailField(), "new.tester@example.com");
    await user.click(addButton());

    expect(await screen.findByText("ONLY AN OWNER CAN MANAGE BETA TESTERS")).toBe(status());
  });

  it("says nothing was changed when the server couldn't be reached", async () => {
    const { user, addTester } = renderTab();
    addTester.mockResolvedValue({ status: "failed" });

    await user.type(emailField(), "new.tester@example.com");
    await user.click(addButton());

    expect(await screen.findByText("Couldn’t reach the server, so nothing was changed.")).toBe(
      status(),
    );
  });

  it("asks before removing, and Cancel changes nothing", async () => {
    const { user, removeTester } = renderTab();

    await user.click(screen.getByRole("button", { name: "Remove tester@example.com" }));
    const dialog = screen.getByRole("dialog", { name: "Remove tester@example.com from the beta?" });
    expect(dialog).toHaveTextContent("Their account and study progress are kept.");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(removeTester).not.toHaveBeenCalled();
  });

  it("removes once confirmed, says so and reads the list again", async () => {
    const { user, removeTester } = renderTab();

    await user.click(screen.getByRole("button", { name: "Remove tester@example.com" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Remove Beta Tester" }),
    );

    expect(removeTester).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { email: "tester@example.com" } },
    );
    expect(
      await screen.findByText("✓ REMOVED · TESTER@EXAMPLE.COM IS NO LONGER A BETA TESTER"),
    ).toBe(status());
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("says so when someone else already removed them", async () => {
    const { user, removeTester } = renderTab();
    removeTester.mockResolvedValue(refused({ kind: "not-found" }));

    await user.click(screen.getByRole("button", { name: "Remove tester@example.com" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Remove Beta Tester" }),
    );

    expect(
      await screen.findByText(
        "That email is no longer a Beta Tester, so nothing was changed. The list is up to date.",
      ),
    ).toBe(status());
  });
});
