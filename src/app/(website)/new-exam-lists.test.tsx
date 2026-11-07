import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogueSeed } from "@/services/catalogue.schema";
import { resetSampleStore } from "@/services/mock/sample-store";

import { UNUSED_EXAM } from "../../../test/admin-inputs";
import { editSampleCatalogue } from "../../../test/catalogue-seed";

// A new Exam in every Website list of Exams (ticket 23): once CHE, added
// last by an Owner, has a Live Product on the Website, it's last in the
// footer, Home's "Find your exam", the Products and Reviews filters, the FAQ
// coverage table and About. Each page is the real one, over the sample data.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("posthog-js", () => ({ default: { __loaded: true, capture: vi.fn() } }));
vi.mock("@/components/website/json-ld", () => ({ JsonLd: () => null }));

/** CHE with a Live Product on the Website: a copy of the CE cards, with no Reviews. */
function withLiveChe(seed: CatalogueSeed) {
  seed.exams.push(structuredClone(UNUSED_EXAM));
  const cards = seed.products.find((product) => product.id === "prd-001");
  if (!cards) throw new Error("the seed has no prd-001");
  seed.products.push({
    ...structuredClone(cards),
    id: "prd-che",
    slug: "che-formula-flash-cards",
    examCode: "CHE",
    title: "ChE Formula Flash Cards",
    shortName: "ChE Flash Cards",
    subjectCodes: ["PCHEM"],
  });
}

/** The page's links to Exam pages, in order. */
const examLinks = (scope: HTMLElement) =>
  within(scope)
    .queryAllByRole("link")
    .map((link) => link.getAttribute("href") ?? "")
    .filter((href) => href.startsWith("/exams/"));

beforeEach(() => {
  vi.stubEnv("MEMBER_APP_LIVE", "false");
  vi.resetModules();
  editSampleCatalogue(withLiveChe);
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetSampleStore();
});

describe("CHE, with a Live Product on the Website", () => {
  it("is last in the footer's Exams", async () => {
    const { SiteFooter } = await import("@/components/website/site-footer");
    render(await SiteFooter());
    expect(examLinks(screen.getByRole("contentinfo")).at(-1)).toBe("/exams/che");
  });

  it("is last in Home's Find your exam", async () => {
    const { default: HomePage } = await import("./page");
    render(await HomePage());
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent ?? "");
    expect(tabs.at(-1)).toMatch(/^CHE/);
  });

  it("is the last Exam chip on the Products and Reviews pages", async () => {
    const { default: ProductsPage } = await import("./products/page");
    const products = render(await ProductsPage({ searchParams: Promise.resolve({}) }));
    const chips = (name: RegExp) =>
      within(screen.getByRole("group", { name }))
        .getAllByRole("button")
        .map((chip) => chip.textContent ?? "");
    expect(chips(/exam/i).at(-1)).toMatch(/^CHE/);
    products.unmount();

    const { default: ReviewsPage } = await import("./reviews/page");
    render(await ReviewsPage({ searchParams: Promise.resolve({}) }));
    expect(chips(/exam/i).at(-1)).toMatch(/^CHE/);
  });

  it("is last in the FAQ's coverage table, with its Subjects", async () => {
    const user = userEvent.setup();
    const { default: FaqPage } = await import("./faq/page");
    render(await FaqPage());
    await user.click(
      screen.getByRole("button", { name: "What subjects does each exam’s reviewer cover?" }),
    );
    const table = screen.getByRole("list", { name: "Subjects per exam" });
    expect(examLinks(table).at(-1)).toBe("/exams/che");
    expect(within(table).getByText("Physical Chemistry")).toBeInTheDocument();
  });

  it("is last in About's Exams", async () => {
    const { default: AboutPage } = await import("./about/page");
    render(await AboutPage());
    const cta = screen.getByRole("region", {
      name: "Your turn. Find the reviewer for your board.",
    });
    expect(examLinks(cta).at(-1)).toBe("/exams/che");
  });
});
