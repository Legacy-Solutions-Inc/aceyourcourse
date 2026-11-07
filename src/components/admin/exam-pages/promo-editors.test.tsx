import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import type { AdminActionState } from "@/lib/admin/action";
import type { PromoStatus } from "@/lib/admin/promo-status";
import type { AdminAnnouncement, AdminPromoBanner } from "@/services/admin.types";

import { AnnouncementEditor } from "./announcement-editor";
import { type PromoBannerActions, PromoBannerEditor } from "./promo-banner-editor";

// The Home promo banner and announcement bar editors (BUILD-MAP §3.2, §2
// unpublish), saving through stub Server Actions that answer as adminAction
// would. The router is the framework boundary, so it's replaced.
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  unstable_rethrow: () => {},
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

const STAMP = { savedAt: "2026-10-22T03:42:00.000Z", savedBy: null };
const SAVED_AT = { savedAt: "2026-10-22T03:43:00.000Z", savedBy: "AYC Content Team" };

const BANNER = {
  visible: true,
  text: "11.11 · Any 2 reviewers, 4% off on Shopee",
  buttonLabel: "Shop the sale",
  href: "https://shopee.ph/aceyourcourse",
  startDate: "2026-11-09",
  endDate: "2026-11-11",
};
const ON: PromoStatus = { kind: "on", line: "ON · SHOWS 9–11 NOV" };
const SCHEDULED: PromoStatus = { kind: "scheduled", line: "SCHEDULED · STARTS 9 NOV" };
const OFF: PromoStatus = { kind: "off", line: "OFF" };

const bannerAs = (fields: Partial<typeof BANNER> = {}): AdminPromoBanner => ({
  banner: { ...BANNER, ...fields },
  stamp: STAMP,
});

beforeEach(() => {
  router.refresh.mockClear();
});

describe("PromoBannerEditor", () => {
  function renderBanner(
    opened: AdminPromoBanner,
    status: PromoStatus,
    actions: Partial<PromoBannerActions> = {},
  ) {
    const user = userEvent.setup();
    const all = {
      save: answering<AdminPromoBanner>(),
      setVisible: answering<AdminPromoBanner>(),
      ...actions,
    };
    render(
      <>
        <PromoBannerEditor opened={opened} status={status} actions={all} />
        <Toaster />
      </>,
    );
    return { user, ...all };
  }
  const form = () => screen.getByRole("form", { name: "Home promo banner" });
  const showBanner = () => screen.getByRole("switch", { name: "Show banner" });

  it("shows the mockup's fields, the note, the status line and the counters", () => {
    renderBanner(bannerAs(), ON);

    expect(screen.getByText("ON · SHOWS 9–11 NOV")).toBeInTheDocument();
    expect(within(form()).getByLabelText("BANNER TEXT")).toHaveValue(BANNER.text);
    expect(within(form()).getByLabelText("BUTTON LABEL")).toHaveValue("Shop the sale");
    expect(within(form()).getByLabelText("LINK")).toHaveValue(BANNER.href);
    expect(within(form()).getByLabelText("STARTS ON")).toHaveValue("2026-11-09");
    expect(within(form()).getByLabelText("ENDS ON")).toHaveValue("2026-11-11");
    expect(within(form()).getByText("41 / 80")).toBeInTheDocument();
    expect(within(form()).getByText("13 / 24")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The banner turns off by itself after the end date. Everything else on Home is fixed.",
      ),
    ).toBeInTheDocument();
    expect(showBanner()).toHaveAttribute("aria-checked", "true");
  });

  it("turns the counter red past the limit", async () => {
    const { user } = renderBanner(bannerAs(), OFF);
    await user.type(within(form()).getByLabelText("BUTTON LABEL"), " today and tomorrow");

    expect(within(form()).getByText("32 / 24")).toHaveClass("text-destructive");
  });

  it("saves the fields with the stamp it opened with, then says it's live on Home", async () => {
    const save = answering<AdminPromoBanner>({
      status: "saved",
      value: { banner: { ...BANNER, buttonLabel: "Shop now" }, stamp: SAVED_AT },
    });
    const { user } = renderBanner(bannerAs(), ON, { save });

    const label = within(form()).getByLabelText("BUTTON LABEL");
    await user.clear(label);
    await user.type(label, "Shop now");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("✓ SAVED · LIVE ON HOME")).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(expect.anything(), {
      input: {
        text: BANNER.text,
        buttonLabel: "Shop now",
        href: BANNER.href,
        startDate: "2026-11-09",
        endDate: "2026-11-11",
      },
      expected: { savedAt: STAMP.savedAt },
    });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("shows each refused field's message, keeping the edits", async () => {
    const save = answering<AdminPromoBanner>({
      status: "refused",
      error: {
        kind: "invalid",
        fieldErrors: { endDate: ["The end date can’t be before the start date."] },
      },
    });
    const { user } = renderBanner(bannerAs(), SCHEDULED, { save });

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("FIX THE FIELDS MARKED IN RED")).toBeInTheDocument();
    expect(within(form()).getByLabelText("ENDS ON")).toHaveAccessibleDescription(
      "The end date can’t be before the start date.",
    );
  });

  it("says who saved first when the save is stale", async () => {
    const save = answering<AdminPromoBanner>({
      status: "refused",
      error: { kind: "conflict", savedBy: "Angel Rose L. Lepaña", savedAt: SAVED_AT.savedAt },
    });
    const { user } = renderBanner(bannerAs(), ON, { save });

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Angel Rose L\. Lepaña saved the banner at/,
    );
  });

  it("turns a scheduled banner off at once, with no confirmation", async () => {
    const setVisible = answering<AdminPromoBanner>({
      status: "saved",
      value: bannerAs({ visible: false }),
    });
    const { user } = renderBanner(bannerAs(), SCHEDULED, { setVisible });

    expect(screen.queryByRole("button", { name: "Turn off banner now" })).not.toBeInTheDocument();
    await user.click(showBanner());

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(setVisible).toHaveBeenCalledWith(expect.anything(), { input: { visible: false } });
  });

  it("turns the banner on with the switch", async () => {
    const setVisible = answering<AdminPromoBanner>({ status: "saved", value: bannerAs() });
    const { user } = renderBanner(bannerAs({ visible: false }), OFF, { setVisible });

    await user.click(showBanner());

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(setVisible).toHaveBeenCalledWith(expect.anything(), { input: { visible: true } });
  });

  it("asks before turning off a banner that's on Home now, and Cancel keeps it", async () => {
    const { user, setVisible } = renderBanner(bannerAs(), ON);

    await user.click(screen.getByRole("button", { name: "Turn off banner now" }));
    const dialog = screen.getByRole("dialog", {
      name: "Turn off the “11.11 · Any 2 reviewers, 4% off on Shopee” banner now?",
    });
    expect(dialog).toHaveAccessibleDescription(
      "It disappears from Home right away instead of on 11 Nov. The text stays saved, so you can reuse it for the next sale.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(setVisible).not.toHaveBeenCalled();
  });

  it("turns it off once confirmed, from the button or the switch", async () => {
    const setVisible = answering<AdminPromoBanner>(
      { status: "saved", value: bannerAs({ visible: false }) },
      { status: "saved", value: bannerAs({ visible: false }) },
    );
    const { user } = renderBanner(bannerAs(), ON, { setVisible });

    await user.click(showBanner());
    await user.click(screen.getByRole("button", { name: "Turn off banner" }));

    expect(await screen.findByText("✓ TURNED OFF · THE BANNER IS OFF HOME")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(setVisible).toHaveBeenCalledWith(expect.anything(), { input: { visible: false } });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("keeps the confirmation open with a message when turning it off fails", async () => {
    const setVisible = vi.fn(async () => {
      throw new Error("offline");
    });
    const { user } = renderBanner(bannerAs(), ON, { setVisible });

    await user.click(screen.getByRole("button", { name: "Turn off banner now" }));
    await user.click(screen.getByRole("button", { name: "Turn off banner" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "COULDN’T TURN IT OFF · CHECK YOUR CONNECTION AND TRY AGAIN",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows the “Couldn't save” toast when the save breaks down, keeping the edits", async () => {
    const save = answering<AdminPromoBanner>({ status: "failed" });
    const { user } = renderBanner(bannerAs(), OFF, { save });

    await user.type(within(form()).getByLabelText("BUTTON LABEL"), "!");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("COULDN’T SAVE")).toBeInTheDocument();
    expect(screen.getByText(/“The Home promo banner” wasn’t saved/)).toBeInTheDocument();
    expect(within(form()).getByLabelText("BUTTON LABEL")).toHaveValue("Shop the sale!");
  });

  it("can't show a banner the Website doesn't have yet", () => {
    renderBanner({ banner: null, stamp: STAMP }, OFF);

    expect(showBanner()).toBeDisabled();
    expect(screen.getByText("Save the banner first")).toBeInTheDocument();
    expect(within(form()).getByLabelText("BANNER TEXT")).toHaveValue("");
  });
});

describe("AnnouncementEditor", () => {
  const MESSAGES = [
    { text: "Physical copies on Shopee", href: "/products", requiresMemberApp: false },
    { text: "Digital reviewers in the app", href: "/app", requiresMemberApp: true },
  ];
  const opened = (messages = MESSAGES): AdminAnnouncement => ({
    announcement: { id: "2026-10-launch", messages },
    memberAppLive: false,
    stamp: STAMP,
  });

  function renderAnnouncement(action = answering<AdminAnnouncement>(), messages = MESSAGES) {
    const user = userEvent.setup();
    render(
      <>
        <AnnouncementEditor opened={opened(messages)} action={action} />
        <Toaster />
      </>,
    );
    return { user, action };
  }
  const message = (n: number) => screen.getByRole("group", { name: `MESSAGE ${n}` });
  /** Each message's TEXT, in order. */
  const expectTexts = (values: string[]) => {
    const fields = screen
      .getAllByRole("group")
      .map((group) => within(group).getByLabelText("TEXT"));
    expect(fields).toHaveLength(values.length);
    fields.forEach((field, index) => expect(field).toHaveValue(values[index]));
  };

  it("lists the messages in order, each with its fields, and the notes", () => {
    renderAnnouncement();

    expectTexts(["Physical copies on Shopee", "Digital reviewers in the app"]);
    expect(within(message(2)).getByLabelText("LINK")).toHaveValue("/app");
    expect(
      within(message(2)).getByRole("switch", { name: "Only while the Member App is live" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(within(message(1)).getByText("25 / 70")).toBeInTheDocument();
    expect(screen.getByText("2 OF 3 MESSAGES")).toBeInTheDocument();
    expect(screen.getByText(/shows the bar again to Visitors who closed it/)).toHaveTextContent(
      "The Member App isn’t live yet, so messages only for it don’t show.",
    );
    expect(within(message(1)).getByRole("button", { name: "Move message 1 up" })).toBeDisabled();
    expect(within(message(2)).getByRole("button", { name: "Move message 2 down" })).toBeDisabled();
  });

  it("reorders with ▲▼ and saves the new order with the stamp it opened with", async () => {
    const action = answering<AdminAnnouncement>({
      status: "saved",
      value: {
        ...opened([MESSAGES[1], MESSAGES[0]].filter((m) => m !== undefined)),
        stamp: SAVED_AT,
      },
    });
    const { user } = renderAnnouncement(action);

    await user.click(within(message(1)).getByRole("button", { name: "Move message 1 down" }));
    expectTexts(["Digital reviewers in the app", "Physical copies on Shopee"]);
    expect(screen.getByText("UNSAVED CHANGES")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("✓ SAVED · LIVE ON EVERY PAGE")).toBeInTheDocument();
    expect(action).toHaveBeenCalledWith(expect.anything(), {
      input: { messages: [MESSAGES[1], MESSAGES[0]] },
      expected: { savedAt: STAMP.savedAt },
    });
  });

  it("adds a third message, then no more, and Remove takes it back down", async () => {
    const { user } = renderAnnouncement();

    await user.click(screen.getByRole("button", { name: "+ Add message" }));
    await user.type(within(message(3)).getByLabelText("TEXT"), "New in the app");
    await user.click(
      within(message(3)).getByRole("switch", { name: "Only while the Member App is live" }),
    );
    expect(screen.getByText("3 OF 3 MESSAGES")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add message" })).toBeDisabled();

    await user.click(within(message(3)).getByRole("button", { name: "Remove message 3" }));
    expect(screen.queryByRole("group", { name: "MESSAGE 3" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add message" })).toBeEnabled();
  });

  it("removes a message from the middle, keeping the others' edits", async () => {
    const { user } = renderAnnouncement(undefined, [
      ...MESSAGES,
      { text: "Ships from Iloilo City", href: "/faq", requiresMemberApp: false },
    ]);

    await user.type(within(message(3)).getByLabelText("TEXT"), "!");
    await user.click(within(message(2)).getByRole("button", { name: "Remove message 2" }));

    expectTexts(["Physical copies on Shopee", "Ships from Iloilo City!"]);
  });

  it("can't remove the only message: the bar needs one", () => {
    renderAnnouncement(undefined, MESSAGES.slice(0, 1));

    expect(within(message(1)).getByRole("button", { name: "Remove message 1" })).toBeDisabled();
  });

  it("shows a refused message's field error under it, and the form's message", async () => {
    const action = answering<AdminAnnouncement>({
      status: "refused",
      error: {
        kind: "invalid",
        fieldErrors: { "messages.1.href": ["ENTER AN HTTPS LINK OR A PATH STARTING WITH /"] },
      },
    });
    const { user } = renderAnnouncement(action);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("FIX THE FIELDS MARKED IN RED")).toBeInTheDocument();
    expect(within(message(2)).getByLabelText("LINK")).toHaveAccessibleDescription(
      "ENTER AN HTTPS LINK OR A PATH STARTING WITH /",
    );
  });

  it("says who saved first when the save is stale", async () => {
    const action = answering<AdminAnnouncement>({
      status: "refused",
      error: { kind: "conflict", savedBy: "Angel Rose L. Lepaña", savedAt: SAVED_AT.savedAt },
    });
    const { user } = renderAnnouncement(action);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Angel Rose L\. Lepaña saved the announcement bar at/,
    );
  });

  it("shows the “Couldn't save” toast when the save breaks down, keeping the edits", async () => {
    const { user } = renderAnnouncement(answering<AdminAnnouncement>({ status: "failed" }));

    await user.type(within(message(1)).getByLabelText("TEXT"), "!");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("COULDN’T SAVE")).toBeInTheDocument();
    expect(screen.getByText(/“The announcement bar” wasn’t saved/)).toBeInTheDocument();
    expect(within(message(1)).getByLabelText("TEXT")).toHaveValue("Physical copies on Shopee!");
  });
});
