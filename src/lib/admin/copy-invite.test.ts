import { afterEach, describe, expect, it, vi } from "vitest";

import { copyToClipboard, inviteMessage } from "./copy-invite";

// "Copy invite message" (spec, Phase 2 → Invites): no email is sent, so the
// Owner sends this text by hand. It names the Staff Role, the Admin address,
// the Google email to sign in with, and the day the Invite expires in Manila.
const SITE = "https://aceyourcourse.ph/";

describe("inviteMessage", () => {
  it("writes the whole message for an Editor", () => {
    expect(
      inviteMessage({
        role: "editor",
        email: "new.editor@example.com",
        expiresAt: "2026-11-07T04:00:00.000Z",
        siteUrl: SITE,
      }),
    ).toBe(
      "Hi! You've been added to the Ace Your Course Admin as an Editor. Open https://aceyourcourse.ph/admin, choose “Continue with Google” and sign in as new.editor@example.com. Please sign in by Sat, 7 Nov 2026, when the invite expires.",
    );
  });

  it("names the Owner Staff Role", () => {
    const message = inviteMessage({
      role: "owner",
      email: "owner.two@example.com",
      expiresAt: "2026-11-07T04:00:00.000Z",
      siteUrl: SITE,
    });
    expect(message).toContain("as an Owner. Open");
    expect(message).toContain("sign in as owner.two@example.com.");
  });

  it("dates the expiry in Manila, which is a day ahead of UTC late in the evening", () => {
    const at = (expiresAt: string) =>
      inviteMessage({ role: "editor", email: "a@example.com", expiresAt, siteUrl: SITE });
    // 15:59 UTC is 23:59 in Manila; 16:00 UTC is midnight, the next Manila day.
    expect(at("2026-11-06T15:59:00.000Z")).toContain("sign in by Fri, 6 Nov 2026,");
    expect(at("2026-11-06T16:00:00.000Z")).toContain("sign in by Sat, 7 Nov 2026,");
  });

  it("writes September as Sep", () => {
    const message = inviteMessage({
      role: "editor",
      email: "a@example.com",
      expiresAt: "2026-09-01T04:00:00.000Z",
      siteUrl: SITE,
    });
    expect(message).toContain("sign in by Tue, 1 Sep 2026,");
  });

  it("gives the Admin address whether or not the site URL ends in a slash", () => {
    for (const siteUrl of ["http://localhost:3000", "http://localhost:3000/"]) {
      const message = inviteMessage({
        role: "editor",
        email: "a@example.com",
        expiresAt: "2026-11-07T04:00:00.000Z",
        siteUrl,
      });
      expect(message).toContain("Open http://localhost:3000/admin, choose");
    }
  });

  it("throws a RangeError for an expiry that isn't a date", () => {
    expect(() =>
      inviteMessage({ role: "editor", email: "a@example.com", expiresAt: "soon", siteUrl: SITE }),
    ).toThrow(RangeError);
  });
});

describe("copyToClipboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const withClipboard = (writeText?: (text: string) => Promise<void>) =>
    vi.stubGlobal("navigator", { clipboard: writeText ? { writeText } : undefined });

  it("copies the text and says it worked", async () => {
    const writeText = vi.fn(async () => {});
    withClipboard(writeText);
    expect(await copyToClipboard("Hi!")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("Hi!");
  });

  it("says it didn't work when the browser refuses", async () => {
    withClipboard(async () => {
      throw new DOMException("Denied", "NotAllowedError");
    });
    expect(await copyToClipboard("Hi!")).toBe(false);
  });

  it("says it didn't work when there's no clipboard API, as on an insecure origin", async () => {
    withClipboard();
    expect(await copyToClipboard("Hi!")).toBe(false);
  });
});
