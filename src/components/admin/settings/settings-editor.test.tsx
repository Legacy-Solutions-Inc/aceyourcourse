import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import type { AdminActionState } from "@/lib/admin/action";
import type { AdminWebsiteSettings } from "@/services/admin.types";

import { SettingsEditor } from "./settings-editor";

// The Settings screen's three parts, each saved on its own through a Server
// Action, here a stub answering as adminAction would. Their save states,
// messages, conflict notice and "Couldn't save" toast come from the shared
// save path (useAdminForm).
const OPENED_AT = "2026-10-22T03:42:00.000Z";
const ANGEL = "Angel Rose L. Lepaña";

const INITIAL: AdminWebsiteSettings = {
  values: {
    contactEmail: "aceyourcourseinc@gmail.com",
    shopLinks: {
      shopee: "https://shopee.ph/aceyourcourse",
      lazada: "https://www.lazada.com.ph/shop/aceyourcourse",
      tiktok: null,
    },
    socialLinks: {
      tiktok: "https://www.tiktok.com/@aceyourcourse",
      facebook: "https://www.facebook.com/aceyourcourseph",
      instagram: null,
    },
    shopStats: { rating: 4.8, ratingCount: 874, followers: "3.7K", asOf: "2026-10-29" },
  },
  stamp: { savedAt: OPENED_AT, savedBy: null },
};

type State = AdminActionState<AdminWebsiteSettings>;
type Submission = { input: unknown; expected?: { savedAt: string } };

/** A stub Server Action that answers each call in turn. */
function answering(...answers: (State | (() => Promise<State>))[]) {
  return vi.fn(async (_previous: State, _submission: Submission): Promise<State> => {
    const next = answers.shift();
    if (!next) throw new Error("no more answers");
    return typeof next === "function" ? next() : next;
  });
}

const saved = (
  values: Partial<AdminWebsiteSettings["values"]>,
  savedAt = "2026-10-22T06:41:00.000Z",
): State => ({
  status: "saved",
  value: { values: { ...INITIAL.values, ...values }, stamp: { savedAt, savedBy: ANGEL } },
});

function renderEditor(actions: Partial<Parameters<typeof SettingsEditor>[0]["actions"]> = {}) {
  const user = userEvent.setup();
  render(
    <>
      <SettingsEditor
        initial={INITIAL}
        actions={{
          saveContactEmail: answering(),
          saveLinks: answering(),
          saveTrustFigures: answering(),
          ...actions,
        }}
      />
      <Toaster />
    </>,
  );
  return user;
}

const part = (name: string) => within(screen.getByRole("form", { name }));
const contact = () => part("CONTACT EMAIL");
const links = () => part("STORE & SOCIAL LINKS");
const figures = () => part("TRUST FIGURES");
const line = (form: ReturnType<typeof part>) => form.getByRole("status");

// Sonner captures the pointer on a toast to let it be swiped away; jsdom has
// no pointer capture.
beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SettingsEditor", () => {
  it("opens each part up to date, with its values, the as of date and the last change", () => {
    renderEditor();

    expect(screen.getByText("NOT CHANGED IN THE ADMIN YET")).toBeInTheDocument();
    expect(contact().getByLabelText("EMAIL ADDRESS")).toHaveValue("aceyourcourseinc@gmail.com");
    expect(links().getByLabelText("SHOPEE")).toHaveValue("https://shopee.ph/aceyourcourse");
    expect(links().getByLabelText("TIKTOK SHOP")).toHaveValue("");
    expect(links().getByLabelText("INSTAGRAM")).toHaveValue("");
    expect(figures().getByLabelText("RATING")).toHaveValue("4.8");
    expect(figures().getByLabelText("NO. OF RATINGS")).toHaveValue("874");
    expect(figures().getByLabelText("FOLLOWERS")).toHaveValue("3.7K");
    expect(figures().getByText("AS OF 29 OCT 2026 · SAVING SETS IT TO TODAY")).toBeInTheDocument();
    for (const form of [contact(), links(), figures()]) {
      expect(line(form)).toHaveTextContent("UP TO DATE");
    }
  });

  it("names who last changed the settings, and when, in Manila", () => {
    render(
      <SettingsEditor
        initial={{ ...INITIAL, stamp: { savedAt: "2026-10-14T02:00:00.000Z", savedBy: ANGEL } }}
        actions={{
          saveContactEmail: answering(),
          saveLinks: answering(),
          saveTrustFigures: answering(),
        }}
      />,
    );
    expect(
      screen.getByText("LAST CHANGED 14 OCT 2026 BY ANGEL ROSE L. LEPAÑA"),
    ).toBeInTheDocument();
  });

  it("goes from Up to date to Unsaved changes, Saving and Saved · live, sending the stamp it opened with", async () => {
    let finish: (state: State) => void = () => {};
    const saveContactEmail = answering(() => new Promise<State>((resolve) => (finish = resolve)));
    const user = renderEditor({ saveContactEmail });
    const email = contact().getByLabelText("EMAIL ADDRESS");

    await user.clear(email);
    await user.type(email, "hello@aceyourcourse.ph");
    expect(line(contact())).toHaveTextContent("UNSAVED CHANGES");

    await user.click(contact().getByRole("button", { name: "Save" }));
    expect(line(contact())).toHaveTextContent("SAVING…");
    expect(saveContactEmail).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { contactEmail: "hello@aceyourcourse.ph" }, expected: { savedAt: OPENED_AT } },
    );

    finish(saved({ contactEmail: "hello@aceyourcourse.ph" }));
    expect(await contact().findByText("✓ SAVED · LIVE ON THE SITE")).toBeInTheDocument();
    expect(screen.getByText(/^LAST CHANGED 22 OCT 2026 BY ANGEL ROSE L\. LEPAÑA$/)).toBeVisible();
    expect(email).toHaveValue("hello@aceyourcourse.ph");
  });

  it("is up to date again when an edit is undone", async () => {
    const user = renderEditor();
    const followers = figures().getByLabelText("FOLLOWERS");

    await user.type(followers, "+");
    expect(line(figures())).toHaveTextContent("UNSAVED CHANGES");
    await user.type(followers, "{Backspace}");
    expect(line(figures())).toHaveTextContent("UP TO DATE");
  });

  it("hands each save's new stamp to the other parts, so saving one and then another isn't a conflict", async () => {
    const saveContactEmail = answering(saved({ contactEmail: "hello@aceyourcourse.ph" }));
    const saveLinks = answering(saved({}, "2026-10-22T06:45:00.000Z"));
    const user = renderEditor({ saveContactEmail, saveLinks });

    await user.click(contact().getByRole("button", { name: "Save" }));
    await contact().findByText("✓ SAVED · LIVE ON THE SITE");
    await user.click(links().getByRole("button", { name: "Save links" }));

    expect(saveLinks.mock.calls[0]?.[1].expected).toEqual({ savedAt: "2026-10-22T06:41:00.000Z" });
    expect(await links().findByText("✓ SAVED · EVERY STORE BUTTON UPDATED")).toBeInTheDocument();
  });

  it("holds the other parts' saves until one part's save is back, so an Owner never conflicts with themselves", async () => {
    let finish: (state: State) => void = () => {};
    const saveContactEmail = answering(() => new Promise<State>((resolve) => (finish = resolve)));
    const saveLinks = answering(saved({}, "2026-10-22T06:45:00.000Z"));
    const user = renderEditor({ saveContactEmail, saveLinks });

    await user.click(contact().getByRole("button", { name: "Save" }));
    const saveLinksButton = links().getByRole("button", { name: "Save links" });
    expect(saveLinksButton).toBeDisabled();
    expect(figures().getByRole("button", { name: "Save figures" })).toBeDisabled();

    finish(saved({ contactEmail: "aceyourcourseinc@gmail.com" }));
    await waitFor(() => expect(saveLinksButton).toBeEnabled());
    await user.click(saveLinksButton);

    expect(saveLinks.mock.calls[0]?.[1].expected).toEqual({ savedAt: "2026-10-22T06:41:00.000Z" });
  });

  it("shows the links as saved, with https:// added, and empty links still empty", async () => {
    const saveLinks = answering(
      saved({ shopLinks: { ...INITIAL.values.shopLinks, shopee: "https://shopee.ph/newshop" } }),
    );
    const user = renderEditor({ saveLinks });
    const shopee = links().getByLabelText("SHOPEE");

    await user.clear(shopee);
    await user.type(shopee, "shopee.ph/newshop");
    await user.click(links().getByRole("button", { name: "Save links" }));

    await links().findByText("✓ SAVED · EVERY STORE BUTTON UPDATED");
    expect(shopee).toHaveValue("https://shopee.ph/newshop");
    expect(links().getByLabelText("TIKTOK SHOP")).toHaveValue("");
    expect(saveLinks.mock.calls[0]?.[1].input).toEqual({
      shopLinks: {
        shopee: "shopee.ph/newshop",
        lazada: "https://www.lazada.com.ph/shop/aceyourcourse",
        tiktok: "",
      },
      socialLinks: {
        tiktok: "https://www.tiktok.com/@aceyourcourse",
        facebook: "https://www.facebook.com/aceyourcourseph",
        instagram: "",
      },
    });
  });

  it("shows a refused field's message under it, keeps every value, and drops the message once it's edited", async () => {
    const saveLinks = answering({
      status: "refused",
      error: {
        kind: "invalid",
        fieldErrors: {
          "shopLinks.shopee": ["SHOULD BE A SHOPEE.PH LINK"],
          "socialLinks.tiktok": ["SHOULD LOOK LIKE TIKTOK.COM/@NAME"],
        },
      },
    });
    const user = renderEditor({ saveLinks });
    const shopee = links().getByLabelText("SHOPEE");
    await user.clear(shopee);
    await user.type(shopee, "https://www.lazada.com.ph/x");

    await user.click(links().getByRole("button", { name: "Save links" }));

    expect(await links().findByText("SHOULD BE A SHOPEE.PH LINK")).toBeInTheDocument();
    expect(shopee).toHaveValue("https://www.lazada.com.ph/x");
    expect(shopee).toHaveAttribute("aria-invalid", "true");
    expect(shopee).toHaveAccessibleDescription("SHOULD BE A SHOPEE.PH LINK");
    expect(line(links())).toHaveTextContent("FIX THE LINKS MARKED IN RED");

    await user.type(shopee, "y");
    expect(links().queryByText("SHOULD BE A SHOPEE.PH LINK")).not.toBeInTheDocument();
    expect(shopee).not.toHaveAttribute("aria-invalid");
    expect(links().getByText("SHOULD LOOK LIKE TIKTOK.COM/@NAME")).toBeInTheDocument();
    expect(line(links())).toHaveTextContent("UNSAVED CHANGES");
  });

  it("says who saved first, and when, in a conflict, and keeps the form's values", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T16:05:00+08:00"));
    const saveContactEmail = answering({
      status: "refused",
      error: { kind: "conflict", savedBy: ANGEL, savedAt: "2026-10-22T14:41:00+08:00" },
    });
    const user = renderEditor({ saveContactEmail });
    const email = contact().getByLabelText("EMAIL ADDRESS");
    await user.clear(email);
    await user.type(email, "mine@aceyourcourse.ph");

    await user.click(contact().getByRole("button", { name: "Save" }));

    expect(await contact().findByRole("alert")).toHaveTextContent(
      "Angel Rose L. Lepaña saved these settings at 2:41 PM. Copy your changes, then reload to see theirs.",
    );
    expect(email).toHaveValue("mine@aceyourcourse.ph");
    expect(line(contact())).toHaveTextContent("NOT SAVED");
    expect(contact().getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });

  it("shows the Couldn't save toast when a save fails, and Try again sends the same values again", async () => {
    const saveTrustFigures = answering(
      { status: "failed" },
      saved({
        shopStats: { rating: 4.9, ratingCount: 874, followers: "3.7K", asOf: "2026-10-22" },
      }),
    );
    const user = renderEditor({ saveTrustFigures });
    const rating = figures().getByLabelText("RATING");
    await user.clear(rating);
    await user.type(rating, "4.9");

    await user.click(figures().getByRole("button", { name: "Save figures" }));

    expect(await screen.findByText("COULDN’T SAVE")).toBeInTheDocument();
    expect(
      screen.getByText(
        "“Trust figures” wasn’t saved. Check your connection. Your edits are still in the form.",
      ),
    ).toBeInTheDocument();
    expect(rating).toHaveValue("4.9");
    expect(line(figures())).toHaveTextContent("COULDN’T SAVE · YOUR EDITS ARE STILL IN THE FORM");

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await figures().findByText("✓ SAVED · LIVE ON THE SITE")).toBeInTheDocument();
    expect(saveTrustFigures).toHaveBeenCalledTimes(2);
    expect(saveTrustFigures.mock.calls[1]?.[1]).toEqual(saveTrustFigures.mock.calls[0]?.[1]);
    expect(saveTrustFigures.mock.calls[1]?.[1].input).toEqual({
      shopStats: { rating: "4.9", ratingCount: "874", followers: "3.7K" },
    });
    await waitFor(() => expect(screen.queryByText("COULDN’T SAVE")).not.toBeInTheDocument());
    expect(figures().getByText("AS OF 22 OCT 2026 · SAVING SETS IT TO TODAY")).toBeInTheDocument();
  });

  it("treats a save whose request never arrives as failed, keeping the edits", async () => {
    const saveContactEmail = answering(() => Promise.reject(new TypeError("Failed to fetch")));
    const user = renderEditor({ saveContactEmail });
    const email = contact().getByLabelText("EMAIL ADDRESS");
    await user.type(email, "x");

    await user.click(contact().getByRole("button", { name: "Save" }));

    expect(await screen.findByText("COULDN’T SAVE")).toBeInTheDocument();
    expect(email).toHaveValue("aceyourcourseinc@gmail.comx");
  });

  it("shows a refusal's own message, such as an Owners-only one", async () => {
    const saveContactEmail = answering({
      status: "refused",
      error: { kind: "forbidden", message: "ONLY AN OWNER CAN DO THIS" },
    });
    const user = renderEditor({ saveContactEmail });

    await user.click(contact().getByRole("button", { name: "Save" }));

    expect(await contact().findByText("ONLY AN OWNER CAN DO THIS")).toBeInTheDocument();
  });
});
