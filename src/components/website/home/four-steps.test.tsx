import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FourSteps } from "./four-steps";

// "Four steps to your reviewer" (docs/mockup/website/Home_v2.dc.html L66–84,
// L317–321). With the Member App switch off, no step mentions or links to the
// app; with it on, the steps are the mockup's.

const section = () => screen.getByRole("region", { name: "Four steps to your reviewer" });
const steps = () => within(section()).getAllByRole("listitem");
const titles = () => steps().map((step) => within(step).getByRole("heading").textContent);
const links = () =>
  within(section())
    .getAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")]);

describe("FourSteps", () => {
  it("never mentions or links to the app while the switch is off", () => {
    render(<FourSteps memberAppLive={false} />);
    expect(steps()).toHaveLength(4);
    expect(section()).not.toHaveTextContent(/\bapp\b/i);
    expect(section().querySelector('a[href^="/app"]')).toBeNull();
    expect(titles()).toEqual([
      "Pick your board exam",
      "Choose your format",
      "Review anywhere",
      "Order from our official stores",
    ]);
    expect(links()).toEqual([
      ["Find your exam", "#exams"],
      ["Compare formats", "#formats"],
      ["See reviews", "#reviews"],
      ["Browse all reviewers", "/products"],
    ]);
    expect(section()).toHaveTextContent("Shopee, Lazada or TikTok Shop, shipped from Iloilo City.");
  });

  it("shows the mockup's steps, with See app plans, while the switch is on", () => {
    render(<FourSteps memberAppLive />);
    expect(titles()).toEqual([
      "Pick your board exam",
      "Choose physical, app, or both",
      "Review anywhere",
      "Watch anywhere",
    ]);
    expect(links()).toEqual([
      ["Find your exam", "#exams"],
      ["Compare formats", "#formats"],
      ["See reviews", "#reviews"],
      ["See app plans", "/app/plans"],
    ]);
    expect(section()).toHaveTextContent("a countdown to your exam date in the app");
  });

  it("numbers the steps 01 to 04 in an ordered list", () => {
    render(<FourSteps memberAppLive={false} />);
    expect(within(section()).getByRole("list").tagName).toBe("OL");
    expect(steps().map((step) => step.textContent?.slice(0, 2))).toEqual(["01", "02", "03", "04"]);
  });
});
