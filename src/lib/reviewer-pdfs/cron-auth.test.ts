// @vitest-environment node
import { describe, expect, it } from "vitest";

import { cronAccess } from "./cron-auth";

// Who may call the Reviewer PDF job's endpoints (ticket 12): Vercel Cron and
// the job's own runs, which send `Authorization: Bearer <CRON_SECRET>`.

const SECRET = "0123456789abcdef0123456789abcdef";

describe("cronAccess", () => {
  it("lets in a caller with the secret", () => {
    expect(cronAccess(`Bearer ${SECRET}`, SECRET)).toBe("allowed");
  });

  it("refuses a caller without it, or with the wrong one", () => {
    expect(cronAccess(null, SECRET)).toBe("refused");
    expect(cronAccess("", SECRET)).toBe("refused");
    expect(cronAccess(SECRET, SECRET)).toBe("refused");
    expect(cronAccess(`Bearer ${SECRET.slice(1)}`, SECRET)).toBe("refused");
    expect(cronAccess(`Bearer ${SECRET}x`, SECRET)).toBe("refused");
    expect(cronAccess(`bearer ${SECRET}`, SECRET)).toBe("refused");
    expect(cronAccess(`Basic ${SECRET}`, SECRET)).toBe("refused");
  });

  it("lets no one in while the server has no secret, not even an empty one", () => {
    expect(cronAccess(`Bearer ${SECRET}`, undefined)).toBe("no-secret");
    expect(cronAccess("Bearer ", undefined)).toBe("no-secret");
    expect(cronAccess(null, undefined)).toBe("no-secret");
  });
});
