import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { missionTabs } from "@/content/about";
import type { AdminActionState } from "@/lib/admin/action";
import { ABOUT_DEFAULTS, ABOUT_LIMITS, emptyAbout } from "@/lib/catalogue/about-content";
import type { AdminAbout } from "@/services/admin.types";
import type { AboutSectionKey } from "@/services/catalogue.types";
import type { UploadTicket } from "@/services/uploads.types";

import { AboutSectionEditor } from "./about-editors";

// About's section editors (ticket 21; Pages & promo → Site pages → ABOUT),
// saving through stub Server Actions that answer as adminAction would. The
// router and the browser's PUT to the upload URL are the framework and
// network boundaries, so they're replaced.
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
const TICKET: AdminActionState<UploadTicket> = {
  status: "saved",
  value: {
    uploadUrl: "/api/dev/uploads/1?token=t",
    path: "uploads/1",
    publicUrl: "/api/dev/uploads/1",
  },
};
const FOUR_THREE = "This photo isn't 4:3, so its edges will be cropped.";
const SOFT = "This photo is smaller than 1200 × 900, so it may look soft.";

function opened(edit: (about: AdminAbout["about"]) => void = () => {}): AdminAbout {
  const about = emptyAbout();
  edit(about);
  return {
    about,
    stamps: {
      header: STAMP,
      story: STAMP,
      growth: STAMP,
      mission: STAMP,
      roots: STAMP,
      closing: STAMP,
    },
  };
}

/** What a save answers: the section's saved values, with its new stamp. */
const savedWith = (
  section: AboutSectionKey,
  edit: (about: AdminAbout["about"]) => void = () => {},
): AdminActionState<AdminAbout> => {
  const value = opened(edit);
  return { status: "saved", value: { ...value, stamps: { ...value.stamps, [section]: SAVED_AT } } };
};

function renderEditor(
  section: AboutSectionKey,
  {
    save = answering<AdminAbout>(),
    createUpload = answering<UploadTicket>(),
    about = opened(),
  }: {
    save?: ReturnType<typeof answering<AdminAbout>>;
    createUpload?: ReturnType<typeof answering<UploadTicket>>;
    about?: AdminAbout;
  } = {},
) {
  const user = userEvent.setup({ applyAccept: false });
  render(
    <>
      <AboutSectionEditor
        section={section}
        opened={about}
        action={save}
        createUpload={createUpload}
      />
      <Toaster />
    </>,
  );
  return { user, save, createUpload };
}

const form = () => screen.getByRole("form");
const field = (label: string) => within(form()).getByLabelText(label);
const saveButton = () => within(form()).getByRole("button", { name: "Save" });

beforeEach(() => {
  router.refresh.mockClear();
  network.sent = [];
  network.sizes.clear();
  // jsdom has no object URLs; the preview only needs a src.
  URL.createObjectURL = vi.fn((file: Blob) => `blob:${file instanceof File ? file.name : "file"}`);
  URL.revokeObjectURL = vi.fn();
});

describe("About's Header editor", () => {
  it("opens blank, with today's text as the placeholder and a counter to its limit", () => {
    renderEditor("header");
    expect(form()).toHaveAccessibleName("Header");
    const intro = field("INTRO TEXT");
    expect(intro).toHaveValue("");
    expect(intro).toHaveAttribute("placeholder", ABOUT_DEFAULTS.header.intro);
    expect(intro).toHaveAccessibleDescription(`0 / ${ABOUT_LIMITS.header.intro} characters`);
    expect(field("TEAM PHOTO")).toHaveAccessibleDescription("Today’s photo");
    expect(
      within(form()).getByText("Leave a field blank to use the page’s text today, shown in grey."),
    ).toBeInTheDocument();
  });

  it("saves the section with its stamp, then refreshes the screen", async () => {
    const save = answering(savedWith("header", (about) => (about.header.intro = "Hello.")));
    const { user } = renderEditor("header", { save });
    await user.type(field("INTRO TEXT"), "Hello.");
    await user.click(saveButton());

    expect(await within(form()).findByText("✓ SAVED · LIVE ON THE SITE")).toBeInTheDocument();
    expect(save.mock.calls[0]?.[1]).toEqual({
      input: { section: "header", intro: "Hello.", teamPhoto: { src: "", alt: "" } },
      expected: { savedAt: OPENED_AT },
    });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("turns the counter red one character over, and shows the refusal, keeping what was typed", async () => {
    const limit = ABOUT_LIMITS.header.intro;
    const save = answering<AdminAbout>({
      status: "refused",
      error: { kind: "invalid", fieldErrors: { intro: [`KEEP IT TO ${limit} CHARACTERS`] } },
    });
    const { user } = renderEditor("header", { save });
    const intro = field("INTRO TEXT");
    await user.click(intro);
    await user.paste("i".repeat(limit + 1));
    const counter = within(form()).getByText(`${limit + 1} / ${limit}`);
    expect(counter).toHaveClass("text-destructive");

    await user.click(saveButton());
    expect(await within(form()).findByText(`KEEP IT TO ${limit} CHARACTERS`)).toBeVisible();
    expect(intro).toHaveValue("i".repeat(limit + 1));
  });

  it("says who saved first on a stale save, keeping what was typed", async () => {
    const save = answering<AdminAbout>({
      status: "refused",
      error: { kind: "conflict", ...SAVED_AT },
    });
    const { user } = renderEditor("header", { save });
    await user.type(field("INTRO TEXT"), "Board passers, in Iloilo.");
    await user.click(saveButton());

    expect(await within(form()).findByRole("alert")).toHaveTextContent(
      /AYC Content Team saved this section at/,
    );
    expect(field("INTRO TEXT")).toHaveValue("Board passers, in Iloilo.");
  });
});

describe("About's Our story editor", () => {
  it("has three paragraphs and five spec chips, with today's as placeholders, and no way to add more", async () => {
    const { user } = renderEditor("story");
    const paragraphs = [1, 2, 3].map((n) => field(`PARAGRAPH ${n}`));
    expect(paragraphs.map((p) => p.getAttribute("placeholder"))).toEqual([
      ...ABOUT_DEFAULTS.story.paragraphs,
      "",
    ]);
    expect([1, 2, 3, 4, 5].map((n) => field(`SPEC CHIP ${n}`).getAttribute("placeholder"))).toEqual(
      ABOUT_DEFAULTS.story.afterSpecs,
    );
    expect(within(form()).queryByLabelText("PARAGRAPH 4")).toBeNull();
    expect(within(form()).queryByLabelText("SPEC CHIP 6")).toBeNull();
    expect(within(form()).queryByRole("button", { name: /add/i })).toBeNull();

    // Once one paragraph has text, the list is what's typed: today's no longer shows.
    await user.type(paragraphs[0] ?? field("PARAGRAPH 1"), "One paragraph.");
    expect(field("PARAGRAPH 2")).toHaveAttribute("placeholder", "");
  });

  it("counts a spec chip to 20, and shows the refusal of a 21-character one", async () => {
    const save = answering<AdminAbout>({
      status: "refused",
      error: { kind: "invalid", fieldErrors: { "afterSpecs.0": ["KEEP IT TO 20 CHARACTERS"] } },
    });
    const { user } = renderEditor("story", { save });
    await user.type(field("SPEC CHIP 1"), "c".repeat(21));
    expect(within(form()).getByText("21 / 20")).toHaveClass("text-destructive");
    await user.click(saveButton());
    expect(await within(form()).findByText("KEEP IT TO 20 CHARACTERS")).toBeVisible();
    expect(field("SPEC CHIP 1")).toHaveValue("c".repeat(21));
  });

  it("uploads a 1600 × 1200 story photo 2 with no warning, asks for its alt text, and saves both", async () => {
    network.sizes.set("visit.jpg", { width: 1600, height: 1200 });
    const createUpload = answering(TICKET);
    const save = answering(
      savedWith("story", (about) => {
        about.story.photos[1] = { src: "/api/dev/uploads/1", alt: "A reviewee and her mother" };
      }),
    );
    const { user } = renderEditor("story", { save, createUpload });
    expect(within(form()).queryByLabelText("STORY PHOTO 2 · ALT TEXT")).toBeNull();

    const photo = field("STORY PHOTO 2");
    await user.upload(photo, new File(["jpg"], "visit.jpg", { type: "image/jpeg" }));
    await waitFor(() => expect(photo).toHaveAccessibleDescription("visit.jpg"));
    expect(createUpload.mock.calls[0]?.[1]).toEqual({
      input: { slot: "story-2", contentType: "image/jpeg", size: 3 },
    });
    expect(within(form()).queryByText(FOUR_THREE)).toBeNull();
    expect(within(form()).queryByText(SOFT)).toBeNull();

    await user.type(field("STORY PHOTO 2 · ALT TEXT"), "A reviewee and her mother");
    await user.click(saveButton());
    expect(await within(form()).findByText("✓ SAVED · LIVE ON THE SITE")).toBeInTheDocument();
    expect(save.mock.calls[0]?.[1].input).toMatchObject({
      photos: [
        { src: "", alt: "" },
        { src: "uploads/1", alt: "A reviewee and her mother" },
        { src: "", alt: "" },
      ],
    });
  });

  it.each([
    [{ width: 1000, height: 1000 }, [FOUR_THREE, SOFT]],
    [{ width: 800, height: 600 }, [SOFT]],
  ])("warns about a %o photo, and still saves it", async (size, warnings) => {
    network.sizes.set("photo.png", size);
    const save = answering(savedWith("story"));
    const { user } = renderEditor("story", { save, createUpload: answering(TICKET) });
    const photo = field("STORY PHOTO 1");
    await user.upload(photo, new File(["png"], "photo.png", { type: "image/png" }));
    for (const warning of warnings) {
      expect(await within(form()).findByText(warning)).toBeVisible();
    }
    await waitFor(() => expect(photo).toHaveAccessibleDescription("photo.png"));
    await user.type(field("STORY PHOTO 1 · ALT TEXT"), "Packing orders");
    await user.click(saveButton());
    expect(await within(form()).findByText("✓ SAVED · LIVE ON THE SITE")).toBeInTheDocument();
  });

  it("shows the refusal of a replaced photo with no alt text", async () => {
    const save = answering<AdminAbout>({
      status: "refused",
      error: {
        kind: "invalid",
        fieldErrors: { "photos.2.alt": ["Describe the photo for screen readers."] },
      },
    });
    const { user } = renderEditor("story", { save, createUpload: answering(TICKET) });
    const photo = field("STORY PHOTO 3");
    await user.upload(photo, new File(["png"], "hug.png", { type: "image/png" }));
    await waitFor(() => expect(photo).toHaveAccessibleDescription("hug.png"));
    await user.click(saveButton());

    expect(await within(form()).findByText("Describe the photo for screen readers.")).toBeVisible();
    expect(field("STORY PHOTO 3 · ALT TEXT")).toHaveAttribute("aria-invalid", "true");
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
    const { user, createUpload } = renderEditor("story");
    await user.upload(field("STORY PHOTO 1"), file());
    expect(await within(form()).findByText(message)).toBeVisible();
    expect(createUpload).not.toHaveBeenCalled();
    expect(field("STORY PHOTO 1")).toHaveAccessibleDescription(`${message} Today’s photo`);
  });

  it("puts today's photo back in place of a replaced one", async () => {
    const save = answering(savedWith("story"));
    const { user } = renderEditor("story", {
      save,
      about: opened((about) => {
        about.story.photos[0] = { src: "/api/dev/uploads/9", alt: "Packing orders" };
      }),
    });
    expect(field("STORY PHOTO 1 · ALT TEXT")).toHaveValue("Packing orders");
    await user.click(
      within(form()).getByRole("button", { name: "Use today’s photo for story photo 1" }),
    );
    expect(within(form()).queryByLabelText("STORY PHOTO 1 · ALT TEXT")).toBeNull();
    await user.click(saveButton());
    expect(await within(form()).findByText("✓ SAVED · LIVE ON THE SITE")).toBeInTheDocument();
    expect(save.mock.calls[0]?.[1].input).toMatchObject({
      photos: [
        { src: "", alt: "" },
        { src: "", alt: "" },
        { src: "", alt: "" },
      ],
    });
  });
});

describe("About's How it grew editor", () => {
  it("says the Exams still follow the Now text", () => {
    renderEditor("growth");
    expect(field("NOW · TEXT")).toHaveAttribute("placeholder", ABOUT_DEFAULTS.growth.nowLead);
    expect(
      within(form()).getByText(
        "The website adds “We now make reviewers for …” after it, listing the Exams.",
      ),
    ).toBeInTheDocument();
    expect(field("FIRST · TITLE")).toBeInTheDocument();
    expect(field("TODAY · TEXT")).toBeInTheDocument();
    expect(field("CLOSING LINE")).toHaveAttribute("placeholder", "And this is only the beginning.");
  });
});

describe("About's mission editor", () => {
  it("has four tabs, tab 03 with the price note, and sends a change to tab 02 alone", async () => {
    const save = answering(savedWith("mission"));
    const { user } = renderEditor("mission", { save });
    expect(field("TAB 03 · TEXT")).toHaveAttribute("placeholder", missionTabs[2]?.body);
    expect(within(form()).queryByLabelText("TAB 05 · TITLE")).toBeNull();
    expect(
      within(form()).getByText("This text names prices. Update it when prices change."),
    ).toBeInTheDocument();

    await user.type(field("TAB 02 · TITLE"), "Always current");
    await user.type(field("TAB 02 · TEXT"), "Each edition follows the exams.");
    await user.click(saveButton());
    expect(await within(form()).findByText("✓ SAVED · LIVE ON THE SITE")).toBeInTheDocument();
    expect(save.mock.calls[0]?.[1].input).toEqual({
      section: "mission",
      heading: "",
      intro: "",
      tabs: [
        { title: "", body: "" },
        { title: "Always current", body: "Each edition follows the exams." },
        { title: "", body: "" },
        { title: "", body: "" },
      ],
    });
  });
});

describe("About's roots and closing editors", () => {
  it("edits the roots' heading, text and the shipping label's To line", () => {
    renderEditor("roots");
    expect(form()).toHaveAccessibleName("Iloilo City roots");
    expect(field("HEADING")).toHaveAttribute("placeholder", ABOUT_DEFAULTS.roots.heading);
    expect(field("TEXT")).toHaveAttribute("placeholder", ABOUT_DEFAULTS.roots.body);
    expect(field("SHIPPING LABEL · TO")).toHaveAttribute(
      "placeholder",
      "Future RCE, RME, REE, RMT, CPA",
    );
  });

  it("opens the closing's saved heading", () => {
    renderEditor("closing", { about: opened((about) => (about.closing.heading = "Your turn.")) });
    expect(field("HEADING")).toHaveValue("Your turn.");
  });
});
