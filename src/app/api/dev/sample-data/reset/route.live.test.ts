// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// POST /api/dev/sample-data/reset in live mode (ticket 16): CI runs the Admin
// e2e live, on the runner's local Supabase, and re-seeds it before each test.
// So the route keeps working on a local database outside production, for a
// signed-in Staff User only. Anywhere else it doesn't exist. The Guard and
// the restore are replaced: what's checked here is who gets through.
const { getStaff, restoreSampleData } = vi.hoisted(() => ({
  getStaff: vi.fn(),
  restoreSampleData: vi.fn(),
}));
vi.mock("@/lib/admin/mode", () => ({ adminMode: "live" }));
vi.mock("@/lib/admin/guard", () => ({ getStaff }));
vi.mock("@/lib/admin/sample-data", () => ({ restoreSampleData }));

const LOCAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const HOSTED =
  "postgresql://postgres.abc:pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";
const OWNER = { email: "angel@aceyourcourse.ph", name: "Angel Rose L. Lepaña", role: "owner" };

async function post(env: { DATABASE_URL: string; NODE_ENV?: string }) {
  vi.stubEnv("DATABASE_URL", env.DATABASE_URL);
  vi.stubEnv("NODE_ENV", env.NODE_ENV ?? "development");
  vi.resetModules();
  const { POST } = await import("./route");
  return POST(new Request("http://localhost:3000/api/dev/sample-data/reset", { method: "POST" }));
}

describe("POST /api/dev/sample-data/reset (live mode)", () => {
  beforeEach(() => {
    restoreSampleData.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("re-seeds a local database for a signed-in Staff User", async () => {
    getStaff.mockResolvedValue(OWNER);

    expect((await post({ DATABASE_URL: LOCAL })).status).toBe(204);
    expect(restoreSampleData).toHaveBeenCalledTimes(1);
  });

  it("refuses anyone signed out or not Staff, changing nothing", async () => {
    getStaff.mockResolvedValue(null);

    expect((await post({ DATABASE_URL: LOCAL })).status).toBe(401);
    expect(restoreSampleData).not.toHaveBeenCalled();
  });

  it("answers 404 for a database that isn't local, even to the Owner", async () => {
    getStaff.mockResolvedValue(OWNER);

    expect((await post({ DATABASE_URL: HOSTED })).status).toBe(404);
    expect(getStaff).not.toHaveBeenCalled();
    expect(restoreSampleData).not.toHaveBeenCalled();
  });

  it("answers 404 in production, even on a local database", async () => {
    getStaff.mockResolvedValue(OWNER);

    expect((await post({ DATABASE_URL: LOCAL, NODE_ENV: "production" })).status).toBe(404);
    expect(restoreSampleData).not.toHaveBeenCalled();
  });
});
