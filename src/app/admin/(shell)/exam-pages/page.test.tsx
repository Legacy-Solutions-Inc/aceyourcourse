import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { emptyAbout } from "@/lib/catalogue/about-content";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { withUnusedExam } from "../../../../../test/admin-inputs";
import { editSampleCatalogue } from "../../../../../test/catalogue-seed";
import ExamPagesPage from "./page";

// Pages & promo, rendered from the sample data with its page, Exam or Site
// page, and section read from the URL. The cookie jar and the router are the framework
// boundary, so they are replaced.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/admin/exam-pages",
  useRouter: () => ({ refresh: () => {}, replace: () => {} }),
  unstable_rethrow: () => {},
}));

type Params = Record<string, string | string[] | undefined>;

async function renderPage(params: Params = {}) {
  return render(await ExamPagesPage({ searchParams: Promise.resolve(params) }));
}

const pages = () => screen.getByRole("navigation", { name: "Pages" });
const column = (code: string) => screen.getByRole("region", { name: `${code} Exam page` });
const editor = () => screen.getByRole("complementary", { name: "Exam page editor" });
const sectionRows = (code: string) =>
  within(column(code))
    .getAllByRole("listitem")
    .filter((item) =>
      within(item).queryByRole("link", { name: /^(Header|Subjects|Reviewers|Bundle|Reviews)/ }),
    );
/** An SEO panel's "Set up automatically" list, each thing with how it's set up. */
const setUpAutomatically = (panel: HTMLElement) =>
  within(panel)
    .getAllByRole("term")
    .map((term) => [term.textContent, term.nextElementSibling?.textContent]);

describe("Pages & promo", () => {
  beforeEach(() => {
    jar.clear();
    resetSampleStore();
    jar.set("ayc_admin_sample", "content@aceyourcourse.ph");
  });

  it("lists PAGES with the fixed note, the Exam pages selected", async () => {
    await renderPage();
    expect(
      within(pages())
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Exam pages× 5", "Site pages× 5", "Home promo banner", "Announcement bar"]);
    expect(within(pages()).getByRole("link", { name: /^Exam pages/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(pages()).getByText(
        "Menu, footer, and legal pages are fixed. Changes to those go through the developer.",
      ),
    ).toBeInTheDocument();
  });

  it("opens the first Exam's Header with the chips, View page ↗ and the visibility card", async () => {
    await renderPage();
    const ce = column("CE");
    const chips = within(within(ce).getByRole("list", { name: "Exam" }));
    expect(chips.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "CE",
      "ME",
      "EE",
      "MT",
      "CPA",
    ]);
    expect(chips.getByRole("link", { name: "CE" })).toHaveAttribute("aria-current", "page");
    expect(chips.getByRole("link", { name: "ME" })).toHaveAttribute(
      "href",
      "/admin/exam-pages?exam=me",
    );
    expect(within(ce).getByRole("link", { name: /^View page/ })).toHaveAttribute(
      "href",
      "/exams/ce",
    );
    // CE's generated title and description both fit: GOOD.
    expect(within(ce).getByRole("link", { name: /^Search & AI visibility/ })).toHaveTextContent(
      "GOOD",
    );
    expect(within(ce).getByRole("link", { name: /^Official Exam Date/ })).toHaveTextContent(
      "NOT SET",
    );
    expect(within(editor()).getByRole("heading")).toHaveTextContent("EDIT · HEADER · CE");
    expect(within(editor()).getByLabelText("EXAM NAME")).toHaveValue("Civil Engineering");
  });

  it("shows ME's sections: Header and Reviewers always on, the rest as switches", async () => {
    await renderPage({ exam: "me" });
    const rows = sectionRows("ME");
    expect(rows.map((row) => row.textContent)).toEqual([
      "HeaderName, text, imageALWAYS ON",
      "Subjects covered3 subjects",
      "ReviewersEvery ME productALWAYS ON",
      "Bundle offerNo offer set · HIDDEN ON SITE",
      "ReviewsFrom ME products",
    ]);
    const switches = within(column("ME")).getAllByRole("switch");
    expect(
      switches.map((s) => [s.getAttribute("aria-label"), s.getAttribute("aria-checked")]),
    ).toEqual([
      ["Show Subjects covered on the ME page", "true"],
      ["Show Bundle offer on the ME page", "false"],
      ["Show Reviews on the ME page", "true"],
    ]);
  });

  it("shows the first Exam for an unknown ?exam", async () => {
    await renderPage({ exam: "xx" });
    expect(column("CE")).toBeInTheDocument();
  });

  it("opens Subjects covered with each code read-only and its name editable", async () => {
    await renderPage({ exam: "ce", section: "subjects" });
    expect(within(editor()).getByRole("heading")).toHaveTextContent("EDIT · SUBJECTS COVERED · CE");
    expect(within(editor()).getByLabelText("01 · MSTC")).toHaveValue(
      "Mathematics, Surveying & Transportation Engineering",
    );
    expect(within(editor()).getAllByRole("textbox")).toHaveLength(3);
  });

  it("opens the bundle offer with the CE Products to choose from", async () => {
    await renderPage({ exam: "ce", section: "bundle" });
    const product = within(editor()).getByLabelText("PRODUCT");
    expect(product).toHaveDisplayValue("CE Review Bundle 3-in-1");
    expect(
      within(product)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual([
      "No offer",
      "CE Formula Flash Cards",
      "Ultimate CE Posters 2.0",
      "CE Review Bundle 3-in-1",
      "CE Solving Notebook · COMING SOON",
    ]);
    expect(within(editor()).getByLabelText("HEADLINE")).toHaveValue("CE Review Bundle 3-in-1");
    expect(within(editor()).getByLabelText("BUTTON LABEL")).toHaveValue("See the bundle");
  });

  it("opens Search & AI visibility with the address, the generated text as placeholders, and the counters", async () => {
    await renderPage({ exam: "ce", section: "seo" });
    expect(within(editor()).getByText("SEARCH & AI VISIBILITY · EXAM PAGES · CE")).toBeVisible();
    expect(within(editor()).getAllByText("aceyourcourse.ph/exams/ce")).toHaveLength(2);
    const title = within(editor()).getByLabelText("PAGE TITLE");
    expect(title).toHaveValue("");
    expect(title).toHaveAttribute("placeholder", "CELE Reviewer · Civil Engineering");
    // "CELE Reviewer · Civil Engineering · Ace Your Course"
    expect(title).toHaveAccessibleDescription("51 / 60 characters, with the site name");
    expect(setUpAutomatically(editor())).toEqual([
      ["Breadcrumbs", "ON"],
      ["Summary for AI assistants", "ON"],
      ["Sitemap", "AUTO"],
    ]);
    expect(within(editor()).getByLabelText("SHARE IMAGE · 1200 × 630")).toHaveAccessibleDescription(
      "Uses the site’s share image",
    );
  });

  it("says HIDDEN ON SITE over a hidden section's editor", async () => {
    const ce = getSampleStore().catalogue.examPages.find((page) => page.examCode === "CE");
    if (!ce) throw new Error("the seed has no CE page");
    ce.sections.reviews = false;
    await renderPage({ exam: "ce", section: "reviews" });
    expect(within(editor()).getByText("HIDDEN ON SITE")).toBeInTheDocument();
    expect(within(editor()).getByRole("link", { name: /^Reviews/ })).toHaveAttribute(
      "href",
      "/admin/reviews?exam=ce",
    );
  });

  it("shows CHECK while the description is under 80 characters", async () => {
    const ce = getSampleStore().catalogue.examPages.find((page) => page.examCode === "CE");
    if (!ce) throw new Error("the seed has no CE page");
    ce.seoDescription = "d".repeat(70);
    await renderPage({ exam: "ce" });
    expect(
      within(column("CE")).getByRole("link", { name: /^Search & AI visibility/ }),
    ).toHaveTextContent("CHECK");
  });

  describe("Site pages", () => {
    const siteColumn = (label: string) =>
      screen.getByRole("region", { name: `${label} Site page` });
    const siteEditor = () => screen.getByRole("complementary", { name: "Site page editor" });

    it("opens Home by default, with the chips, View page ↗ and Search & AI visibility", async () => {
      await renderPage({ page: "site" });
      expect(within(pages()).getByRole("link", { current: "page" })).toHaveTextContent(
        "Site pages",
      );
      expect(within(pages()).getByRole("link", { name: /^Site pages/ })).toHaveAttribute(
        "href",
        "/admin/exam-pages?page=site&site=home",
      );
      const home = siteColumn("HOME");
      const chips = within(within(home).getByRole("list", { name: "Site page" }));
      expect(chips.getAllByRole("link").map((link) => link.textContent)).toEqual([
        "HOME",
        "ABOUT",
        "PRODUCTS",
        "FAQ",
        "REVIEWS",
      ]);
      expect(chips.getByRole("link", { name: "HOME" })).toHaveAttribute("aria-current", "page");
      expect(chips.getByRole("link", { name: "FAQ" })).toHaveAttribute(
        "href",
        "/admin/exam-pages?page=site&site=faq",
      );
      expect(within(home).getByRole("link", { name: /^View page/ })).toHaveAttribute("href", "/");
      expect(
        within(siteEditor()).getByText("SEARCH & AI VISIBILITY · SITE PAGES · HOME"),
      ).toBeVisible();
      // Home's address is the site root, in the field and in the preview.
      expect(within(siteEditor()).getAllByText("aceyourcourse.ph/")).toHaveLength(2);
    });

    it("opens ABOUT's search settings with today's text as the placeholders, the counters and the share image", async () => {
      await renderPage({ page: "site", site: "about", section: "seo" });
      const title = within(siteEditor()).getByLabelText("PAGE TITLE");
      expect(title).toHaveValue("");
      expect(title).toHaveAttribute("placeholder", "About · made by board passers in Iloilo");
      // "About · made by board passers in Iloilo · Ace Your Course"
      expect(title).toHaveAccessibleDescription("57 / 60 characters, with the site name");
      expect(within(siteEditor()).getByLabelText("META DESCRIPTION")).toHaveAttribute(
        "placeholder",
        expect.stringMatching(/^Ace Your Course is run by board passers in Iloilo City/),
      );
      expect(
        within(siteEditor()).getByLabelText("SHARE IMAGE · 1200 × 630"),
      ).toHaveAccessibleDescription("Uses the site’s share image");
      expect(
        within(siteEditor()).getByText(
          "Leave a field blank to use the page’s text today, shown in grey.",
        ),
      ).toBeInTheDocument();
    });

    it("opens HOME for a page that isn't a Site page", async () => {
      await renderPage({ page: "site", site: "legal" });
      expect(siteColumn("HOME")).toBeInTheDocument();
    });

    const aboutCard = () =>
      within(siteColumn("ABOUT")).getByRole("link", { name: /^Search & AI visibility/ });

    it("shows CHECK while today's text doesn't fit: About's description is over 160", async () => {
      await renderPage({ page: "site", site: "about" });
      expect(aboutCard()).toHaveTextContent("CHECK");
    });

    it("shows GOOD, and the saved values, once the saved title and description fit", async () => {
      getSampleStore().catalogue.sitePages = [
        {
          page: "about",
          seoTitle: "About us · board passers from Iloilo",
          seoDescription: "d".repeat(120),
          shareImage: null,
          about: null,
        },
      ];
      await renderPage({ page: "site", site: "about", section: "seo" });
      expect(aboutCard()).toHaveTextContent("GOOD");
      expect(within(siteEditor()).getByLabelText("PAGE TITLE")).toHaveValue(
        "About us · board passers from Iloilo",
      );
    });

    describe("ABOUT's sections (ticket 21)", () => {
      const aboutRows = () =>
        within(within(siteColumn("ABOUT")).getByRole("list", { name: "Sections" })).getAllByRole(
          "listitem",
        );

      it("lists About's six sections beside its search card, each always on, and opens the Header", async () => {
        await renderPage({ page: "site", site: "about" });
        expect(aboutRows().map((row) => row.textContent)).toEqual([
          "HeaderIntro, team photoALWAYS ON",
          "Our storyHeading, story, before and after, photosALWAYS ON",
          "How it grewFirst, Now, Today, closing lineALWAYS ON",
          "The missionHeading, intro, 4 tabsALWAYS ON",
          "Iloilo City rootsHeading, text, shipping labelALWAYS ON",
          "ClosingHeadingALWAYS ON",
        ]);
        const header = within(aboutRows()[0] ?? document.body).getByRole("link");
        expect(header).toHaveAttribute("href", "/admin/exam-pages?page=site&site=about");
        expect(header).toHaveAttribute("aria-current", "true");
        expect(within(aboutRows()[1] ?? document.body).getByRole("link")).toHaveAttribute(
          "href",
          "/admin/exam-pages?page=site&site=about&section=story",
        );
        expect(aboutCard()).toHaveAttribute(
          "href",
          "/admin/exam-pages?page=site&site=about&section=seo",
        );
        expect(aboutCard()).not.toHaveAttribute("aria-current");
        expect(within(siteEditor()).getByText("EDIT · HEADER · ABOUT")).toBeVisible();
        expect(within(siteEditor()).getByRole("form", { name: "Header" })).toBeVisible();
      });

      it.each([
        ["story", "EDIT · OUR STORY · ABOUT", "Our story"],
        ["growth", "EDIT · HOW IT GREW · ABOUT", "How it grew"],
        ["mission", "EDIT · THE MISSION · ABOUT", "The mission"],
        ["roots", "EDIT · ILOILO CITY ROOTS · ABOUT", "Iloilo City roots"],
        ["closing", "EDIT · CLOSING · ABOUT", "Closing"],
      ])("opens ?section=%s in the editor column", async (section, heading, form) => {
        await renderPage({ page: "site", site: "about", section });
        expect(within(siteEditor()).getByText(heading)).toBeVisible();
        expect(within(siteEditor()).getByRole("form", { name: form })).toBeVisible();
        expect(
          aboutRows()
            .map((row) => within(row).getByRole("link"))
            .filter((link) => link.getAttribute("aria-current") === "true")
            .map((link) => link.textContent),
        ).toEqual([expect.stringMatching(new RegExp(`^${form}`))]);
      });

      it("opens the Header for a section About doesn't have", async () => {
        await renderPage({ page: "site", site: "about", section: "team" });
        expect(within(siteEditor()).getByRole("form", { name: "Header" })).toBeVisible();
      });

      it("opens the search settings with ?section=seo, the card selected", async () => {
        await renderPage({ page: "site", site: "about", section: "seo" });
        expect(aboutCard()).toHaveAttribute("aria-current", "true");
        expect(
          within(siteEditor()).getByText("SEARCH & AI VISIBILITY · SITE PAGES · ABOUT"),
        ).toBeVisible();
      });

      it("opens a section with what's saved", async () => {
        const about = emptyAbout();
        about.story.heading = "We passed the boards. Then we built the reviewers.";
        getSampleStore().catalogue.sitePages = [
          { page: "about", seoTitle: null, seoDescription: null, shareImage: null, about },
        ];
        await renderPage({ page: "site", site: "about", section: "story" });
        expect(within(siteEditor()).getByLabelText("HEADING")).toHaveValue(
          "We passed the boards. Then we built the reviewers.",
        );
      });

      it("lists no sections on the other Site pages, which have only their search settings", async () => {
        await renderPage({ page: "site", site: "faq", section: "story" });
        expect(within(siteColumn("FAQ")).queryByRole("list", { name: "Sections" })).toBeNull();
        expect(
          within(siteEditor()).getByText("SEARCH & AI VISIBILITY · SITE PAGES · FAQ"),
        ).toBeVisible();
      });
    });

    it("lists what's set up automatically: the summary for AI assistants and the sitemap, with no breadcrumbs on a Site page", async () => {
      await renderPage({ page: "site", site: "faq" });
      expect(setUpAutomatically(siteEditor())).toEqual([
        ["Summary for AI assistants", "ON"],
        ["Sitemap", "AUTO"],
      ]);
    });
  });

  it("shows ?page=promo: the Home promo banner's editor with its status, for an Editor", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-10T04:00:00Z"));
    try {
      getSampleStore().catalogue.settings.promoBanner = {
        visible: true,
        text: "11.11 · Any 2 reviewers, 4% off on Shopee",
        buttonLabel: "Shop the sale",
        href: "https://shopee.ph/aceyourcourse",
        startDate: "2026-11-09",
        endDate: "2026-11-11",
      };
      await renderPage({ page: "promo" });
    } finally {
      vi.useRealTimers();
    }

    expect(within(pages()).getByRole("link", { current: "page" })).toHaveTextContent(
      "Home promo banner",
    );
    const editor = screen.getByRole("complementary", { name: "Page editor" });
    expect(within(editor).getByRole("heading", { name: "HOME PROMO BANNER" })).toBeInTheDocument();
    expect(within(editor).getByText("ON · SHOWS 9–11 NOV")).toBeInTheDocument();
    expect(within(editor).getByLabelText("BANNER TEXT")).toHaveValue(
      "11.11 · Any 2 reviewers, 4% off on Shopee",
    );
    expect(within(editor).getByRole("button", { name: "Turn off banner now" })).toBeInTheDocument();
  });

  it("says OFF for the seed's banner, which is turned off", async () => {
    await renderPage({ page: "promo" });
    expect(screen.getByRole("complementary", { name: "Page editor" })).toHaveTextContent("OFF");
    expect(screen.getByRole("switch", { name: "Show banner" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.queryByRole("button", { name: "Turn off banner now" })).not.toBeInTheDocument();
  });

  it("shows ?page=announcement: the bar's messages in order", async () => {
    await renderPage({ page: "announcement" });

    expect(within(pages()).getByRole("link", { current: "page" })).toHaveTextContent(
      "Announcement bar",
    );
    const editor = screen.getByRole("complementary", { name: "Page editor" });
    expect(within(editor).getByRole("heading", { name: "ANNOUNCEMENT BAR" })).toBeInTheDocument();
    const texts = within(editor)
      .getAllByRole("group")
      .map((group) => within(group).getByLabelText("TEXT"));
    expect(texts).toHaveLength(3);
    [
      "Physical copies on Shopee, Lazada & TikTok Shop",
      "Digital reviewers in the app · no auto-renew",
      "Ships from Iloilo City · SPayLater 0% on Shopee",
    ].forEach((text, index) => expect(texts[index]).toHaveValue(text));
  });

  it("sends a signed-out visitor to sign in from the promo page", async () => {
    jar.clear();
    await expect(renderPage({ page: "promo" })).rejects.toThrow(/^NEXT_REDIRECT \/admin\/sign-in/);
  });

  describe("adding and deleting Exams and Subjects (ticket 23)", () => {
    const OWNER = "angel@aceyourcourse.ph";
    const chipTexts = (region: HTMLElement) =>
      within(within(region).getByRole("list", { name: "Exam" }))
        .getAllByRole("link")
        .map((link) => link.textContent);
    const addCHE = () =>
      editSampleCatalogue((seed) => {
        withUnusedExam(seed);
      });

    it('shows an Owner "+ Add exam" after the last Exam chip', async () => {
      jar.set("ayc_admin_sample", OWNER);
      await renderPage();
      expect(chipTexts(column("CE"))).toEqual(["CE", "ME", "EE", "MT", "CPA", "+ Add exam"]);
      expect(within(column("CE")).getByRole("link", { name: "+ Add exam" })).toHaveAttribute(
        "href",
        "/admin/exam-pages?page=exam&add=exam",
      );
    });

    it('shows an Editor no "+ Add exam", "+ Add subject", Subject remove or "Delete exam"', async () => {
      addCHE();
      const { unmount } = await renderPage({ exam: "che" });
      expect(chipTexts(column("CHE"))).not.toContain("+ Add exam");
      expect(within(editor()).queryByRole("button", { name: "Delete exam" })).toBeNull();
      expect(within(editor()).queryByRole("region", { name: "Delete exam" })).toBeNull();
      unmount();

      await renderPage({ exam: "che", section: "subjects" });
      expect(within(editor()).queryByRole("form", { name: "Add subject" })).toBeNull();
      expect(within(editor()).queryByRole("button", { name: /^Remove/ })).toBeNull();
      // Editors still rename Subjects.
      expect(within(editor()).getByLabelText("01 · PCHEM")).toHaveValue("Physical Chemistry");
    });

    it("opens an Editor's ?page=exam&add=exam at the first Exam instead of the form", async () => {
      await renderPage({ page: "exam", add: "exam" });
      expect(column("CE")).toBeInTheDocument();
      expect(screen.queryByRole("form", { name: "New exam" })).toBeNull();
    });

    it('opens the "+ Add exam" form for an Owner at ?page=exam&add=exam', async () => {
      jar.set("ayc_admin_sample", OWNER);
      await renderPage({ page: "exam", add: "exam" });
      const column = screen.getByRole("region", { name: "New Exam page" });
      expect(within(column).getByRole("link", { name: "+ Add exam" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      const form = within(editor()).getByRole("form", { name: "New exam" });
      expect(within(editor()).getByRole("heading", { name: "ADD EXAM" })).toBeInTheDocument();
      for (const label of [
        "EXAM CODE",
        "BOARD ACRONYM",
        "EXAM NAME",
        "LONG NAME",
        "TEXT",
        "MADE FOR",
      ]) {
        expect(within(form).getByLabelText(label)).toHaveValue("");
      }
      expect(within(form).getByLabelText("01 · CODE")).toBeInTheDocument();
      expect(within(form).getByRole("button", { name: "Add exam" })).toBeInTheDocument();
    });

    it("marks an Exam with no Product on the Website NOT ON SITE, with the note for View page ↗", async () => {
      addCHE();
      jar.set("ayc_admin_sample", OWNER);
      await renderPage({ exam: "che" });
      const che = column("CHE");
      expect(chipTexts(che)).toEqual([
        "CE",
        "ME",
        "EE",
        "MT",
        "CPA",
        "CHE NOT ON SITE",
        "+ Add exam",
      ]);
      expect(within(che).queryByRole("link", { name: /^View page/ })).toBeNull();
      expect(within(che).getByText(/isn’t on the Website yet\./)).toHaveTextContent(
        "CHE isn’t on the Website yet. Add a Product for CHE, then turn on Show on website. Add a Product →",
      );
      expect(within(che).getByRole("link", { name: "Add a Product" })).toHaveAttribute(
        "href",
        "/admin/products?exam=che",
      );
      expect(within(pages()).getByRole("link", { name: /^Exam pages/ })).toHaveTextContent("× 6");
    });

    it("tells an Editor to show one of EE's 3 hidden Products, with a link to them (ticket 25)", async () => {
      editSampleCatalogue((seed) => {
        for (const product of seed.products) {
          if (product.examCode === "EE") product.showOnWebsite = false;
        }
      });
      await renderPage({ exam: "ee" });
      const ee = column("EE");
      expect(chipTexts(ee)).toContain("EE NOT ON SITE");
      expect(within(ee).getByText(/isn’t on the Website yet\./)).toHaveTextContent(
        "EE isn’t on the Website yet. To show it, turn on Show on website for one of its 3 Products. Open EE’s Products →",
      );
      expect(within(ee).getByRole("link", { name: "Open EE’s Products" })).toHaveAttribute(
        "href",
        "/admin/products?exam=ee",
      );
    });

    it("counts EE on the Website when its only shown Product is Coming Soon: no note", async () => {
      editSampleCatalogue((seed) => {
        for (const product of seed.products) {
          if (product.examCode === "EE")
            product.showOnWebsite = product.shortName === "EE Notebook";
        }
      });
      expect(
        getSampleStore().catalogue.products.filter((p) => p.examCode === "EE" && p.showOnWebsite),
      ).toEqual([expect.objectContaining({ shortName: "EE Notebook", state: "coming-soon" })]);
      await renderPage({ exam: "ee" });
      expect(within(column("EE")).queryByText(/isn’t on the Website yet/)).toBeNull();
      expect(chipTexts(column("EE"))).not.toContain("EE NOT ON SITE");
    });

    it("doesn't count EE's Live Product while it's hidden: the note still shows", async () => {
      editSampleCatalogue((seed) => {
        for (const product of seed.products) {
          if (product.examCode === "EE") product.showOnWebsite = false;
        }
      });
      expect(
        getSampleStore().catalogue.products.some((p) => p.examCode === "EE" && p.state === "live"),
      ).toBe(true);
      await renderPage({ exam: "ee" });
      expect(chipTexts(column("EE"))).toContain("EE NOT ON SITE");
      expect(within(column("EE")).getByText(/isn’t on the Website yet\./)).toHaveTextContent(
        "for one of its 3 Products.",
      );
    });

    it("shows no note for EE on the sample data, where its Products are shown", async () => {
      await renderPage({ exam: "ee" });
      expect(within(column("EE")).queryByText(/isn’t on the Website yet/)).toBeNull();
      expect(chipTexts(column("EE"))).toContain("EE");
      expect(chipTexts(column("EE"))).not.toContain("EE NOT ON SITE");
    });

    it('shows an Owner "Delete exam" for an Exam nothing uses, and the reason for one with Products', async () => {
      addCHE();
      jar.set("ayc_admin_sample", OWNER);
      const { unmount } = await renderPage({ exam: "che" });
      expect(within(editor()).getByRole("button", { name: "Delete exam" })).toBeInTheDocument();
      unmount();

      // The seed's one CPA Product.
      await renderPage({ exam: "cpa" });
      expect(within(editor()).queryByRole("button", { name: "Delete exam" })).toBeNull();
      expect(
        within(editor()).getByText("1 Product belongs to CPA. Move or delete it first."),
      ).toBeInTheDocument();
    });

    it('shows an Owner each Subject\'s remove button or the reason, and "+ Add subject"', async () => {
      jar.set("ayc_admin_sample", OWNER);
      editSampleCatalogue((seed) => {
        seed.exams[0]?.subjects.push({ code: "THERMO", name: "Thermodynamics" });
      });
      await renderPage({ exam: "ce", section: "subjects" });
      expect(within(editor()).getByRole("button", { name: "Remove THERMO" })).toBeInTheDocument();
      expect(within(editor()).queryByRole("button", { name: "Remove MSTC" })).toBeNull();
      expect(
        within(editor()).getAllByText(/^\d+ Products? uses? MSTC\. Remove it from th/),
      ).toHaveLength(1);
      const add = within(editor()).getByRole("form", { name: "Add subject" });
      expect(within(add).getByLabelText("CODE")).toHaveValue("");
    });
  });
});
