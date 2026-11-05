import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetSampleStore } from "@/services/mock/sample-store";

import AdminShellLayout from "./layout";
import OverviewPage from "./page";
import ExamPagesPage from "./exam-pages/page";
import ProductsPage from "./products/page";
import ReviewsPage from "./reviews/page";
import SettingsPage from "./settings/page";

// Every signed-in screen calls the Staff Guard itself, with its own address
// for `next`, because the shell layout doesn't re-render between screens. The
// cookie jar and redirect() are the framework boundary, so they are replaced.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/admin/products",
  useRouter: () => ({ refresh: () => {} }),
  unstable_rethrow: () => {},
}));

const signInAs = (email: string) => jar.set("ayc_admin_sample", email);

const SCREENS = [
  ["Overview", OverviewPage, "/admin", "HOME"],
  [
    "Pages & promo",
    () => ExamPagesPage({ searchParams: Promise.resolve({}) }),
    "/admin/exam-pages",
    "WEBSITE",
  ],
  [
    "Products & store links",
    () => ProductsPage({ searchParams: Promise.resolve({}) }),
    "/admin/products",
    "WEBSITE",
  ],
  [
    "Reviews & FAQs",
    () => ReviewsPage({ searchParams: Promise.resolve({}) }),
    "/admin/reviews",
    "WEBSITE",
  ],
  ["Settings", SettingsPage, "/admin/settings", "SETTINGS"],
] as const;

describe("Admin screens", () => {
  beforeEach(() => {
    jar.clear();
    resetSampleStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(SCREENS)(
    "%s sends a signed-out visitor to sign-in, coming back to it",
    async (_, Page, path) => {
      await expect(Page()).rejects.toThrow(
        `NEXT_REDIRECT /admin/sign-in?next=${encodeURIComponent(path)}`,
      );
    },
  );

  it.each(SCREENS)("%s refuses a User who isn't Staff", async (_, Page) => {
    signInAs("juan.delacruz@gmail.com");
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT /admin/denied?reason=not-staff");
  });

  it.each(SCREENS)(
    "%s shows the Owner its header and the SAMPLE DATA tag",
    async (title, Page, _, group) => {
      signInAs("angel@aceyourcourse.ph");
      render(await Page());
      const header = screen.getByRole("banner");
      expect(within(header).getByRole("heading", { level: 1 })).toHaveTextContent(title);
      expect(within(header).getByText(group, { exact: true })).toBeInTheDocument();
      expect(within(header).getByText("SAMPLE DATA")).toBeInTheDocument();
      expect(within(header).getByRole("button", { name: "Reset" })).toBeInTheDocument();
      expect(within(header).getByRole("link", { name: "View site" })).toHaveAttribute("href", "/");
      expect(screen.getByRole("main")).toBeInTheDocument();
    },
  );

  it("shows the Owner Settings' four parts with the sample data's values", async () => {
    signInAs("angel@aceyourcourse.ph");
    render(await SettingsPage());
    expect(screen.getByLabelText("EMAIL ADDRESS")).toHaveValue("aceyourcourseinc@gmail.com");
    expect(screen.getByLabelText("SHOPEE")).toHaveValue("https://shopee.ph/aceyourcourse");
    expect(screen.getByLabelText("FOLLOWERS")).toHaveValue("3.7K");
    expect(screen.getByText("NOT CHANGED IN THE ADMIN YET")).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["CONTACT EMAIL", "TRUST FIGURES", "STORE & SOCIAL LINKS", "ADMIN ACCOUNTS"]);
  });

  it("lists the sample staff list in ADMIN ACCOUNTS, with the Owner's own row first", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T03:42:00Z"));
    resetSampleStore();
    signInAs("angel@aceyourcourse.ph");
    render(await SettingsPage());

    const rows = within(screen.getByRole("list", { name: "Admin accounts" })).getAllByRole(
      "listitem",
    );
    expect(rows.map((row) => row.textContent)).toEqual([
      "Angel Rose L. Lepañaangel@aceyourcourse.phYOU · CAN’T BE REMOVEDOWNER",
      "AYC Content Teamcontent@aceyourcourse.phLAST SIGNED IN 2 DAYS AGOEDITORAYC Content Team: Make OwnerRemove AYC Content Team",
      "Invitedkim.reyes@gmail.comEXPIRES IN 6 DAYS · RENEW the invite to kim.reyes@gmail.comINVITEDCopy invite message for kim.reyes@gmail.comCancel invite to kim.reyes@gmail.com",
      "Invitedexpired.invite@example.comEXPIRED · RENEW the invite to expired.invite@example.comINVITEDCancel invite to expired.invite@example.com",
    ]);
  });

  it("refuses an Editor Settings with the owners-only 403 screen", async () => {
    signInAs("content@aceyourcourse.ph");
    await expect(SettingsPage()).rejects.toThrow("NEXT_REDIRECT /admin/denied?reason=owners-only");
  });

  it.each(SCREENS.slice(0, 4))("%s is open to an Editor", async (title, Page) => {
    signInAs("content@aceyourcourse.ph");
    render(await Page());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
  });

  it("greets the Staff User by first name with today's date in Manila", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T03:42:00Z"));
    signInAs("angel@aceyourcourse.ph");
    render(await OverviewPage());
    expect(
      screen.getByRole("heading", { level: 2, name: "Good morning, Angel." }),
    ).toBeInTheDocument();
    expect(screen.getByText("THURSDAY · 22 OCT 2026")).toBeInTheDocument();
  });
});

describe("Admin shell layout", () => {
  beforeEach(() => {
    jar.clear();
    resetSampleStore();
  });

  it("puts an Owner's screen inside the sidebar, with all five screens", async () => {
    signInAs("angel@aceyourcourse.ph");
    render(await AdminShellLayout({ children: <p>Screen</p> }));
    const sidebar = screen.getByRole("complementary");
    expect(
      within(sidebar)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([
      "01Overview",
      "02Pages & promo",
      "03Products & store links",
      "04Reviews & FAQs",
      "05Settings",
      "View site ↗",
    ]);
    expect(within(sidebar).getByText("OWNER")).toBeInTheDocument();
    expect(screen.getByText("Screen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
  });

  it("leaves Settings out of an Editor's sidebar", async () => {
    signInAs("content@aceyourcourse.ph");
    render(await AdminShellLayout({ children: <p>Screen</p> }));
    const sidebar = screen.getByRole("complementary");
    expect(within(sidebar).queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    expect(within(sidebar).getByText("EDITOR")).toBeInTheDocument();
  });

  it.each([null, "juan.delacruz@gmail.com"])(
    "renders the bare screen, with no sidebar, for %s, so its own Guard decides",
    async (email) => {
      if (email) signInAs(email);
      render(await AdminShellLayout({ children: <p>Screen</p> }));
      expect(screen.getByText("Screen")).toBeInTheDocument();
      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    },
  );
});
