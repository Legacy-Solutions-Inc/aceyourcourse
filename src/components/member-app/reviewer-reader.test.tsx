import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StudyActionState } from "@/app/app/(shell)/library/actions";

import { ReviewerReader, type ReviewerReaderProps } from "./reviewer-reader";

// The Reviewer PDF reader (stories 101, 102 and 105; mockups `reviewer` and
// `loadError`): one stamped page at a time from the protected page endpoint,
// Previous and Next (and the arrow keys), zoom 75–150% in 25% steps done in
// the browser, the right message when a page doesn't come (a dropped
// connection, or the server's no) with Try again, and reopening at the page
// and zoom the Member left it at. The page endpoint and the Server Action
// are the boundary, so they're replaced: fetch answers each page with a
// WebP unless a test says otherwise, and each page turn and zoom sends where
// the Member is.
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  unstable_rethrow: () => {},
}));

const PDF = "66666666-6666-4666-8666-666666666666";
const SAVED: StudyActionState = { status: "saved" };
const pageUrl = (page: number, retry = "") => `/app/reviewer-pdfs/${PDF}/pages/${page}${retry}`;

/** The page endpoint's answer with a page: a (tiny) WebP. */
const aPage = () =>
  new Response(new Uint8Array([82, 73, 70, 70]), { headers: { "content-type": "image/webp" } });
const endpoint = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
/** The page URLs the reader asked the endpoint for, in order. */
const asked = () => endpoint.mock.calls.map(([url]) => url);

const { createObjectURL, revokeObjectURL } = URL;
let objectUrls = 0;

function renderReader(overrides: Partial<ReviewerReaderProps> = {}) {
  const savePosition = vi.fn(async (_input: unknown): Promise<StudyActionState> => SAVED);
  const props: ReviewerReaderProps = {
    reviewerPdfId: PDF,
    title: "Simple Curves",
    label: "MSTC Reviewer · Simple Curves",
    pageCount: 3,
    resumeAt: null,
    examCode: "CE",
    unlock: { kind: "plans", href: "/app/plans?exam=CE" },
    back: { href: "/app/library?subject=MSTC", label: "Back to MSTC topics" },
    actions: { savePosition },
    ...overrides,
  };
  return { ...render(<ReviewerReader {...props} />), savePosition };
}

/** The page image, once its page has come. */
const shown = (page: number, of = 3) => screen.findByRole("img", { name: `Page ${page} of ${of}` });
const pages = () => screen.getByRole("navigation", { name: "Pages" });
const zoom = () => screen.getByRole("group", { name: "Zoom" });

beforeEach(() => {
  refresh.mockClear();
  endpoint.mockReset().mockImplementation(async () => aPage());
  vi.stubGlobal("fetch", endpoint);
  objectUrls = 0;
  URL.createObjectURL = vi.fn(() => `blob:page-${++objectUrls}`);
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  // Unmounted first: unmounting lets go of the shown page's object URL.
  cleanup();
  vi.unstubAllGlobals();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
});

describe("the Reviewer PDF reader", () => {
  it("opens at page 1, 100%, the first time, asking the page endpoint for the stamped page", async () => {
    renderReader();

    expect(screen.getByRole("heading", { level: 1, name: "Simple Curves" })).toBeInTheDocument();
    expect(screen.getByText("MSTC Reviewer · Simple Curves")).toBeInTheDocument();
    expect(await shown(1)).toHaveAttribute("src", "blob:page-1");
    expect(endpoint).toHaveBeenCalledWith(pageUrl(1), { redirect: "manual" });
    expect(within(pages()).getByText("PAGE 1 / 3")).toBeInTheDocument();
    expect(within(zoom()).getByText("100%")).toBeInTheDocument();
  });

  it("shows the page loading until it arrives", async () => {
    let arrive: (response: Response) => void = () => {};
    endpoint.mockImplementation(() => new Promise((resolve) => (arrive = resolve)));
    renderReader();

    expect(screen.getByText("LOADING PAGE 1…")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
    arrive(aPage());
    await shown(1);
    expect(screen.queryByText("LOADING PAGE 1…")).toBeNull();
  });

  it("reopens at the page and zoom the Member left it at", async () => {
    renderReader({ resumeAt: { page: 2, zoom: 125 } });

    await shown(2);
    expect(asked()).toEqual([pageUrl(2)]);
    expect(within(pages()).getByText("PAGE 2 / 3")).toBeInTheDocument();
    expect(within(zoom()).getByText("125%")).toBeInTheDocument();
    expect(screen.getByTestId("page-frame")).toHaveStyle({ width: "125%" });
  });

  it("pages with Next and Previous, stopping at either end, and saves each page it turns to", async () => {
    const user = userEvent.setup();
    const { savePosition } = renderReader();
    const previous = within(pages()).getByRole("button", { name: "← Prev" });
    const next = within(pages()).getByRole("button", { name: "Next →" });
    expect(previous).toBeDisabled();

    await user.click(next);
    await shown(2);
    await user.click(next);
    await shown(3);
    expect(next).toBeDisabled();
    await user.click(previous);
    await shown(2);

    expect(asked()).toEqual([pageUrl(1), pageUrl(2), pageUrl(3), pageUrl(2)]);
    expect(savePosition.mock.calls.map(([input]) => input)).toEqual([
      { reviewerPdfId: PDF, page: 2, zoom: 100 },
      { reviewerPdfId: PDF, page: 3, zoom: 100 },
      { reviewerPdfId: PDF, page: 2, zoom: 100 },
    ]);
    // Each page's copy is let go once another page shows.
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:page-1");
  });

  it("pages with the arrow keys, but not while a modifier is held", async () => {
    const user = userEvent.setup();
    const { savePosition } = renderReader();

    await user.keyboard("{ArrowRight}");
    await shown(2);
    await user.keyboard("{Control>}{ArrowRight}{/Control}");
    expect(within(pages()).getByText("PAGE 2 / 3")).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    await shown(1);
    await user.keyboard("{ArrowLeft}");
    expect(within(pages()).getByText("PAGE 1 / 3")).toBeInTheDocument();
    expect(savePosition).toHaveBeenCalledTimes(2);
  });

  it("leaves the arrow keys to the page view while it has focus, to scroll a zoomed page", async () => {
    const user = userEvent.setup();
    renderReader({ resumeAt: { page: 1, zoom: 150 } });
    const view = screen.getByRole("region", { name: "Page view" });

    await user.click(view);
    expect(view).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(within(pages()).getByText("PAGE 1 / 3")).toBeInTheDocument();
  });

  it("zooms from 75% to 150% in 25% steps in the browser, stopping at either end, and saves each zoom", async () => {
    const user = userEvent.setup();
    const { savePosition } = renderReader();
    await shown(1);
    const zoomIn = within(zoom()).getByRole("button", { name: "Zoom in" });
    const zoomOut = within(zoom()).getByRole("button", { name: "Zoom out" });

    await user.click(zoomIn);
    await user.click(zoomIn);
    expect(within(zoom()).getByText("150%")).toBeInTheDocument();
    expect(zoomIn).toBeDisabled();
    expect(screen.getByTestId("page-frame")).toHaveStyle({ width: "150%" });

    for (let step = 0; step < 3; step += 1) await user.click(zoomOut);
    expect(within(zoom()).getByText("75%")).toBeInTheDocument();
    expect(zoomOut).toBeDisabled();
    // The same page, only bigger or smaller: zooming asks the endpoint for nothing new.
    expect(asked()).toEqual([pageUrl(1)]);

    expect(savePosition.mock.calls.map(([input]) => input)).toEqual([
      { reviewerPdfId: PDF, page: 1, zoom: 125 },
      { reviewerPdfId: PDF, page: 1, zoom: 150 },
      { reviewerPdfId: PDF, page: 1, zoom: 125 },
      { reviewerPdfId: PDF, page: 1, zoom: 100 },
      { reviewerPdfId: PDF, page: 1, zoom: 75 },
    ]);
  });

  it("says the connection dropped when a page's request does, and Try again asks again", async () => {
    const user = userEvent.setup();
    endpoint.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderReader({ resumeAt: { page: 2, zoom: 100 } });

    const failed = await screen.findByRole("alert");
    expect(failed).toHaveTextContent("PAGE 2 DIDN’T LOAD");
    expect(
      within(failed).getByRole("heading", { name: "Looks like your connection dropped" }),
    ).toBeInTheDocument();
    expect(failed).toHaveTextContent(
      "Pages load one at a time and aren’t saved on your device, so you need a connection to keep going.",
    );
    expect(screen.queryByRole("img")).toBeNull();
    // Next waits for this page; Prev still goes back.
    expect(within(pages()).getByRole("button", { name: "Next →" })).toBeDisabled();
    expect(within(pages()).getByRole("button", { name: "← Prev" })).toBeEnabled();
    // The network's fault, not the server's: nothing to decide again.
    expect(refresh).not.toHaveBeenCalled();

    await user.click(within(failed).getByRole("button", { name: "Try again" }));
    await shown(2);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(asked()).toEqual([pageUrl(2), pageUrl(2, "?retry=1")]);
  });

  it.each([
    ["a refusal", () => Response.json({ refused: "expired" }, { status: 403 })],
    ["no such page", () => new Response("Not found", { status: 404 })],
    ["a redirect to another screen", () => new Response(null, { status: 307 })],
    [
      "a screen in place of the page",
      () => new Response("<html></html>", { headers: { "content-type": "text/html" } }),
    ],
  ])(
    "says the page isn't available when the server answers with %s, and reads the page again",
    async (_case, answer) => {
      const user = userEvent.setup();
      endpoint.mockImplementationOnce(async () => answer());
      renderReader();

      const unavailable = await screen.findByRole("alert");
      expect(unavailable).toHaveTextContent("PAGE 1 ISN’T AVAILABLE");
      expect(
        within(unavailable).getByRole("heading", { name: "This page couldn’t be shown" }),
      ).toBeInTheDocument();
      expect(unavailable).not.toHaveTextContent("connection");
      // The server decides again: a pass that ended meanwhile shows renew in place of the reader.
      await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

      await user.click(within(unavailable).getByRole("button", { name: "Try again" }));
      await shown(1);
      expect(asked()).toEqual([pageUrl(1), pageUrl(1, "?retry=1")]);
    },
  );

  it("shows renew in place of the page when a save finds the pass ended", async () => {
    const user = userEvent.setup();
    const savePosition = vi.fn(async (): Promise<StudyActionState> => ({
      status: "refused",
      decision: { outcome: "expired", passEndedAt: "2026-11-14T03:42:00.000Z" },
    }));
    renderReader({ actions: { savePosition } });

    await user.click(within(pages()).getByRole("button", { name: "Next →" }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 2, name: "Your CE All-Access ended on 14 Nov 2026" }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Renew to keep reviewing\. Your progress is kept\./),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /^Page/ })).toBeNull();
  });

  it("keeps the page from being dragged out", async () => {
    renderReader();
    expect(await shown(1)).toHaveAttribute("draggable", "false");
  });
});
