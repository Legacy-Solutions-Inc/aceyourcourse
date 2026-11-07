import { describe, expect, it } from "vitest";

import { visibleAnnouncement } from "./announcement";

const SHOP = { text: "Physical copies on Shopee", href: "/products", requiresMemberApp: false };
const APP = { text: "Digital reviewers in the app", href: "/app", requiresMemberApp: true };
const FAQ = { text: "Ships from Iloilo City", href: "/faq", requiresMemberApp: false };

describe("visibleAnnouncement", () => {
  it("drops the Member App messages while the switch is off, keeping the id", () => {
    expect(
      visibleAnnouncement({ id: "a1", messages: [SHOP, APP, FAQ] }, { memberAppLive: false }),
    ).toEqual({
      id: "a1",
      messages: [
        { text: "Physical copies on Shopee", href: "/products" },
        { text: "Ships from Iloilo City", href: "/faq" },
      ],
    });
  });

  it("keeps every message while the switch is on, under a new id so it shows again", () => {
    const visible = visibleAnnouncement(
      { id: "a1", messages: [SHOP, APP, FAQ] },
      { memberAppLive: true },
    );
    expect(visible.messages.map((m) => m.text)).toEqual([
      "Physical copies on Shopee",
      "Digital reviewers in the app",
      "Ships from Iloilo City",
    ]);
    expect(visible.id).not.toBe("a1");
  });

  it("keeps the id when the switch is on but no message needs the Member App", () => {
    expect(
      visibleAnnouncement({ id: "a1", messages: [SHOP, FAQ] }, { memberAppLive: true }).id,
    ).toBe("a1");
  });

  it("leaves nothing to show when every message needs the switch that is off", () => {
    expect(
      visibleAnnouncement({ id: "a1", messages: [APP] }, { memberAppLive: false }).messages,
    ).toEqual([]);
  });
});
