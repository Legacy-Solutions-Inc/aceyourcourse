import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import type { AdminActionState } from "@/lib/admin/action";
import type { AdminSitePage } from "@/services/admin.types";
import type { UploadTicket } from "@/services/uploads.types";

import { SitePageSeoEditor } from "./site-page-seo-editor";

// A Site page's Search & AI visibility (ticket 20), saving through stub
// Server Actions that answer as adminAction would. The router and the
// browser's PUT to the upload URL are the framework and network boundaries,
// so they're replaced.
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  unstable_rethrow: () => {},
}));
const network = vi.hoisted(() => ({
  sent: [] as { url: string; name: string }[],
  sizes: new Map<string, { width: number; height: number }>(),
}));
vi.mock("@/components/admin/products/put-file", () => ({
  putFile: async (url: string, file: File) => {
    network.sent.push({ url, name: file.name });
  },
  measureImage: async (file: File) => network.sizes.get(file.name) ?? null,
}));

type Submission = { input: unknown; expected?: { savedAt: string } };

/** A stub Server Action that answers each call in turn. */
function answering<T>(...answers: AdminActionState<T>[]) {
  return vi.fn(async (_previous: AdminActionState<T>, _submission: Submission) => {
    const next = answers.shift();
    if (!next) throw new Error("no more answers");
    return next;
  });
}

const OPENED_AT = "2026-11-05T03:42:00.000Z";
const STAMP = { savedAt: OPENED_AT, savedBy: null };
const SAVED_AT = { savedAt: "2026-11-05T03:43:00.000Z", savedBy: "AYC Content Team" };
const DEFAULTS = {
  address: "aceyourcourse.ph/faq",
  title: "FAQ · shipping, paper, coverage",
  description: "Answers to the questions reviewees always ask.",
};
const TICKET: AdminActionState<UploadTicket> = {
  status: "saved",
  value: {
    uploadUrl: "/api/dev/uploads/1?token=t",
    path: "uploads/1",
    publicUrl: "/api/dev/uploads/1",
  },
};

function faq(changes: Partial<AdminSitePage["page"]> = {}): AdminSitePage {
  return {
    page: {
      page: "faq",
      seoTitle: null,
      seoDescription: null,
      shareImage: null,
      about: null,
      ...changes,
    },
    stamps: { seo: STAMP },
  };
}

function renderEditor({
  save = answering<AdminSitePage>(),
  createUpload = answering<UploadTicket>(),
}: {
  save?: ReturnType<typeof answering<AdminSitePage>>;
  createUpload?: ReturnType<typeof answering<UploadTicket>>;
} = {}) {
  const user = userEvent.setup({ applyAccept: false });
  render(
    <>
      <SitePageSeoEditor
        opened={faq()}
        defaults={DEFAULTS}
        action={save}
        createUpload={createUpload}
      />
      <Toaster />
    </>,
  );
  return { user, save, createUpload };
}

const form = () => screen.getByRole("form", { name: "Search & AI visibility" });

beforeEach(() => {
  router.refresh.mockClear();
  network.sent = [];
  network.sizes.clear();
  // jsdom has no object URLs; the preview only needs a src.
  URL.createObjectURL = vi.fn((file: Blob) => `blob:${file instanceof File ? file.name : "file"}`);
  URL.revokeObjectURL = vi.fn();
});

describe("a Site page's Search & AI visibility", () => {
  it("shows the address, today's text as the placeholders, and previews it", () => {
    renderEditor();
    expect(within(form()).getAllByText("aceyourcourse.ph/faq")).toHaveLength(2);
    expect(within(form()).getByLabelText("PAGE TITLE")).toHaveAttribute(
      "placeholder",
      DEFAULTS.title,
    );
    expect(within(form()).getByRole("figure")).toHaveTextContent(
      `${DEFAULTS.title} · Ace Your Course${DEFAULTS.description}`,
    );
    expect(within(form()).getByText("Sitemap")).toBeInTheDocument();
  });

  it("saves the title and description with the page and its stamp, then refreshes the screen", async () => {
    const save = answering<AdminSitePage>({
      status: "saved",
      value: {
        page: { ...faq().page, seoTitle: "FAQ", seoDescription: "d".repeat(120) },
        stamps: { seo: SAVED_AT },
      },
    });
    const { user } = renderEditor({ save });
    await user.type(within(form()).getByLabelText("PAGE TITLE"), "FAQ");
    await user.type(within(form()).getByLabelText("META DESCRIPTION"), "d".repeat(120));
    expect(within(form()).getByText("GOOD")).toBeInTheDocument();
    await user.click(within(form()).getByRole("button", { name: "Save" }));

    expect(await within(form()).findByText("✓ SAVED · LIVE ON THE SITE")).toBeInTheDocument();
    expect(save.mock.calls[0]?.[1]).toEqual({
      input: { site: "faq", seoTitle: "FAQ", seoDescription: "d".repeat(120), shareImage: "" },
      expected: { savedAt: OPENED_AT },
    });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("says CHECK for a 70-character description, and still sends it", async () => {
    const save = answering<AdminSitePage>({
      status: "saved",
      value: { page: { ...faq().page, seoDescription: "d".repeat(70) }, stamps: { seo: SAVED_AT } },
    });
    const { user } = renderEditor({ save });
    await user.type(within(form()).getByLabelText("META DESCRIPTION"), "d".repeat(70));
    expect(within(form()).getByText(/^CHECK/)).toBeInTheDocument();

    await user.click(within(form()).getByRole("button", { name: "Save" }));
    expect(await within(form()).findByText("✓ SAVED · LIVE ON THE SITE")).toBeInTheDocument();
  });

  it("says who saved first on a stale save, keeping what was typed", async () => {
    const save = answering<AdminSitePage>({
      status: "refused",
      error: { kind: "conflict", ...SAVED_AT },
    });
    const { user } = renderEditor({ save });
    const title = within(form()).getByLabelText("PAGE TITLE");
    await user.type(title, "Questions, answered");
    await user.click(within(form()).getByRole("button", { name: "Save" }));

    expect(await within(form()).findByRole("alert")).toHaveTextContent(
      /AYC Content Team saved these search settings at/,
    );
    expect(title).toHaveValue("Questions, answered");
  });

  it("uploads a 1000 × 500 share image for the page, warns about its size, and saves its path", async () => {
    network.sizes.set("wide.png", { width: 1000, height: 500 });
    const createUpload = answering(TICKET);
    const save = answering<AdminSitePage>({
      status: "saved",
      value: {
        page: { ...faq().page, shareImage: "/api/dev/uploads/1" },
        stamps: { seo: SAVED_AT },
      },
    });
    const { user } = renderEditor({ save, createUpload });

    const field = within(form()).getByLabelText("SHARE IMAGE · 1200 × 630");
    await user.upload(field, new File(["png"], "wide.png", { type: "image/png" }));
    expect(
      await within(form()).findByText("1000 × 500 · NOT 1200 × 630, SO IT MAY BE CROPPED"),
    ).toBeInTheDocument();
    await waitFor(() => expect(field).toHaveAccessibleDescription("wide.png"));
    expect(createUpload.mock.calls[0]?.[1]).toEqual({
      input: { site: "faq", contentType: "image/png", size: 3 },
    });

    await user.click(within(form()).getByRole("button", { name: "Save" }));
    expect(await within(form()).findByText("✓ SAVED · LIVE ON THE SITE")).toBeInTheDocument();
    expect(save.mock.calls[0]?.[1].input).toMatchObject({ shareImage: "uploads/1" });
  });

  it.each([
    [
      "a GIF",
      () => new File(["gif"], "moving.gif", { type: "image/gif" }),
      "“moving.gif” isn’t a JPEG, PNG or WebP image.",
    ],
    [
      "an 11 MB file",
      () => new File([new Uint8Array(11 * 1024 * 1024)], "huge.png", { type: "image/png" }),
      "“huge.png” is over 10 MB.",
    ],
  ])("refuses %s before uploading it", async (_case, file, message) => {
    const { user, createUpload } = renderEditor();
    await user.upload(within(form()).getByLabelText("SHARE IMAGE · 1200 × 630"), file());

    expect(within(form()).getByText(message)).toBeInTheDocument();
    expect(createUpload).not.toHaveBeenCalled();
  });
});
