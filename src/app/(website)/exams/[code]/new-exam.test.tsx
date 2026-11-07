import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { newProductForm } from "@/lib/admin/product-form";
import { createExam, createProduct } from "@/services/admin.mock";
import { listExams } from "@/services/catalogue";
import { resetSampleStore } from "@/services/mock/sample-store";

import { sampleActor, UNUSED_EXAM } from "../../../../../test/admin-inputs";

// A new Exam on the Website (ticket 23; spec, Phase 2 → "Adding Exams and
// Subjects"): an Owner adds CHE in the Admin, and it reaches the Website only
// once one of its Products is on the Website. Every Website list of Exams
// (menus, footer, Home, the Products and Reviews filters, the FAQ coverage
// table, About and the Exam pages' switcher) reads listExams(), and so do the
// sitemap and /llms.txt. Until then /exams/che answers 404.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  permanentRedirect: (url: string) => {
    throw new Error(`NEXT_PERMANENT_REDIRECT ${url}`);
  },
  usePathname: () => "/exams/che",
}));
vi.mock("@/components/website/json-ld", () => ({ JsonLd: () => null }));

const OWNER = sampleActor("owner");
const EDITOR = sampleActor("editor");

async function examPage(code: string) {
  const { default: ExamPage } = await import("./page");
  return ExamPage({ params: Promise.resolve({ code }) });
}
async function sitemapPaths() {
  const { default: sitemap } = await import("@/app/sitemap");
  return (await sitemap()).map((entry) => new URL(entry.url).pathname);
}
async function llmsTxt() {
  const { GET } = await import("@/app/llms.txt/route");
  return (await GET()).text();
}

/** An Editor adds a CHE Product, Coming Soon (it needs no photo), shown on the Website. */
async function addCheProduct() {
  const result = await createProduct(EDITOR, {
    ...newProductForm("CHE"),
    title: "ChE Formula Flash Cards",
    shortName: "ChE Flash Cards",
    size: "A6",
    subjectCodes: ["PCHEM"],
    comingSoon: true,
  });
  if (!result.ok) throw new Error(`the Product wasn't added: ${JSON.stringify(result.error)}`);
}

beforeEach(async () => {
  resetSampleStore();
  const added = await createExam(OWNER, { ...UNUSED_EXAM, name: "<b>Chemical</b> Engineering" });
  if (!added.ok) throw new Error("CHE wasn't added");
});

afterEach(() => {
  resetSampleStore();
});

describe("a new Exam with no Product on the Website", () => {
  it("is absent from the Website's Exam lists, the sitemap and /llms.txt", async () => {
    expect((await listExams()).map((exam) => exam.code)).toEqual(["CE", "ME", "EE", "MT", "CPA"]);
    expect(await sitemapPaths()).not.toContain("/exams/che");
    expect(await llmsTxt()).not.toMatch(/CHE|Chemical/);
  });

  it("answers 404 at /exams/che", async () => {
    await expect(examPage("che")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("stays off it with a Product that isn't on the Website", async () => {
    await addCheProduct();
    const { setProductFlags } = await import("@/services/admin.mock");
    const id = (await import("@/services/mock/sample-store"))
      .getSampleStore()
      .catalogue.products.at(-1)?.id;
    if (!id) throw new Error("no Product");
    expect(await setProductFlags(EDITOR, id, { showOnWebsite: false })).toMatchObject({ ok: true });

    expect((await listExams()).map((exam) => exam.code)).not.toContain("CHE");
    await expect(examPage("che")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("once one of its Products is on the Website", () => {
  beforeEach(async () => {
    await addCheProduct();
  });

  it("is last in the Website's Exam lists, the sitemap and /llms.txt", async () => {
    expect((await listExams()).map((exam) => exam.code)).toEqual([
      "CE",
      "ME",
      "EE",
      "MT",
      "CPA",
      "CHE",
    ]);
    const paths = (await sitemapPaths()).filter((path) => path.startsWith("/exams/"));
    expect(paths.at(-1)).toBe("/exams/che");
    const text = await llmsTxt();
    const headings: string[] = text.match(/^## .+$/gm) ?? [];
    expect(headings.indexOf("## \\<b\\>Chemical\\</b\\> Engineering (CHELE)")).toBe(
      headings.indexOf("## FAQ") - 1,
    );
    expect(text).toContain("/products/che-formula-flash-cards): Coming soon");
  });

  it("answers /exams/che with its Header text and Subjects, the name as plain text", async () => {
    const { container } = render(await examPage("che"));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "<b>Chemical</b> Engineering",
    );
    expect(container.querySelector("h1 b")).toBeNull();
    expect(screen.getAllByText("Every ChE formula.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Physical Chemistry").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Thermodynamics").length).toBeGreaterThan(0);
  });
});
