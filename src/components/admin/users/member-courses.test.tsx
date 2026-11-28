import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type { CourseOwnershipChange } from "@/services/admin.types";
import type { OwnedCourse } from "@/services/member.types";

import { type CourseActions, MemberCourses } from "./member-courses";

// COURSES on a Member's detail page (Phase 5, ticket 07; spec, Phase 5
// planning decisions → Giving a Course; story 172): the Courses they own,
// each with its source, "Remove…" on a given one only, and "Give Course…"
// for a separately sold Course they don't own. No payment is collected, and
// the Member gets an in-app notice. The Server Actions are the boundary, so
// they're replaced; the panel shows what they answer and reads the page again.
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  unstable_rethrow: () => {},
}));

const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  name: "Bea Tester",
  email: "tester@example.com",
};
const PSAD = "6a1e2d3c-4b5a-4f6e-8d7c-9b0a1f2e3d4c";
const HPGE = "7b2f3e4d-5c6b-4a7f-9e8d-0c1b2a3f4e5d";
const STRUCTURES = "8c3a4f5e-6d7c-4b8a-8f9e-1d2c3b4a5f6e";

/** Bought with AYC-10483 at 20:00 on 28 Nov 2026 in Manila. */
const PAID: OwnedCourse = {
  courseId: PSAD,
  title: "PSAD Masterclass",
  examCode: "CE",
  since: "2026-11-28T12:00:00.000Z",
  orderReference: "AYC-10483",
};
/** Given by an Owner just after midnight on 30 Nov in Manila (still 29 Nov in UTC). */
const GIVEN: OwnedCourse = {
  courseId: HPGE,
  title: "HPGE Crash Course",
  examCode: "CE",
  since: "2026-11-29T16:30:00.000Z",
  orderReference: null,
};
/** Every Course sold separately, as One-time purchases lists them. */
const SOLD_SEPARATELY = [
  { id: PSAD, title: "PSAD Masterclass", examCode: "CE" },
  { id: HPGE, title: "HPGE Crash Course", examCode: "CE" },
  { id: STRUCTURES, title: "Structures Bootcamp", examCode: "CE" },
];

const GIVEN_CHANGE: CourseOwnershipChange = {
  userId: BEA.userId,
  courseId: STRUCTURES,
  course: "Structures Bootcamp",
  since: "2026-11-30T02:00:00.000Z",
  targetExam: null,
};

type State = AdminActionState<CourseOwnershipChange>;

function renderPanel({
  courses = [PAID, GIVEN],
  answer = { status: "saved", value: GIVEN_CHANGE } as State,
} = {}) {
  const answering = () => vi.fn(async (): Promise<State> => answer);
  const actions = { give: answering(), remove: answering() };
  const user = userEvent.setup();
  render(
    <MemberCourses
      member={BEA}
      courses={courses}
      soldSeparately={SOLD_SEPARATELY}
      actions={actions satisfies CourseActions}
    />,
  );
  return { user, actions };
}

const section = () => screen.getByRole("region", { name: "COURSES" });
const row = (title: string) => within(section()).getByRole("listitem", { name: title });
const dialog = () => screen.getByRole("dialog");
const status = () => within(section()).getByRole("status");

describe("MemberCourses", () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  it("lists each Course with since when, in Manila, and its source", () => {
    renderPanel();
    expect(row("PSAD Masterclass")).toHaveTextContent("CE · SINCE 28 NOV 2026 · AYC-10483");
    expect(row("HPGE Crash Course")).toHaveTextContent(
      "CE · SINCE 30 NOV 2026 · GIVEN BY ACE YOUR COURSE",
    );
  });

  it("offers Remove only on a given Course: a paid one goes by a refund in PayMongo", () => {
    renderPanel();
    expect(
      within(row("HPGE Crash Course")).getByRole("button", { name: "Remove… HPGE Crash Course" }),
    ).toBeVisible();
    expect(within(row("PSAD Masterclass")).queryByRole("button", { name: /^Remove…/ })).toBeNull();
    expect(row("PSAD Masterclass")).toHaveTextContent(
      "Paid · a full refund in PayMongo removes it",
    );
  });

  it("says a Member with no Course has none, and still offers one to give", () => {
    renderPanel({ courses: [] });
    expect(section()).toHaveTextContent("No Courses. Courses they buy or are given show here.");
    expect(screen.getByRole("button", { name: "Give Course…" })).toBeEnabled();
  });

  it("offers nothing to give once they own every Course sold separately", () => {
    renderPanel({
      courses: [PAID, GIVEN, { ...GIVEN, courseId: STRUCTURES, title: "Structures Bootcamp" }],
    });
    expect(screen.getByRole("button", { name: "Give Course…" })).toBeDisabled();
  });

  describe("Give Course", () => {
    it("offers only the Courses sold separately they don't own, and says no payment is collected", async () => {
      const { user, actions } = renderPanel();
      await user.click(screen.getByRole("button", { name: "Give Course…" }));

      expect(dialog()).toHaveAccessibleName("Give Bea a Course");
      expect(dialog()).toHaveTextContent("No payment is collected.");
      expect(dialog()).toHaveTextContent("in-app notice");
      const course = within(dialog()).getByRole("combobox", { name: "COURSE" });
      expect(
        within(course)
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(["Structures Bootcamp · CE"]);
      expect(actions.give).not.toHaveBeenCalled();
    });

    it("sends the Member and the Course, then says what was given", async () => {
      const { user, actions } = renderPanel();
      await user.click(screen.getByRole("button", { name: "Give Course…" }));
      await user.click(within(dialog()).getByRole("button", { name: "Give Course" }));

      expect(actions.give).toHaveBeenCalledWith(
        { status: "idle" },
        { input: { userId: BEA.userId, courseId: STRUCTURES } },
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(status()).toHaveTextContent("✓ GAVE THE STRUCTURES BOOTCAMP · NO PAYMENT COLLECTED");
      expect(refresh).toHaveBeenCalled();
    });

    it("shows a refusal on the Course next to it, keeping the dialog open", async () => {
      const { user } = renderPanel({
        answer: {
          status: "refused",
          error: {
            kind: "invalid",
            fieldErrors: {
              courseId: ["That isn’t a Course sold separately. Pick one from the list."],
            },
          },
        },
      });
      await user.click(screen.getByRole("button", { name: "Give Course…" }));
      await user.click(within(dialog()).getByRole("button", { name: "Give Course" }));

      expect(
        within(dialog()).getByRole("combobox", { name: "COURSE" }),
      ).toHaveAccessibleDescription("That isn’t a Course sold separately. Pick one from the list.");
    });

    it("says why the server refused, closing the dialog", async () => {
      const { user } = renderPanel({
        answer: {
          status: "refused",
          error: {
            kind: "invalid",
            fieldErrors: {},
            formError: "This Member already owns the Structures Bootcamp. Nothing was changed.",
          },
        },
      });
      await user.click(screen.getByRole("button", { name: "Give Course…" }));
      await user.click(within(dialog()).getByRole("button", { name: "Give Course" }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(status()).toHaveTextContent(
        "This Member already owns the Structures Bootcamp. Nothing was changed.",
      );
    });
  });

  describe("Remove Course", () => {
    it("asks first, then sends the Member and the Course and says it was removed", async () => {
      const { user, actions } = renderPanel({
        answer: {
          status: "saved",
          value: { ...GIVEN_CHANGE, courseId: HPGE, course: "HPGE Crash Course", since: null },
        },
      });
      await user.click(
        within(row("HPGE Crash Course")).getByRole("button", { name: "Remove… HPGE Crash Course" }),
      );

      expect(dialog()).toHaveAccessibleName("Remove the HPGE Crash Course from Bea?");
      expect(dialog()).toHaveTextContent("in-app notice");
      expect(dialog()).toHaveTextContent("Lesson progress stays");
      await user.click(within(dialog()).getByRole("button", { name: "Remove Course" }));

      expect(actions.remove).toHaveBeenCalledWith(
        { status: "idle" },
        { input: { userId: BEA.userId, courseId: HPGE } },
      );
      expect(status()).toHaveTextContent("✓ REMOVED THE HPGE CRASH COURSE");
    });
  });

  it("says nothing changed when the server can't be reached", async () => {
    const { user } = renderPanel({ answer: { status: "failed" } });
    await user.click(screen.getByRole("button", { name: "Give Course…" }));
    await user.click(within(dialog()).getByRole("button", { name: "Give Course" }));

    expect(within(dialog()).getByRole("alert")).toHaveTextContent(
      "Couldn’t reach the server, so nothing was changed.",
    );
  });
});
