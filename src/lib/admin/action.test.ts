import { revalidateTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { AdminResult, StaffActor } from "@/services/admin.types";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { adminAction, type AdminActionState } from "./action";

// adminAction builds every Admin Server Action (CONVENTIONS §3): the Staff
// Guard, then zod, then the seam, then revalidateTag for each tag the seam
// returns, and a plain result for useActionState. The cookie jar and
// redirect() are the framework boundary, so they are replaced; next/cache is
// the shared setup's spies.
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
}));

const OWNER: StaffActor = {
  email: "angel@aceyourcourse.ph",
  name: "Angel Rose L. Lepaña",
  role: "owner",
};
const EDITOR: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};
const signInAs = (actor: StaffActor | string) =>
  jar.set("ayc_admin_sample", typeof actor === "string" ? actor : actor.email);

const IDLE: AdminActionState<never> = { status: "idle" };
const schema = z.object({ title: z.string().trim().min(1, "ENTER A TITLE") });
const STAMP = { savedAt: "2026-10-22T03:42:00.000Z" };

type Saved = { title: string };
const saves = (value: Saved, tags: string[]) =>
  vi.fn(async (): Promise<AdminResult<Saved>> => ({ ok: true, value, tags }));

describe("adminAction", () => {
  beforeEach(() => {
    jar.clear();
    resetSampleStore();
    vi.mocked(revalidateTag).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("a save", () => {
    it("goes through the seam as the signed-in Staff User, then clears exactly the tags it returns", async () => {
      signInAs(OWNER);
      const handler = saves({ title: "Saved" }, ["catalogue:settings", "catalogue:products"]);
      const action = adminAction({ role: "owner", schema }, handler);

      const state = await action(IDLE, { input: { title: "  Saved " }, expected: STAMP });

      expect(state).toEqual({ status: "saved", value: { title: "Saved" } });
      expect(handler).toHaveBeenCalledWith(OWNER, { title: "Saved" }, STAMP);
      expect(vi.mocked(revalidateTag).mock.calls).toEqual([
        ["catalogue:settings"],
        ["catalogue:products"],
      ]);
    });

    it("passes no stamp when the submission has none, as a single toggle does", async () => {
      signInAs(EDITOR);
      const handler = saves({ title: "On" }, []);
      await adminAction({ role: "staff", schema }, handler)(IDLE, { input: { title: "On" } });

      expect(handler).toHaveBeenCalledWith(EDITOR, { title: "On" }, undefined);
      expect(revalidateTag).not.toHaveBeenCalled();
    });

    it("returns only plain data, ready to go back to the browser", async () => {
      signInAs(OWNER);
      const action = adminAction({ role: "owner", schema }, saves({ title: "Saved" }, ["x"]));
      const state = await action(IDLE, { input: { title: "Saved" } });

      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    });
  });

  describe("the Staff Guard comes first", () => {
    it("sends a signed-out caller to sign-in, whatever the input, and saves nothing", async () => {
      const handler = saves({ title: "x" }, ["catalogue"]);
      const action = adminAction({ role: "staff", schema }, handler);

      await expect(action(IDLE, { input: { title: "" } })).rejects.toThrow(
        "NEXT_REDIRECT /admin/sign-in?next=%2Fadmin",
      );
      expect(handler).not.toHaveBeenCalled();
      expect(revalidateTag).not.toHaveBeenCalled();
    });

    it("refuses a User who isn't Staff, recording the attempt", async () => {
      signInAs("juan.delacruz@gmail.com");
      const handler = saves({ title: "x" }, ["catalogue"]);

      await expect(
        adminAction({ role: "staff", schema }, handler)(IDLE, { input: { title: "x" } }),
      ).rejects.toThrow("NEXT_REDIRECT /admin/denied?reason=not-staff");
      expect(handler).not.toHaveBeenCalled();
      expect(getSampleStore().deniedSignIns).toHaveLength(1);
    });

    it("refuses an Editor an Owners-only action before reading the input", async () => {
      signInAs(EDITOR);
      const handler = saves({ title: "x" }, ["catalogue"]);
      const action = adminAction({ role: "owner", schema }, handler);

      expect(await action(IDLE, { input: { title: "" } })).toEqual({
        status: "refused",
        error: { kind: "forbidden", message: "ONLY AN OWNER CAN DO THIS" },
      });
      expect(handler).not.toHaveBeenCalled();
      expect(revalidateTag).not.toHaveBeenCalled();
    });
  });

  describe("refusals", () => {
    beforeEach(() => {
      signInAs(OWNER);
    });

    it("refuses invalid input with each field's message, without the seam or clearing anything", async () => {
      const handler = saves({ title: "x" }, ["catalogue"]);
      const state = await adminAction({ role: "owner", schema }, handler)(IDLE, {
        input: { title: "   " },
      });

      expect(state).toEqual({
        status: "refused",
        error: { kind: "invalid", fieldErrors: { title: ["ENTER A TITLE"] } },
      });
      expect(handler).not.toHaveBeenCalled();
      expect(revalidateTag).not.toHaveBeenCalled();
    });

    it.each([
      ["no submission at all", undefined],
      ["a stamp that isn't a time", { input: { title: "x" }, expected: { savedAt: "yesterday" } }],
    ])("refuses %s, asking for a reload", async (_case, submission) => {
      const handler = saves({ title: "x" }, ["catalogue"]);
      const action = adminAction({ role: "owner", schema }, handler);

      expect(await action(IDLE, submission as never)).toEqual({
        status: "refused",
        error: { kind: "invalid", fieldErrors: {}, formError: "RELOAD THE PAGE AND TRY AGAIN" },
      });
      expect(handler).not.toHaveBeenCalled();
    });

    it("returns the seam's refusal as it is, and clears nothing", async () => {
      const conflict = { kind: "conflict", savedBy: "Kim Reyes", savedAt: STAMP.savedAt } as const;
      const action = adminAction({ role: "owner", schema }, async () => ({
        ok: false,
        error: conflict,
      }));

      expect(await action(IDLE, { input: { title: "x" }, expected: STAMP })).toEqual({
        status: "refused",
        error: conflict,
      });
      expect(revalidateTag).not.toHaveBeenCalled();
    });

    it("reports a failed save, clearing nothing, when the seam throws", async () => {
      const logged = vi.spyOn(console, "error").mockImplementation(() => {});
      const action = adminAction({ role: "owner", schema }, async () => {
        throw new Error("connection reset");
      });

      expect(await action(IDLE, { input: { title: "x" } })).toEqual({ status: "failed" });
      expect(revalidateTag).not.toHaveBeenCalled();
      expect(logged).toHaveBeenCalled();
    });
  });

  describe("closed mode", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubEnv("NODE_ENV", "production");
      vi.resetModules();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it("refuses every action as not found", async () => {
      signInAs(OWNER);
      const { adminAction: closedAction } = await import("./action");
      const handler = saves({ title: "x" }, ["catalogue"]);

      await expect(
        closedAction({ role: "owner", schema }, handler)(IDLE, { input: { title: "x" } }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
