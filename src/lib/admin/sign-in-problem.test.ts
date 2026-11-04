import { describe, expect, it } from "vitest";

import { PASSWORD_PROBLEMS, passwordProblem } from "./sign-in-problem";

// What the development password box says when Supabase refuses a sign-in
// (ticket 19), by Supabase's error code.

describe("passwordProblem", () => {
  it.each([
    [{ code: "invalid_credentials", status: 400 }, "That email and password don't match."],
    [
      { code: "over_request_rate_limit", status: 429 },
      "Too many tries. Wait a minute and try again.",
    ],
    [{ status: 429 }, "Too many tries. Wait a minute and try again."],
    [{ code: "email_provider_disabled", status: 400 }, "Password sign-in is off on this project."],
    [
      { code: "email_not_confirmed", status: 400 },
      "This email isn't confirmed. Confirm the User in the Supabase dashboard, then try again.",
    ],
    [{ code: "unexpected_failure", status: 500 }, "Sign-in didn't finish. Try again."],
    [{}, "Sign-in didn't finish. Try again."],
  ])("says %j as %j", (error, message) => {
    expect(PASSWORD_PROBLEMS[passwordProblem(error)]).toBe(message);
  });

  it("says a wrong email and a wrong password the same way", () => {
    expect(PASSWORD_PROBLEMS.unreachable).toBe(
      "Sign-in isn't answering right now. Try again in a minute.",
    );
    expect(passwordProblem({ code: "invalid_credentials" })).toBe("mismatch");
  });
});
