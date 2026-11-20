import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { claimDevice, getOrCreateMember, requestPrivacy } from "@/services/member.mock";
import { resetSampleStore } from "@/services/mock/sample-store";

import MemberPage from "./[id]/page";
import UsersPage from "./page";

// The Users screens (Phase 3, ticket 16; stories 129, 130, 132): the Users
// list and a Member's detail page are Owners only, on the server. Each page
// calls the Staff Guard itself. The cookie jar and redirect() are the
// framework boundary, so they're replaced; the sample data is the seam.
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
  usePathname: () => "/admin/users",
  useRouter: () => ({ refresh: () => {}, replace: () => {} }),
  unstable_rethrow: () => {},
}));

const OWNER = "angel@aceyourcourse.ph";
const EDITOR = "content@aceyourcourse.ph";
const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  email: "tester@example.com",
  name: "Bea Tester",
};
/**
 * Bea's phone's token hash, as the Member App stores it. A literal: nothing in
 * the Admin uses the Active Device modules (src/app/app/device.test.tsx).
 */
const BEA_PHONE = "b".repeat(64);
const SAM = {
  userId: "1c9d7e52-3b0a-4f6e-8d2c-5a4b3c2d1e0f",
  email: "stranger@example.com",
  name: "Sam Stranger",
};

const signInAs = (email: string) => jar.set("ayc_admin_sample", email);
const usersPage = (params: Record<string, string> = {}) =>
  UsersPage({ searchParams: Promise.resolve(params) });
const memberPage = (id: string) => MemberPage({ params: Promise.resolve({ id }) });
const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

beforeEach(() => {
  jar.clear();
  resetSampleStore();
});

describe("the Users list", () => {
  it("opens on the Users tab, saying there are no Members before anyone signs in", async () => {
    signInAs(OWNER);
    render(await usersPage());

    expect(screen.getByRole("link", { name: "USERS" })).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByText(
        "No Members yet. Members appear here after their first sign-in to the Member App.",
      ),
    ).toBeInTheDocument();
  });

  describe("with Members", () => {
    beforeEach(async () => {
      await getOrCreateMember(BEA);
      await getOrCreateMember(SAM);
      signInAs(OWNER);
    });

    it("lists every Member", async () => {
      render(await usersPage());
      expect(rows()).toHaveLength(2);
    });

    it("filters to the Beta Testers", async () => {
      render(await usersPage({ filter: "beta" }));
      expect(rows()).toHaveLength(1);
      expect(rows()[0]).toHaveTextContent("Bea Tester");
    });

    it("shows an empty state for a search with no results", async () => {
      render(await usersPage({ q: "nobody" }));
      expect(screen.getByText("No users match. Clear the search or filter.")).toBeInTheDocument();
    });

    it("falls back to every Member and the first page for a filter and page it doesn't know", async () => {
      render(await usersPage({ filter: "paid", page: "abc" }));
      expect(rows()).toHaveLength(2);
      expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "true");
    });
  });

  it("sends a signed-out visitor to sign-in, coming back to the same search", async () => {
    await expect(usersPage({ q: "bea", filter: "beta" })).rejects.toThrow(
      `NEXT_REDIRECT /admin/sign-in?next=${encodeURIComponent("/admin/users?q=bea&filter=beta")}`,
    );
  });

  it.each<Record<string, string>>([{}, { tab: "beta-testers" }, { tab: "privacy-requests" }])(
    "refuses an Editor (%j)",
    async (params) => {
      signInAs(EDITOR);
      await expect(usersPage(params)).rejects.toThrow(
        "NEXT_REDIRECT /admin/denied?reason=owners-only",
      );
    },
  );

  it("never lets a Member who isn't Staff in", async () => {
    await getOrCreateMember(BEA);
    signInAs(BEA.email);
    await expect(usersPage()).rejects.toThrow("NEXT_REDIRECT /admin/denied?reason=not-staff");
  });
});

describe("the Privacy Requests tab", () => {
  const PRIVACY_REQUESTS = { tab: "privacy-requests" };

  it("shows an Owner every Member's requests, on its own tab", async () => {
    await getOrCreateMember(BEA);
    await getOrCreateMember(SAM);
    await requestPrivacy(BEA.userId, "deletion");
    await requestPrivacy(SAM.userId, "data-copy");
    signInAs(OWNER);
    render(await usersPage(PRIVACY_REQUESTS));

    expect(screen.getByRole("link", { name: "PRIVACY REQUESTS" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const list = screen.getByRole("region", { name: "Privacy Requests" });
    const listed = within(list).getAllByRole("row").slice(1);
    expect(listed).toHaveLength(2);
    expect(listed[0]).toHaveTextContent(/DATA COPY.*Sam Stranger/);
    expect(listed[1]).toHaveTextContent(/DELETION.*Bea Tester/);
  });

  it("says there are none yet", async () => {
    signInAs(OWNER);
    render(await usersPage(PRIVACY_REQUESTS));
    expect(screen.getByText(/^No Privacy Requests\./)).toBeInTheDocument();
  });

  it("sends a signed-out visitor to sign-in, coming back to the tab", async () => {
    await expect(usersPage(PRIVACY_REQUESTS)).rejects.toThrow(
      `NEXT_REDIRECT /admin/sign-in?next=${encodeURIComponent("/admin/users?tab=privacy-requests")}`,
    );
  });

  it("never lets a Member who isn't Staff in", async () => {
    await getOrCreateMember(BEA);
    await requestPrivacy(BEA.userId, "data-copy");
    signInAs(BEA.email);
    await expect(usersPage(PRIVACY_REQUESTS)).rejects.toThrow(
      "NEXT_REDIRECT /admin/denied?reason=not-staff",
    );
  });
});

describe("a Member's detail page", () => {
  beforeEach(async () => {
    await getOrCreateMember(BEA);
    await claimDevice(BEA.userId, {
      tokenHash: BEA_PHONE,
      deviceLabel: "Chrome on Android",
    });
  });

  it("shows an Owner the Member, with a way back to every user", async () => {
    signInAs(OWNER);
    render(await memberPage(BEA.userId));

    expect(screen.getByRole("heading", { level: 2, name: "Bea Tester" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← All users" })).toHaveAttribute(
      "href",
      "/admin/users",
    );
    expect(screen.getByRole("button", { name: "Sign out this device" })).toBeInTheDocument();
  });

  it.each([SAM.userId, "not-a-uuid"])("answers 404 for the Member %j", async (id) => {
    signInAs(OWNER);
    await expect(memberPage(id)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sends a signed-out visitor to sign-in, coming back to the page", async () => {
    await expect(memberPage(BEA.userId)).rejects.toThrow(
      `NEXT_REDIRECT /admin/sign-in?next=${encodeURIComponent(`/admin/users/${BEA.userId}`)}`,
    );
  });

  it("refuses an Editor", async () => {
    signInAs(EDITOR);
    await expect(memberPage(BEA.userId)).rejects.toThrow(
      "NEXT_REDIRECT /admin/denied?reason=owners-only",
    );
  });

  it("never lets a Member who isn't Staff in, even to their own page", async () => {
    signInAs(BEA.email);
    await expect(memberPage(BEA.userId)).rejects.toThrow(
      "NEXT_REDIRECT /admin/denied?reason=not-staff",
    );
  });
});
