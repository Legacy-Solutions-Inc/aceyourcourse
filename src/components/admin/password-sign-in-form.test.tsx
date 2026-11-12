import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PasswordSignInState } from "@/app/admin/sign-in/actions";

import { PasswordSignInForm } from "./password-sign-in-form";

// The password box (ticket 19), headed "DEVELOPMENT ONLY" under `pnpm dev`
// and "TESTING ONLY" on a deployment being tested (ticket 24). The Server Action is the
// boundary, so it is a stub here; its own tests are in
// src/app/admin/sign-in/live.test.tsx.

type Action = (previous: PasswordSignInState, formData: FormData) => Promise<PasswordSignInState>;

function renderBox(answer: PasswordSignInState = { error: null, fieldErrors: {}, email: "" }) {
  const action = vi.fn<Action>(async () => answer);
  const user = userEvent.setup();
  render(<PasswordSignInForm next="/admin/products" purpose="development" action={action} />);
  const box = screen.getByRole("region", { name: "Development only" });
  return { user, action, box };
}

describe("PasswordSignInForm", () => {
  it("says it's for development only, with labelled Email and Password fields and no sign-up", () => {
    const { box } = renderBox();

    expect(within(box).getByText("DEVELOPMENT ONLY")).toBeVisible();
    expect(within(box).getByRole("heading", { name: "Sign in with a password" })).toBeVisible();
    const email = within(box).getByLabelText("Email");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "email");
    const password = within(box).getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(within(box).getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(within(box).queryByRole("link")).not.toBeInTheDocument();
    expect(within(box).queryByText(/forgot|sign up|create/i)).not.toBeInTheDocument();
  });

  it("is headed TESTING ONLY, with the same fields, on a deployment being tested", () => {
    const action = vi.fn<Action>();
    render(<PasswordSignInForm next="/admin" purpose="testing" action={action} />);

    const box = screen.getByRole("region", { name: "Testing only" });
    expect(within(box).getByText("TESTING ONLY")).toBeVisible();
    expect(within(box).queryByText("DEVELOPMENT ONLY")).not.toBeInTheDocument();
    expect(within(box).getByRole("heading", { name: "Sign in with a password" })).toBeVisible();
    expect(within(box).getByLabelText("Email")).toBeInTheDocument();
    expect(within(box).getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(within(box).queryByText(/forgot|sign up|create/i)).not.toBeInTheDocument();
  });

  it("sends the email, the password and next", async () => {
    const { user, action, box } = renderBox();
    await user.type(within(box).getByLabelText("Email"), "angel@aceyourcourse.ph");
    await user.type(within(box).getByLabelText("Password"), "correct horse");
    await user.click(within(box).getByRole("button", { name: "Sign in" }));

    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get("email")).toBe("angel@aceyourcourse.ph");
    expect(formData?.get("password")).toBe("correct horse");
    expect(formData?.get("next")).toBe("/admin/products");
  });

  it("shows the form's error as an alert, keeping the typed email and emptying the password", async () => {
    const { user, box } = renderBox({
      error: "That email and password don't match.",
      fieldErrors: {},
      email: "angel@aceyourcourse.ph",
    });
    await user.type(within(box).getByLabelText("Email"), "angel@aceyourcourse.ph");
    await user.type(within(box).getByLabelText("Password"), "wrong");
    await user.click(within(box).getByRole("button", { name: "Sign in" }));

    expect(await within(box).findByRole("alert")).toHaveTextContent(
      "That email and password don't match.",
    );
    expect(within(box).getByLabelText("Email")).toHaveValue("angel@aceyourcourse.ph");
    expect(within(box).getByLabelText("Password")).toHaveValue("");
  });

  it("shows each field's message next to it", async () => {
    const { user, box } = renderBox({
      error: null,
      fieldErrors: { email: "Enter your email", password: "Enter your password" },
      email: "",
    });
    await user.click(within(box).getByRole("button", { name: "Sign in" }));

    const email = within(box).getByLabelText("Email");
    expect(await within(box).findByText("Enter your email")).toBeVisible();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Enter your email");
    const password = within(box).getByLabelText("Password");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAccessibleDescription("Enter your password");
    expect(within(box).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("disables Sign in while the sign-in is on its way", async () => {
    // A sign-in that never answers: the button stays disabled.
    const action = vi.fn<Action>(() => new Promise(() => {}));
    const user = userEvent.setup();
    render(<PasswordSignInForm next="/admin" purpose="development" action={action} />);
    const button = screen.getByRole("button", { name: "Sign in" });

    await user.click(button);
    expect(button).toBeDisabled();
  });
});
