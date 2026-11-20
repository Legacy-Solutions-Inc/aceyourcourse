import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { paths } from "@/paths";
import { getOrCreateMember, latestConsent, requestPrivacy } from "@/services/member.mock";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import { ALREADY_DELETED } from "@/lib/member-app/privacy-requests";
import { NOT_A_DATA_COPY } from "@/services/privacy-requests.core";

import { deleteAccount, markRequestDone } from "./actions";
import UsersPage from "./page";
import { POST } from "./privacy-requests/[id]/data/route";
import PrivacyRequestPage from "./privacy-requests/[id]/page";

// A Privacy Request's screen and its data copy's download (ticket 19; stories
// 133q and 133r), for Owners only, on the server: the page and the route each
// call the Staff Guard themselves, and the actions go through adminAction. The
// cookie jar and redirect() are the framework boundary, so they're replaced;
// the sample data is the seam, and sample mode's auth admin deletes no
// Supabase User, as "Sign in as" makes none.
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
const SAM = {
  userId: "1c9d7e52-3b0a-4f6e-8d2c-5a4b3c2d1e0f",
  email: "stranger@example.com",
  name: "Sam Stranger",
};
const IDLE = { status: "idle" } as const;

const signInAs = (email: string) => jar.set("ayc_admin_sample", email);
const requestPage = (id: string) => PrivacyRequestPage({ params: Promise.resolve({ id }) });
const download = (id: string) =>
  POST(new Request(`http://localhost${paths.admin.privacyRequestData(id)}`, { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
const exported = () => getSampleStore().staffActivity.filter(({ action }) => action === "exported");

let copy: string;
let deletion: string;

beforeEach(async () => {
  jar.clear();
  resetSampleStore();
  await getOrCreateMember(BEA);
  await getOrCreateMember(SAM);
  copy = (await requestPrivacy(BEA.userId, "data-copy")).request.id;
  deletion = (await requestPrivacy(BEA.userId, "deletion")).request.id;
  await requestPrivacy(SAM.userId, "data-copy");
});

describe("a Privacy Request's screen", () => {
  it("shows an Owner the request, and how to carry it out", async () => {
    signInAs(OWNER);
    render(await requestPage(copy));

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Copy of Bea Tester’s data",
    );
    expect(screen.getByRole("button", { name: "Download this Member’s data" })).toBeVisible();
    expect(screen.getByRole("link", { name: "← All Privacy Requests" })).toHaveAttribute(
      "href",
      paths.admin.privacyRequests,
    );
  });

  it("is opened from the Privacy Requests list", async () => {
    signInAs(OWNER);
    render(await UsersPage({ searchParams: Promise.resolve({ tab: "privacy-requests" }) }));

    const list = screen.getByRole("region", { name: "Privacy Requests" });
    expect(
      within(list).getByRole("link", { name: "DELETION · tester@example.com" }),
    ).toHaveAttribute("href", paths.admin.privacyRequest(deletion));
  });

  it("sends an Editor to the 403 screen", async () => {
    signInAs(EDITOR);
    await expect(requestPage(copy)).rejects.toThrow(
      "NEXT_REDIRECT /admin/denied?reason=owners-only",
    );
  });

  it("sends someone signed out to sign-in, coming back to the request", async () => {
    await expect(requestPage(copy)).rejects.toThrow(
      `NEXT_REDIRECT ${paths.admin.signIn(paths.admin.privacyRequest(copy))}`,
    );
  });

  it("is a 404 for an id that isn't a request's", async () => {
    signInAs(OWNER);
    await expect(requestPage(crypto.randomUUID())).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(requestPage("not-an-id")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("downloading a Member's data", () => {
  it("gives an Owner the JSON file as an attachment that's never cached, and logs it", async () => {
    signInAs(OWNER);

    const response = await download(copy);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toMatch(
      new RegExp(
        `^attachment; filename="ayc-member-data-\\d{4}-\\d{2}-\\d{2}-${BEA.userId.slice(0, 8)}\\.json"$`,
      ),
    );
    const file = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(file).sort()).toEqual(
      [
        "format",
        "version",
        "exportedAt",
        "profile",
        "targetExams",
        "consents",
        "accessPasses",
        "cardMarks",
        "quizAttempts",
        "reviewerPagesViewed",
        "studyDays",
        "resume",
        "devices",
        "notices",
      ].sort(),
    );
    expect(file.profile).toMatchObject(BEA);
    expect(JSON.stringify(file)).not.toContain(SAM.email);
    expect(exported()).toEqual([expect.objectContaining({ entityId: copy })]);
  });

  it("refuses an Editor and someone signed out, logging nothing", async () => {
    signInAs(EDITOR);
    expect((await download(copy)).status).toBe(403);
    jar.clear();
    const signedOut = await download(copy);
    expect(signedOut.status).toBe(403);
    expect(signedOut.headers.get("cache-control")).toBe("no-store");
    expect(exported()).toEqual([]);
  });

  it("says why there's no file: a deletion request, an account already deleted, no such request", async () => {
    signInAs(OWNER);

    const notACopy = await download(deletion);
    expect(notACopy.status).toBe(409);
    expect(await notACopy.text()).toBe(NOT_A_DATA_COPY);

    expect((await download(crypto.randomUUID())).status).toBe(404);

    await deleteAccount(IDLE, { input: { requestId: deletion, confirmation: BEA.email } });
    const gone = await download(copy);
    expect(gone.status).toBe(409);
    expect(await gone.text()).toBe(ALREADY_DELETED);
  });
});

describe("the request's actions", () => {
  it("delete the account in sample mode, where there's no Supabase User, and mark the request done", async () => {
    signInAs(OWNER);

    const deleted = await deleteAccount(IDLE, {
      input: { requestId: deletion, confirmation: BEA.email },
    });

    expect(deleted).toMatchObject({ status: "saved", value: { status: "done", member: null } });
    expect(getSampleStore().members.map(({ userId }) => userId)).toEqual([SAM.userId]);
    expect(await latestConsent(BEA.userId)).toBeNull();
  });

  it("refuse a wrong typed email, and an Editor", async () => {
    signInAs(OWNER);
    expect(
      await deleteAccount(IDLE, { input: { requestId: deletion, confirmation: SAM.email } }),
    ).toMatchObject({ status: "refused", error: { kind: "invalid" } });

    signInAs(EDITOR);
    expect(
      await deleteAccount(IDLE, { input: { requestId: deletion, confirmation: BEA.email } }),
    ).toMatchObject({ status: "refused", error: { kind: "forbidden" } });
    expect(await markRequestDone(IDLE, { input: { requestId: copy } })).toMatchObject({
      status: "refused",
      error: { kind: "forbidden" },
    });
    expect(getSampleStore().members).toHaveLength(2);
  });

  it("mark a data copy done", async () => {
    signInAs(OWNER);
    expect(await markRequestDone(IDLE, { input: { requestId: copy } })).toMatchObject({
      status: "saved",
      value: { status: "done", doneBy: { email: OWNER } },
    });
  });
});
