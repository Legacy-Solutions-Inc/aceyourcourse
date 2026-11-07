import { describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";

import { callAdminAction } from "./call-admin-action";

// Calling an Admin Server Action from the browser. A redirect from the Staff
// Guard is how Next signs someone out or sends them to the 403 screen, so it
// must reach Next; anything else that breaks the call is a failed save.
const REDIRECT = new Error("NEXT_REDIRECT");
vi.mock("next/navigation", () => ({
  unstable_rethrow: (error: unknown) => {
    if (error === REDIRECT) throw error;
  },
}));

type State = AdminActionState<string>;

describe("callAdminAction", () => {
  it("sends the submission, from idle unless told otherwise, and gives the answer", async () => {
    const action = vi.fn(async (): Promise<State> => ({ status: "saved", value: "ok" }));

    expect(await callAdminAction(action, { input: { id: "prd-001" } })).toEqual({
      status: "saved",
      value: "ok",
    });
    expect(action).toHaveBeenCalledWith({ status: "idle" }, { input: { id: "prd-001" } });

    const previous: State = { status: "failed" };
    await callAdminAction(action, { input: 1 }, previous);
    expect(action).toHaveBeenLastCalledWith(previous, { input: 1 });
  });

  it("answers failed when the call breaks down", async () => {
    const action = vi.fn(async (): Promise<State> => {
      throw new TypeError("Failed to fetch");
    });

    expect(await callAdminAction(action, { input: null })).toEqual({ status: "failed" });
  });

  it("lets a redirect from the Staff Guard through to Next", async () => {
    const action = vi.fn(async (): Promise<State> => {
      throw REDIRECT;
    });

    await expect(callAdminAction(action, { input: null })).rejects.toBe(REDIRECT);
  });
});
