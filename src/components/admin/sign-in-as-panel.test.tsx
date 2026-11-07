import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { SignInAsState } from "@/app/admin/sign-in/actions";

import { SignInAsPanel } from "./sign-in-as-panel";

// "Continue with Google" opens the sample "Sign in as" list. The Server Action
// is the boundary, so it is a stub here; its own tests are in
// src/app/admin/sign-in/actions.test.ts.
const USERS = [
  { name: "Angel Rose L. Lepaña", email: "angel@aceyourcourse.ph", startsAs: "Owner" },
  { name: "Juan Dela Cruz", email: "juan.delacruz@gmail.com", startsAs: "Not on the staff list" },
];

function renderPanel(
  action = vi.fn(async (_: SignInAsState, __: FormData): Promise<SignInAsState> => ({
    error: null,
    email: "",
  })),
) {
  const user = userEvent.setup();
  render(<SignInAsPanel users={USERS} next="/admin/products" action={action} />);
  return { user, action };
}

describe("SignInAsPanel", () => {
  it("keeps the list closed until Continue with Google", async () => {
    const { user } = renderPanel();
    const google = screen.getByRole("button", { name: "Continue with Google" });
    expect(google).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "Sign in as" })).not.toBeInTheDocument();

    await user.click(google);
    expect(google).toHaveAttribute("aria-expanded", "true");
    const region = screen.getByRole("region", { name: "Sign in as" });
    expect(within(region).getByRole("button", { name: /Angel Rose L\. Lepaña/ })).toBeVisible();
    expect(within(region).getByLabelText("Other email")).toBeVisible();
  });

  it("signs in as the chosen User, sending next along", async () => {
    const { user, action } = renderPanel();
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));
    await user.click(screen.getByRole("button", { name: /juan\.delacruz@gmail\.com/ }));

    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get("email")).toBe("juan.delacruz@gmail.com");
    expect(formData?.get("next")).toBe("/admin/products");
  });

  it("shows the action's message on Other email, keeping what was typed", async () => {
    const { user, action } = renderPanel(
      vi.fn(async (_: SignInAsState, formData: FormData) => ({
        error: "Enter a valid email address, like name@example.com.",
        email: String(formData.get("email")),
      })),
    );
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));
    const field = screen.getByLabelText("Other email");
    await user.type(field, "not-an-email");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter a valid email address, like name@example.com.",
    );
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(
      "Enter a valid email address, like name@example.com.",
    );
    expect(field).toHaveValue("not-an-email");
    expect(action.mock.calls[0]?.[1].get("next")).toBe("/admin/products");
  });
});
