import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type { AdminCard } from "@/services/admin.types";
import type { ContentUploadTicket } from "@/services/uploads.types";

import { CardForm, type CardFormActions } from "./card-form";

// The card form (story 125): a card's front, back, note and back image, a
// live preview of both faces with their maths rendered, and "Save" and "Save
// & add next". The Server Actions are the boundary, so they're replaced: the
// form checks each field and the image before it uploads or saves anything,
// and shows what the server answered next to the field it's about.
const { toast, putFile } = vi.hoisted(() => ({
  toast: vi.fn(),
  putFile: vi.fn(async () => {}),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/admin/products/put-file", () => ({ putFile }));

const TOPIC = "11111111-1111-4111-8111-111111111111";
const OPENED = { savedAt: "2026-11-18T01:00:00.000Z", savedBy: null };

const CARD: AdminCard = {
  id: "22222222-2222-4222-8222-222222222222",
  position: 2,
  front: "Slope",
  back: "$m = \\frac{rise}{run}$",
  note: null,
  image: null,
  stamp: OPENED,
};

const saved = <T,>(value: T): AdminActionState<T> => ({ status: "saved", value });

function renderForm(card: AdminCard | null = null, overrides: Partial<CardFormActions> = {}) {
  const actions = {
    createCardImageUpload: vi.fn(async (): Promise<AdminActionState<ContentUploadTicket>> =>
      saved({ uploadUrl: "/upload?token=t", path: "uploads/abc", contentType: "image/png" }),
    ),
    addCard: vi.fn(async (_: unknown, { input }: { input: unknown }) =>
      saved({
        ...CARD,
        ...(input as object),
        id: "33333333-3333-4333-8333-333333333333",
        position: 3,
      }),
    ),
    saveCard: vi.fn(async (_: unknown, { input }: { input: unknown }) =>
      saved({
        ...CARD,
        ...(input as object),
        stamp: { savedAt: "2026-11-18T02:00:00.000Z", savedBy: "AYC Content Team" },
      }),
    ),
    ...overrides,
  };
  const onSaved = vi.fn();
  render(
    <CardForm
      topicId={TOPIC}
      label="MSTC · SIMPLE CURVES"
      card={card}
      imageSrc={card?.image ? "/admin/content/deck/image/x" : null}
      watermark="content@aceyourcourse.ph"
      actions={actions as CardFormActions}
      onSaved={onSaved}
    />,
  );
  return { actions, onSaved, user: userEvent.setup() };
}

const field = (name: RegExp) => screen.getByLabelText(name);
const face = (side: "front" | "back") => screen.getByRole("figure", { name: `Card ${side}` });

beforeEach(() => {
  toast.mockClear();
  putFile.mockClear();
  URL.createObjectURL = vi.fn(() => "blob:chosen");
  URL.revokeObjectURL = vi.fn();
});

describe("the card form", () => {
  it("previews both faces as Members see them, with the maths rendered as typed", async () => {
    const { user } = renderForm();
    await user.type(field(/^FRONT/), "Degree of curve");
    fireEvent.change(field(/^BACK/), { target: { value: "$D = \\frac{1145.916}{R}$" } });
    fireEvent.change(field(/^NOTE/), { target: { value: "Arc basis, \\$5" } });

    expect(face("front")).toHaveTextContent("Degree of curve");
    expect(face("back").querySelector(".katex")).not.toBeNull();
    expect(face("back")).toHaveTextContent("Arc basis, $5");
    expect(within(face("back")).getByText("BACK")).toBeInTheDocument();
  });

  it("tiles the Staff User's email across each face, as Members see theirs, as a picture", () => {
    renderForm();

    for (const side of ["front", "back"] as const) {
      const mark = face(side).querySelector("[data-watermark]");
      expect(mark).toHaveAttribute("aria-hidden", "true");
      expect(decodeURIComponent((mark as HTMLElement).style.backgroundImage)).toContain(
        "content@aceyourcourse.ph",
      );
      expect(face(side)).not.toHaveTextContent("content@aceyourcourse.ph");
    }
  });

  it("saves a new card with “Save & add next”, then clears the form for the next one", async () => {
    const { actions, onSaved, user } = renderForm();
    await user.type(field(/^FRONT/), "Degree of curve");
    fireEvent.change(field(/^BACK/), { target: { value: "$D = \\frac{1145.916}{R}$" } });
    await user.click(screen.getByRole("button", { name: "Save & add next" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(actions.addCard).toHaveBeenCalledWith(expect.anything(), {
      input: {
        topic: TOPIC,
        front: "Degree of curve",
        back: "$D = \\frac{1145.916}{R}$",
        note: "",
        image: null,
      },
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ position: 3 }), true);
    expect(field(/^FRONT/)).toHaveValue("");
    expect(field(/^BACK/)).toHaveValue("");
    expect(field(/^FRONT/)).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("✓ SAVED CARD 3 · WRITING THE NEXT ONE");
  });

  it("shows a formula that won't render in the preview, and refuses it on save", async () => {
    const { actions, user } = renderForm();
    await user.type(field(/^FRONT/), "Half");
    fireEvent.change(field(/^BACK/), { target: { value: "$\\frac{1}{$" } });

    const problem =
      "The back has a formula that won’t render, “\\frac{1}{”: Unexpected end of input in a macro argument, expected '}'";
    expect(screen.getByText(problem, { selector: "section p" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(actions.addCard).not.toHaveBeenCalled();
    expect(field(/^BACK/)).toHaveAccessibleDescription(problem);
  });

  it("refuses an empty front and back, and an over-long note, next to each field", async () => {
    const { actions, user } = renderForm();
    fireEvent.change(field(/^NOTE/), { target: { value: "n".repeat(1001) } });
    await user.click(screen.getByRole("button", { name: "Save & add next" }));

    expect(actions.addCard).not.toHaveBeenCalled();
    expect(field(/^FRONT/)).toHaveAccessibleDescription("ADD A FRONT TO SAVE");
    expect(field(/^BACK/)).toHaveAccessibleDescription("ADD A BACK TO SAVE");
    expect(field(/^NOTE/)).toHaveAccessibleDescription("KEEP IT TO 1,000 CHARACTERS");
    expect(screen.getByText("1,001 / 1,000")).toBeInTheDocument();
  });

  it.each([
    [
      "a GIF",
      new File(["gif"], "beam.gif", { type: "image/gif" }),
      "USE A JPEG, PNG OR WEBP IMAGE",
    ],
    [
      "an image over 5 MB",
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "beam.png", { type: "image/png" }),
      "KEEP THE IMAGE TO 5 MB",
    ],
  ])("refuses %s before uploading anything", async (_, file, message) => {
    const { actions } = renderForm();
    fireEvent.change(screen.getByLabelText("Add an image"), { target: { files: [file] } });

    expect(screen.getByLabelText("Add an image")).toHaveAccessibleDescription(message);
    expect(actions.createCardImageUpload).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("previews a chosen image, uploads it on save and saves its path", async () => {
    const { actions, user } = renderForm();
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "beam.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByLabelText("Add an image"), { target: { files: [file] } });
    expect(
      within(face("back")).getByRole("img", { name: "Image on the back of the card" }),
    ).toHaveAttribute("src", "blob:chosen");

    await user.type(field(/^FRONT/), "Beam");
    await user.type(field(/^BACK/), "Steel");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(actions.addCard).toHaveBeenCalled());
    expect(actions.createCardImageUpload).toHaveBeenCalledWith(expect.anything(), {
      input: { contentType: "image/png", size: 4 },
    });
    expect(putFile).toHaveBeenCalledWith(
      "/upload?token=t",
      file,
      expect.any(Function),
      "image/png",
    );
    expect(actions.addCard).toHaveBeenCalledWith(expect.anything(), {
      input: expect.objectContaining({ image: "uploads/abc" }),
    });
  });

  it("says so, and saves nothing, when the image can't be uploaded", async () => {
    putFile.mockRejectedValueOnce(new Error("offline"));
    const { actions, user } = renderForm();
    const file = new File([new Uint8Array([0x89, 0x50])], "beam.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Add an image"), { target: { files: [file] } });
    await user.type(field(/^FRONT/), "Beam");
    await user.type(field(/^BACK/), "Steel");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Replace the image")).toHaveAccessibleDescription(
        "COULDN’T UPLOAD THE IMAGE · TRY AGAIN",
      ),
    );
    expect(actions.addCard).not.toHaveBeenCalled();
  });

  it("edits a card with the stamp it opened with, then each save's own", async () => {
    const { actions, onSaved, user } = renderForm(CARD);
    expect(field(/^FRONT/)).toHaveValue("Slope");

    await user.type(field(/^FRONT/), "!");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));

    expect(actions.saveCard).toHaveBeenNthCalledWith(1, expect.anything(), {
      input: { id: CARD.id, front: "Slope!", back: CARD.back, note: "", image: null },
      expected: { savedAt: OPENED.savedAt },
    });
    expect(actions.saveCard).toHaveBeenNthCalledWith(2, expect.anything(), {
      input: expect.objectContaining({ id: CARD.id }),
      expected: { savedAt: "2026-11-18T02:00:00.000Z" },
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: CARD.id }), false);
  });

  it("removes a saved image, saving the card with none", async () => {
    const { actions, user } = renderForm({ ...CARD, image: "decks/d/i.png" });
    expect(
      within(face("back")).getByRole("img", { name: "Image on the back of the card" }),
    ).toHaveAttribute("src", "/admin/content/deck/image/x");
    await user.click(screen.getByRole("button", { name: "Remove image" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(actions.saveCard).toHaveBeenCalledWith(expect.anything(), {
        input: expect.objectContaining({ image: null }),
        expected: { savedAt: OPENED.savedAt },
      }),
    );
  });

  it("says who saved first when the edit is stale, keeping the form as it is", async () => {
    const { user } = renderForm(CARD, {
      saveCard: vi.fn(async () => ({
        status: "refused" as const,
        error: { kind: "conflict" as const, savedBy: "Angel", savedAt: "2026-11-18T02:00:00.000Z" },
      })),
    });
    await user.type(field(/^FRONT/), "?");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("SOMEONE SAVED FIRST");
    expect(screen.getByRole("alert")).toHaveTextContent(/Angel saved this card/);
    expect(field(/^FRONT/)).toHaveValue("Slope?");
  });

  it("shows the server's refusals next to their fields, and the form's own", async () => {
    const { user } = renderForm(null, {
      addCard: vi.fn(async () => ({
        status: "refused" as const,
        error: {
          kind: "invalid" as const,
          fieldErrors: { image: ["UPLOAD THE IMAGE AGAIN"], back: ["KEEP IT TO 2,000 CHARACTERS"] },
        },
      })),
    });
    await user.type(field(/^FRONT/), "Beam");
    await user.type(field(/^BACK/), "Steel");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(field(/^BACK/)).toHaveAccessibleDescription("KEEP IT TO 2,000 CHARACTERS"),
    );
    expect(screen.getByLabelText("Add an image")).toHaveAccessibleDescription(
      "UPLOAD THE IMAGE AGAIN",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "NOT SAVED · CHECK THE FIELDS MARKED IN RED",
    );
  });

  it("says the save broke down, keeping the form, when the request never arrives", async () => {
    const { user } = renderForm(null, {
      addCard: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    await user.type(field(/^FRONT/), "Beam");
    await user.type(field(/^BACK/), "Steel");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("COULDN’T SAVE");
    expect(field(/^FRONT/)).toHaveValue("Beam");
  });
});
