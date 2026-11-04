// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

// The OAuth callback (ticket 16): Google comes back here with a PKCE `code`.
// The callback exchanges it for a session, signs in through the Staff Guard,
// and lands on `next`, sanitised to an Admin path as the sign-in screen does
// (ticket 01). Without a code, or with one Supabase refuses, it goes back to
// sign-in saying so. The identity module (Supabase) and the Guard are the
// boundary here, so both are replaced.
const { finishGoogleSignIn, continueSignIn } = vi.hoisted(() => ({
  finishGoogleSignIn: vi.fn(),
  continueSignIn: vi.fn(),
}));
vi.mock("@/lib/admin/identity", () => ({ finishGoogleSignIn }));
vi.mock("@/lib/admin/guard", () => ({ continueSignIn }));

const ORIGIN = "http://localhost:3000";
const OWNER = { email: "angel@aceyourcourse.ph", name: "Angel Rose L. Lepaña", role: "owner" };

async function callback(query: string) {
  const response = await GET(new Request(`${ORIGIN}/auth/callback${query}`));
  const location = new URL(response.headers.get("location") ?? "");
  return { location, path: `${location.pathname}${location.search}` };
}

describe("GET /auth/callback", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("exchanges the code, signs in through the Guard, and lands on `next`", async () => {
    finishGoogleSignIn.mockResolvedValue(true);
    continueSignIn.mockResolvedValue({ status: "staff", actor: OWNER });

    const { location, path } = await callback(
      `?code=valid&next=${encodeURIComponent("/admin/products?product=prd-005")}`,
    );

    expect(finishGoogleSignIn).toHaveBeenCalledWith("valid");
    expect(continueSignIn).toHaveBeenCalledTimes(1);
    expect(location.origin).toBe(ORIGIN);
    expect(path).toBe("/admin/products?product=prd-005");
  });

  it("lands on the Overview with no `next`", async () => {
    finishGoogleSignIn.mockResolvedValue(true);
    continueSignIn.mockResolvedValue({ status: "staff", actor: OWNER });

    expect((await callback("?code=valid")).path).toBe("/admin");
  });

  it.each([
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash URL", "/\\evil.example"],
    ["an absolute URL", "https://evil.example/admin"],
    ["another Surface", "/products"],
    ["a climb out of the Admin", "/admin/../app"],
    ["the sign-in screen itself", "/admin/sign-in"],
  ])("lands on the Overview, on this origin, for %s in `next`", async (_label, next) => {
    finishGoogleSignIn.mockResolvedValue(true);
    continueSignIn.mockResolvedValue({ status: "staff", actor: OWNER });

    const { location, path } = await callback(`?code=valid&next=${encodeURIComponent(next)}`);

    expect(location.origin).toBe(ORIGIN);
    expect(path).toBe("/admin");
  });

  it.each([
    ["there is no code", "?next=%2Fadmin%2Fproducts"],
    ["the code is empty", "?code=&next=%2Fadmin%2Fproducts"],
    ["Google sent an error instead", "?error=access_denied&next=%2Fadmin%2Fproducts"],
  ])("returns to sign-in saying it didn't finish when %s", async (_label, query) => {
    const { path } = await callback(query);

    expect(finishGoogleSignIn).not.toHaveBeenCalled();
    expect(continueSignIn).not.toHaveBeenCalled();
    expect(path).toBe("/admin/sign-in?next=%2Fadmin%2Fproducts&error=callback");
  });

  it("returns to sign-in saying it didn't finish when Supabase refuses the code", async () => {
    finishGoogleSignIn.mockResolvedValue(false);

    const { path } = await callback("?code=expired");

    expect(continueSignIn).not.toHaveBeenCalled();
    expect(path).toBe("/admin/sign-in?next=%2Fadmin&error=callback");
  });

  it("returns to sign-in saying why when Google didn't verify the email", async () => {
    finishGoogleSignIn.mockResolvedValue(true);
    continueSignIn.mockResolvedValue({ status: "unverified" });

    expect((await callback("?code=valid")).path).toBe(
      "/admin/sign-in?next=%2Fadmin&error=unverified",
    );
  });

  it("returns to sign-in when the session didn't stick", async () => {
    finishGoogleSignIn.mockResolvedValue(true);
    continueSignIn.mockResolvedValue({ status: "signed-out" });

    expect((await callback("?code=valid")).path).toBe(
      "/admin/sign-in?next=%2Fadmin&error=callback",
    );
  });

  it("lets the Guard's refusal through: a User who isn't Staff goes to the 403 screen", async () => {
    finishGoogleSignIn.mockResolvedValue(true);
    continueSignIn.mockRejectedValue(new Error("NEXT_REDIRECT /admin/denied?reason=not-staff"));

    await expect(callback("?code=valid")).rejects.toThrow("/admin/denied?reason=not-staff");
  });
});
