import { render, screen } from "@testing-library/react";
import { unzipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import { CARD_IMPORT_TEMPLATE_CSV, EXAMPLE_IMAGE } from "@/lib/card-import/template";
import type { CardImportPreview } from "@/services/admin.types";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import { receiveSampleUpload } from "@/services/uploads.mock";
import type { ContentUploadTicket } from "@/services/uploads.types";

import { importCsv } from "../../../../../../test/card-import-files";
import { checkCardImport, createImportUpload, importCards } from "../actions";
import { GET as exampleImages } from "./example-images/route";
import CardImportPage from "./page";
import { GET as template } from "./template/route";

// A Subject's card import (Phase 3, ticket 06; stories 118, 120–124), on
// sample data: the page and the template downloads as a browser loads them,
// and the import's Server Actions as the screen sends them. Every Admin
// action's refusals for signed-out visitors, non-Staff (a Member, say) and
// closed mode are in actions.permissions.test.ts; the seam's rules in
// admin.card-import.test.ts.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/admin/content/import",
  useRouter: () => ({ refresh: () => {}, replace: () => {} }),
  unstable_rethrow: () => {},
}));

const IDLE: AdminActionState<never> = { status: "idle" };
const EDITOR = "content@aceyourcourse.ph";
const TESTER = "tester@example.com";

const signInAs = (email: string) => jar.set("ayc_admin_sample", email);
const renderPage = async (params: Record<string, string>) =>
  render(await CardImportPage({ searchParams: Promise.resolve(params) }));

beforeEach(() => {
  jar.clear();
  resetSampleStore();
});

describe("the card import page", () => {
  it("opens an Editor on the Subject's import, with the way back to its Topics", async () => {
    signInAs(EDITOR);
    await renderPage({ exam: "ce", subject: "mstc" });

    expect(
      screen.getByRole("heading", { level: 1, name: "Member App content" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "CE · MSTC · IMPORT CARDS" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← MSTC Topics" })).toHaveAttribute(
      "href",
      "/admin/content?exam=ce&subject=mstc",
    );
    expect(screen.getByRole("button", { name: "Check file" })).toBeInTheDocument();
  });

  it.each([[{ exam: "ce", subject: "zzz" }], [{ exam: "zz", subject: "mstc" }], [{}]])(
    "answers 404 for a Subject that isn't in the catalogue: %o",
    async (params) => {
      signInAs(EDITOR);
      await expect(renderPage(params)).rejects.toThrow("NEXT_NOT_FOUND");
    },
  );

  it("sends someone signed out to sign-in, coming back here", async () => {
    await expect(renderPage({ exam: "ce", subject: "mstc" })).rejects.toThrow(
      `NEXT_REDIRECT /admin/sign-in?next=${encodeURIComponent("/admin/content/import?exam=ce&subject=mstc")}`,
    );
  });

  it("sends a User who isn't Staff, such as a Member, to the 403 screen", async () => {
    signInAs(TESTER);
    await expect(renderPage({ exam: "ce", subject: "mstc" })).rejects.toThrow(
      "NEXT_REDIRECT /admin/denied?reason=not-staff",
    );
  });
});

describe("the template downloads", () => {
  it("gives Staff the template CSV as a download", async () => {
    signInAs(EDITOR);
    const response = await template();

    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="card-import-template.csv"',
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes]).toEqual([...new TextEncoder().encode(CARD_IMPORT_TEMPLATE_CSV)]);
    // UTF-8 with a byte order mark, so Excel reads it as UTF-8.
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("gives Staff the zip with the template's example image", async () => {
    signInAs(EDITOR);
    const response = await exampleImages();

    expect(response.headers.get("content-type")).toBe("application/zip");
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(Object.keys(files)).toEqual([EXAMPLE_IMAGE]);
  });

  it.each([
    ["the template", template],
    ["the example images", exampleImages],
  ])("refuses %s to someone signed out, and to a User who isn't Staff", async (_, get) => {
    await expect(get()).rejects.toThrow(/^NEXT_REDIRECT \/admin\/sign-in/);
    signInAs(TESTER);
    await expect(get()).rejects.toThrow("NEXT_REDIRECT /admin/denied?reason=not-staff");
  });
});

describe("the card import's Server Actions", () => {
  /** Asks for an upload URL and sends the file there, as the screen does. */
  async function upload(purpose: "card-import-csv" | "card-import-zip", bytes: Uint8Array) {
    const created = await createImportUpload(IDLE, { input: { purpose, size: bytes.byteLength } });
    if (created.status !== "saved") throw new Error(JSON.stringify(created));
    const ticket: ContentUploadTicket = created.value;
    const url = new URL(ticket.uploadUrl, "http://localhost");
    await receiveSampleUpload(
      url.pathname.split("/").at(-1) ?? "",
      url.searchParams.get("token") ?? "",
      {
        contentType: ticket.contentType,
        contentLength: bytes.byteLength,
        body: async () => bytes,
      },
    );
    return ticket.path;
  }

  it("check and import a CSV an Editor uploaded, creating its Topic with a Hidden deck", async () => {
    signInAs(EDITOR);
    const csv = await upload("card-import-csv", importCsv(["Highways,Grade,Rise over run,,"]));
    const input = { exam: "ce", subject: "mstc", csv, zip: null, mode: "add" };

    const checked = await checkCardImport(IDLE, { input });
    expect(checked).toMatchObject({ status: "saved", value: { problems: [] } });
    const { basedOn } = (checked as { value: CardImportPreview }).value;

    const imported = await importCards(IDLE, { input: { ...input, basedOn } });

    expect(imported).toMatchObject({
      status: "saved",
      value: { topics: [{ name: "Highways", created: true }] },
    });
    const store = getSampleStore();
    const highways = store.topics.find((topic) => topic.name === "Highways");
    expect(store.decks.find((deck) => deck.topicId === highways?.id)?.visibility).toBe("hidden");
    expect(store.cards.map((card) => card.front)).toEqual(["Grade"]);
  });

  it("refuses to import a preview with problems, saving nothing", async () => {
    signInAs(EDITOR);
    const csv = await upload("card-import-csv", importCsv(["Highways,Grade,$x,,"]));
    const input = { exam: "ce", subject: "mstc", csv, zip: null, mode: "add" };
    const checked = await checkCardImport(IDLE, { input });
    const { basedOn, problems } = (checked as { value: CardImportPreview }).value;
    expect(problems).toHaveLength(1);

    expect(await importCards(IDLE, { input: { ...input, basedOn } })).toEqual({
      status: "refused",
      error: {
        kind: "invalid",
        fieldErrors: {},
        formError: "FIX THE PROBLEMS IN THE FILE, THEN CHECK IT AGAIN",
      },
    });
    expect(getSampleStore().cards).toEqual([]);
  });
});
