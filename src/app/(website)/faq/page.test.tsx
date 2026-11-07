import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// The FAQ page rendered from the real seed with the Member App switch off and
// on (e2e/faq.spec.ts runs with it off only). JsonLd reads the request's CSP
// nonce, so it's replaced with a plain script tag here.
vi.mock("next/navigation", () => ({ usePathname: () => "/faq" }));
vi.mock("@/components/website/json-ld", () => ({
  JsonLd: ({ data }: { data: Record<string, unknown> }) => (
    <script type="application/ld+json">{JSON.stringify(data)}</script>
  ),
}));

async function renderPage(memberAppLive: boolean) {
  vi.stubEnv("MEMBER_APP_LIVE", memberAppLive ? "true" : "false");
  vi.resetModules();
  const { default: FaqPage } = await import("./page");
  return render(await FaqPage());
}

interface FaqPageJsonLd {
  "@type": string;
  mainEntity: { name: string; acceptedAnswer: { text: string } }[];
}

function faqJsonLd(): FaqPageJsonLd {
  const script = document.querySelector('script[type="application/ld+json"]');
  return JSON.parse(script?.textContent ?? "null") as FaqPageJsonLd;
}

/** An FAQ's accordion button. A popular chip has the same name but no aria-expanded. */
function faqButton(question: string, scope: HTMLElement = document.body): HTMLElement | undefined {
  return within(scope)
    .queryAllByRole("button", { name: question })
    .find((element) => element.hasAttribute("aria-expanded"));
}

const APP_QUESTIONS = [
  "Is there a digital version?",
  "Does my Plan renew automatically?",
  "Can I use my account on two devices?",
];

describe("FAQ page", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is titled and described, with its canonical URL", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata();
    expect(metadata.title).toBe("FAQ · shipping, paper, coverage");
    expect(metadata.description).toMatch(/^Answers to the questions reviewees always ask/);
    expect(metadata.alternates?.canonical).toBe("/faq");
    expect(metadata.openGraph).toMatchObject({ url: "/faq" });
  });

  it("counts the visible FAQs and shows the contact email", async () => {
    await renderPage(false);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Questions reviewees always ask",
    );
    expect(screen.getByText("FAQ · 15 answers")).toBeVisible();
    expect(screen.getAllByRole("link", { name: "aceyourcourseinc@gmail.com" })[0]).toHaveAttribute(
      "href",
      "mailto:aceyourcourseinc@gmail.com",
    );
  });

  it("leaves the Member App FAQs out of the page and its FAQPage data while the switch is off", async () => {
    const user = userEvent.setup();
    await renderPage(false);
    await user.click(screen.getByRole("button", { name: "Expand all" }));

    for (const question of APP_QUESTIONS) {
      expect(screen.queryByRole("button", { name: question })).not.toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { level: 2, name: "Buying" })).toBeVisible();
    expect(document.body.textContent).not.toMatch(
      /subscription|PayMongo|Billing page|here in the app/i,
    );
    const links = screen.getAllByRole("link").map((link) => link.getAttribute("href") ?? "");
    expect(links.filter((href) => href.startsWith("/app"))).toEqual([]);

    const jsonLd = faqJsonLd();
    expect(jsonLd.mainEntity).toHaveLength(15);
    expect(jsonLd.mainEntity.map((q) => q.name)).not.toEqual(
      expect.arrayContaining([APP_QUESTIONS[0]]),
    );
    expect(JSON.stringify(jsonLd)).not.toMatch(/PayMongo|Billing page/);
  });

  it("adds the Member App FAQs under Buying and the app while the switch is on", async () => {
    await renderPage(true);
    expect(screen.getByText("FAQ · 18 answers")).toBeVisible();
    const buying = screen.getByRole("region", { name: "Buying and the app" });
    for (const question of APP_QUESTIONS) {
      expect(faqButton(question, buying)).toBeVisible();
    }
    expect(faqJsonLd().mainEntity.map((q) => q.name)).toEqual(
      expect.arrayContaining(APP_QUESTIONS),
    );
  });

  it("has one FAQPage Question per visible FAQ, matching the page's text", async () => {
    const user = userEvent.setup();
    await renderPage(false);
    await user.click(screen.getByRole("button", { name: "Expand all" }));
    const jsonLd = faqJsonLd();
    expect(jsonLd["@type"]).toBe("FAQPage");
    for (const question of jsonLd.mainEntity) {
      const answerId = faqButton(question.name)?.getAttribute("aria-controls") ?? "";
      // toHaveTextContent collapses the page's whitespace, so collapse the answer's too.
      const answer = question.acceptedAnswer.text.replace(/\s+/g, " ");
      expect(document.getElementById(answerId)).toHaveTextContent(answer);
    }
  });

  it("links the coverage table to every Exam page", async () => {
    const user = userEvent.setup();
    await renderPage(false);
    await user.click(
      screen.getByRole("button", { name: "What subjects does each exam’s reviewer cover?" }),
    );
    const table = screen.getByRole("list", { name: "Subjects per exam" });
    expect(
      within(table)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/exams/ce", "/exams/me", "/exams/ee", "/exams/mt", "/exams/cpa"]);
  });
});
