import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { adminMenu } from "./admin-menu";
import { AdminDrawer } from "./admin-drawer";
import { AdminSidebar } from "./admin-sidebar";

// The sidebar's menu and user block, and the mobile drawer around it: the
// "Menu" button opens it, and Escape, the close button or a link close it,
// with focus back on the button.
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/reviews" }));

const OWNER = {
  email: "angel@aceyourcourse.ph",
  name: "Angel Rose L. Lepaña",
  role: "owner",
} as const;
const EDITOR = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
} as const;
const signOut = vi.fn(async () => {});

describe("AdminSidebar", () => {
  it("marks the current screen and only the current screen", () => {
    render(<AdminSidebar menu={adminMenu("owner")} actor={OWNER} signOutAction={signOut} />);
    expect(screen.getByRole("link", { name: "Reviews & FAQs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("names each group of screens", () => {
    render(<AdminSidebar menu={adminMenu("owner")} actor={OWNER} signOutAction={signOut} />);
    expect(screen.getByRole("list", { name: "WEBSITE" })).toHaveTextContent(
      "02Pages & promo03Products & store links04Reviews & FAQs",
    );
    expect(screen.getByRole("list", { name: "SETTINGS" })).toHaveTextContent("05Settings");
  });

  it("shows the signed-in Staff User with their Staff Role and Sign out", () => {
    render(<AdminSidebar menu={adminMenu("editor")} actor={EDITOR} signOutAction={signOut} />);
    expect(screen.getByText("AYC Content Team")).toBeInTheDocument();
    expect(screen.getByText("content@aceyourcourse.ph")).toBeInTheDocument();
    expect(screen.getByText("EDITOR")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveAttribute("type", "submit");
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("has no close button outside the drawer", () => {
    render(<AdminSidebar menu={adminMenu("owner")} actor={OWNER} signOutAction={signOut} />);
    expect(screen.queryByRole("button", { name: "Close menu" })).not.toBeInTheDocument();
  });
});

describe("AdminDrawer", () => {
  function renderDrawer() {
    const user = userEvent.setup();
    render(<AdminDrawer menu={adminMenu("owner")} actor={OWNER} signOutAction={signOut} />);
    return { user, menu: screen.getByRole("button", { name: "Menu" }) };
  }

  it("starts closed", () => {
    const { menu } = renderDrawer();
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the menu, and Escape closes it with focus back on the Menu button", async () => {
    const { user, menu } = renderDrawer();
    await user.click(menu);
    const drawer = screen.getByRole("dialog", { name: "Menu" });
    expect(within(drawer).getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(within(drawer).getByText("Angel Rose L. Lepaña")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(menu).toHaveFocus();
  });

  it("closes from its close button", async () => {
    const { user, menu } = renderDrawer();
    await user.click(menu);
    await user.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(menu).toHaveFocus();
  });

  it("closes when a screen is chosen", async () => {
    const { user, menu } = renderDrawer();
    await user.click(menu);
    // jsdom can't follow links; stop it after the drawer has seen the click.
    window.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(
      within(screen.getByRole("dialog")).getByRole("link", { name: "Products & store links" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
