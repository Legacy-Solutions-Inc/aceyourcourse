import { describe, expect, it } from "vitest";

import { fieldErrorsOf, passwordSignInSchema, websiteSettingsUpdateSchema } from "./admin.schema";

// The Settings schema reads what the form sends, which is text, as well as the
// typed values the seam receives, so the Server Action and the seam parse with
// one schema. The seam's suite (admin.settings.test.ts) covers each rule.

const parse = (input: unknown) => websiteSettingsUpdateSchema.safeParse(input);
const errors = (input: unknown) => {
  const result = parse(input);
  return result.success ? {} : fieldErrorsOf(result.error);
};

describe("websiteSettingsUpdateSchema, from the form's text", () => {
  it("reads the trust figures' numbers, with or without thousands commas", () => {
    expect(
      parse({ shopStats: { rating: " 4.9 ", ratingCount: "1,234", followers: " 3.8K " } }),
    ).toEqual({
      success: true,
      data: { shopStats: { rating: 4.9, ratingCount: 1234, followers: "3.8K" } },
    });
  });

  it.each(["", "  ", "abc", "4,8", "4.9★", "0x4"])("refuses the rating %j", (rating) => {
    expect(errors({ shopStats: { rating, ratingCount: "1", followers: "1" } })).toEqual({
      "shopStats.rating": ["ENTER A RATING FROM 0 TO 5, WITH ONE DECIMAL AT MOST"],
    });
  });

  it.each(["", "1.2k", "-1", "1.5", "0x10"])("refuses the number of ratings %j", (ratingCount) => {
    expect(errors({ shopStats: { rating: "4.8", ratingCount, followers: "1" } })).toEqual({
      "shopStats.ratingCount": ["ENTER A WHOLE NUMBER, 0 OR MORE"],
    });
  });

  it("reads an empty link as no link", () => {
    expect(
      parse({
        shopLinks: { shopee: "", lazada: " ", tiktok: "vt.tiktok.com/ZS49ve6cu/" },
        socialLinks: { tiktok: "", facebook: "", instagram: "" },
      }),
    ).toEqual({
      success: true,
      data: {
        shopLinks: { shopee: null, lazada: null, tiktok: "https://vt.tiktok.com/ZS49ve6cu/" },
        socialLinks: { tiktok: null, facebook: null, instagram: null },
      },
    });
  });

  it("refuses a links part that is missing a link, rather than clearing it", () => {
    expect(errors({ shopLinks: { shopee: "shopee.ph/aceyourcourse" } })).toEqual({
      "shopLinks.lazada": ["SHOULD BE A LAZADA.COM.PH LINK"],
      "shopLinks.tiktok": ["SHOULD BE A TIKTOK LINK"],
    });
  });

  it("gives the same answer when it parses its own output again", () => {
    const input = {
      contactEmail: " hello@aceyourcourse.ph ",
      shopLinks: { shopee: "shopee.ph/aceyourcourse", lazada: "", tiktok: "" },
      socialLinks: { tiktok: "tiktok.com/@aceyourcourse", facebook: "", instagram: "" },
      shopStats: { rating: "4.9", ratingCount: "900", followers: "3.8K" },
    };
    const once = parse(input);
    if (!once.success) throw new Error("the form's input should parse");
    expect(parse(once.data)).toEqual(once);
  });
});

// The development password box (ticket 19): one message per empty field, the
// typed-email message for a malformed one. The password is taken as typed.
describe("passwordSignInSchema", () => {
  const signInErrors = (input: unknown) => {
    const result = passwordSignInSchema.safeParse(input);
    return result.success ? {} : fieldErrorsOf(result.error);
  };

  it("takes a typed email, trimmed, and the password exactly as typed", () => {
    expect(
      passwordSignInSchema.parse({ email: " angel@aceyourcourse.ph ", password: " pass word " }),
    ).toEqual({ email: "angel@aceyourcourse.ph", password: " pass word " });
  });

  it.each([
    [
      { email: "", password: "" },
      { email: ["Enter your email"], password: ["Enter your password"] },
    ],
    [{ email: "   ", password: "x" }, { email: ["Enter your email"] }],
    [{}, { email: ["Enter your email"], password: ["Enter your password"] }],
    [
      { email: "angel@", password: "x" },
      { email: ["Enter a valid email address, like name@example.com."] },
    ],
  ])("refuses %j", (input, expected) => {
    expect(signInErrors(input)).toEqual(expected);
  });
});
