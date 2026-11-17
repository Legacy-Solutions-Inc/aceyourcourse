import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import { getOrCreateMember } from "@/services/member.mock";
import { sampleTopicId } from "@/services/mock/content";
import { sampleUserId } from "@/services/mock/members";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { addTopic, moveTopicInSubject, removeTopic, saveTopicName } from "./actions";
import ContentPage from "./page";

// Member App content → a Subject's Topics (Phase 3, ticket 05; story 133n),
// on sample data: the page as a browser loads it, and its Server Actions as a
// browser sends them. Every Admin action's refusals for signed-out visitors,
// non-Staff and closed mode are in actions.permissions.test.ts; the seam's
// rules in admin.topics.test.ts.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/admin/content",
  useRouter: () => ({ refresh: () => {}, replace: () => {} }),
  unstable_rethrow: () => {},
}));

const IDLE: AdminActionState<never> = { status: "idle" };
const EDITOR = "content@aceyourcourse.ph";
const TESTER = "tester@example.com";
const SURVEYING = sampleTopicId("CE", "MSTC", "Surveying");
const SIMPLE_CURVES = sampleTopicId("CE", "MSTC", "Simple Curves");

const signInAs = (email: string) => jar.set("ayc_admin_sample", email);
const renderPage = async (params: Record<string, string> = {}) =>
  render(await ContentPage({ searchParams: Promise.resolve(params) }));
const topicNames = () =>
  within(screen.getByRole("list", { name: /Topics$/ }))
    .getAllByRole("heading", { level: 3 })
    .map((h) => h.textContent);

beforeEach(() => {
  jar.clear();
  resetSampleStore();
});

describe("the Member App content page", () => {
  it("opens an Editor on the first Exam and its first Subject's Topics", async () => {
    signInAs(EDITOR);
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Member App content" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Exam" })).getByRole("link", { name: "CE" }),
    ).toHaveAttribute("aria-current", "page");
    const subjects = screen.getByRole("list", { name: "Subject" });
    expect(
      within(subjects)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["MSTC", "HPGE", "PSAD"]);
    expect(within(subjects).getByRole("link", { name: "HPGE" })).toHaveAttribute(
      "href",
      "/admin/content?exam=ce&subject=hpge",
    );
    expect(screen.getByRole("heading", { name: "CE · MSTC · TOPICS" })).toBeInTheDocument();
    expect(topicNames()).toEqual(["Simple Curves", "Spiral Curves", "Surveying", "Algebra"]);
  });

  it("opens the Exam and Subject the address names, in any case", async () => {
    signInAs(EDITOR);
    await renderPage({ exam: "ce", subject: "hpge" });
    expect(topicNames()).toEqual(["Hydrostatics", "Soil Mechanics", "Fluid Properties"]);
  });

  it("opens the first Subject for one the Exam doesn't have", async () => {
    signInAs(EDITOR);
    await renderPage({ exam: "me", subject: "mstc" });
    expect(screen.getByRole("heading", { name: "ME · PIP · TOPICS" })).toBeInTheDocument();
    expect(screen.getByText("No Topics in PIP yet. Add the first one below.")).toBeInTheDocument();
  });

  it("sends someone signed out to sign in, and a Member who isn't Staff to the 403 screen", async () => {
    await expect(renderPage()).rejects.toThrow(
      "NEXT_REDIRECT /admin/sign-in?next=%2Fadmin%2Fcontent",
    );
    signInAs(TESTER);
    await expect(renderPage()).rejects.toThrow("NEXT_REDIRECT /admin/denied");
  });
});

describe("the Topics actions", () => {
  it("lets an Editor add, rename, move and delete an empty Topic", async () => {
    signInAs(EDITOR);

    expect(
      await addTopic(IDLE, { input: { exam: "ce", subject: "mstc", name: "Highways" } }),
    ).toMatchObject({ status: "saved", value: { name: "Highways", position: 5 } });
    expect(
      await saveTopicName(IDLE, {
        input: { id: SURVEYING, name: "Leveling" },
        expected: { savedAt: getSampleStore().bootedAt },
      }),
    ).toMatchObject({ status: "saved", value: { name: "Leveling" } });
    expect(
      await moveTopicInSubject(IDLE, { input: { id: SURVEYING, direction: "up" } }),
    ).toMatchObject({ status: "saved" });
    expect(await removeTopic(IDLE, { input: { id: SURVEYING } })).toMatchObject({
      status: "saved",
    });
    expect(getSampleStore().staffActivity.map((entry) => [entry.entity, entry.action])).toEqual([
      ["topic", "add"],
      ["topic", "rename"],
      ["topic", "move"],
      ["topic", "delete"],
    ]);
  });

  it("refuses to delete a Topic with content, saying why", async () => {
    signInAs(EDITOR);
    expect(await removeTopic(IDLE, { input: { id: SIMPLE_CURVES } })).toEqual({
      status: "refused",
      error: {
        kind: "invalid",
        fieldErrors: {},
        formError: "It has a deck, a quiz and a Reviewer PDF. Only an empty Topic can be deleted.",
      },
    });
  });

  it("refuses a rename sent without the stamp its form opened with", async () => {
    signInAs(EDITOR);
    expect(await saveTopicName(IDLE, { input: { id: SURVEYING, name: "Leveling" } })).toMatchObject(
      {
        status: "refused",
        error: { kind: "invalid", formError: "RELOAD THE PAGE AND TRY AGAIN" },
      },
    );
  });

  it("refuses a Member who isn't Staff, changing nothing", async () => {
    await getOrCreateMember({ userId: sampleUserId(TESTER), email: TESTER, name: "Bea Tester" });
    signInAs(TESTER);
    const before = JSON.stringify(getSampleStore().topics);

    for (const post of [
      () => addTopic(IDLE, { input: { exam: "ce", subject: "mstc", name: "Highways" } }),
      () => moveTopicInSubject(IDLE, { input: { id: SURVEYING, direction: "up" } }),
      () => removeTopic(IDLE, { input: { id: SURVEYING } }),
    ]) {
      await expect(post()).rejects.toThrow("NEXT_REDIRECT /admin/denied");
    }
    expect(JSON.stringify(getSampleStore().topics)).toBe(before);
    expect(getSampleStore().staffActivity).toEqual([]);
  });
});
