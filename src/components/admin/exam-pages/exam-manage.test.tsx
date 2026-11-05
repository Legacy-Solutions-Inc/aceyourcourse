import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import type { AdminActionState } from "@/lib/admin/action";
import type { AdminExamPage } from "@/services/admin.types";
import { examPageDefaults } from "@/services/catalogue.schema";
import type { Exam } from "@/services/catalogue.types";

import { AddExamForm, AddSubjectForm, DeleteExam, RemoveSubject } from "./exam-manage";

// "+ Add exam", "+ Add subject", a Subject's remove button and "Delete exam"
// (ticket 23), saving through stub Server Actions that answer as adminAction
// would. The router is the framework boundary, so it's replaced.
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));
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

const CHE: Exam = {
  code: "CHE",
  board: "CHELE",
  name: "Chemical Engineering",
  longName: "Chemical Engineer Licensure Exam",
  blurb: "Every ChE formula.",
  madeFor: "ChE reviewees",
  subjects: [
    { code: "PCHEM", name: "Physical Chemistry" },
    { code: "THERMO", name: "Thermodynamics" },
  ],
};

function chePage(changes: Partial<AdminExamPage> = {}): AdminExamPage {
  return {
    exam: structuredClone(CHE),
    page: examPageDefaults("CHE"),
    stamps: {
      header: STAMP,
      subjects: STAMP,
      sections: STAMP,
      bundleOffer: STAMP,
      seo: STAMP,
      officialExamDate: STAMP,
    },
    products: [],
    subjectProducts: { PCHEM: 0, THERMO: 0 },
    examsOnWebsite: ["CE"],
    ...changes,
  };
}

const ANY = expect.anything();

beforeEach(() => {
  router.refresh.mockClear();
  router.replace.mockClear();
  router.push.mockClear();
});

describe("+ Add exam", () => {
  async function fill(user: ReturnType<typeof userEvent.setup>) {
    const form = screen.getByRole("form", { name: "New exam" });
    await user.type(within(form).getByLabelText("EXAM CODE"), "che");
    await user.type(within(form).getByLabelText("BOARD ACRONYM"), "CHELE");
    await user.type(within(form).getByLabelText("EXAM NAME"), "Chemical Engineering");
    await user.type(within(form).getByLabelText("LONG NAME"), "Chemical Engineer Licensure Exam");
    await user.type(within(form).getByLabelText("TEXT"), "Every ChE formula.");
    await user.type(within(form).getByLabelText("MADE FOR"), "ChE reviewees");
    await user.type(within(form).getByLabelText("01 · CODE"), "PCHEM");
    await user.type(within(form).getByLabelText("01 · NAME"), "Physical Chemistry");
    await user.click(within(form).getByRole("button", { name: "+ Add another subject" }));
    await user.type(within(form).getByLabelText("02 · CODE"), "CHE PROF");
    await user.type(within(form).getByLabelText("02 · NAME"), "ChE Professional Subjects");
    return form;
  }

  it("sends the codes, the Header and the Subjects, then opens the new Exam's Header", async () => {
    const user = userEvent.setup();
    const addExam = answering<AdminExamPage>({ status: "saved", value: chePage() });
    render(<AddExamForm action={addExam} />);

    const form = await fill(user);
    await user.click(within(form).getByRole("button", { name: "Add exam" }));

    expect(addExam).toHaveBeenCalledWith(ANY, {
      input: {
        code: "che",
        board: "CHELE",
        name: "Chemical Engineering",
        longName: "Chemical Engineer Licensure Exam",
        blurb: "Every ChE formula.",
        madeFor: "ChE reviewees",
        subjects: [
          { code: "PCHEM", name: "Physical Chemistry" },
          { code: "CHE PROF", name: "ChE Professional Subjects" },
        ],
      },
      expected: ANY,
    });
    expect(router.push).toHaveBeenCalledWith("/admin/exam-pages?exam=che");
  });

  it("shows the page address the code makes as it's typed", async () => {
    const user = userEvent.setup();
    render(<AddExamForm action={answering()} />);
    await user.type(screen.getByLabelText("EXAM CODE"), "ChE");
    expect(screen.getByText(/aceyourcourse\.ph\/exams\/che$/)).toBeInTheDocument();
  });

  it("keeps the typed values when the code is already an Exam, saying so on the field", async () => {
    const user = userEvent.setup();
    const addExam = answering<AdminExamPage>({
      status: "refused",
      error: { kind: "invalid", fieldErrors: { code: ["CHE IS ALREADY AN EXAM"] } },
    });
    render(<AddExamForm action={addExam} />);

    const form = await fill(user);
    await user.click(within(form).getByRole("button", { name: "Add exam" }));

    const code = within(form).getByLabelText("EXAM CODE");
    expect(await within(form).findByText("CHE IS ALREADY AN EXAM")).toBeInTheDocument();
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(code).toHaveValue("che");
    expect(within(form).getByLabelText("EXAM NAME")).toHaveValue("Chemical Engineering");
    expect(within(form).getByLabelText("02 · CODE")).toHaveValue("CHE PROF");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("shows each Subject row's message, and the message for no Subject", async () => {
    const user = userEvent.setup();
    const addExam = answering<AdminExamPage>({
      status: "refused",
      error: {
        kind: "invalid",
        fieldErrors: {
          subjects: ["ADD AT LEAST ONE SUBJECT"],
          "subjects.0.name": ["ADD THE SUBJECT’S NAME"],
        },
      },
    });
    render(<AddExamForm action={addExam} />);

    await user.click(screen.getByRole("button", { name: "Add exam" }));

    expect(await screen.findByText("ADD AT LEAST ONE SUBJECT")).toBeInTheDocument();
    expect(screen.getByLabelText("01 · NAME")).toHaveAccessibleDescription(
      "ADD THE SUBJECT’S NAME",
    );
    expect(screen.getByRole("status")).toHaveTextContent("FIX THE FIELDS MARKED IN RED");
  });

  it("removes a Subject row from the middle, keeping the others' values", async () => {
    const user = userEvent.setup();
    render(<AddExamForm action={answering()} />);
    await user.type(screen.getByLabelText("01 · CODE"), "A");
    await user.click(screen.getByRole("button", { name: "+ Add another subject" }));
    await user.type(screen.getByLabelText("02 · CODE"), "B");
    await user.click(screen.getByRole("button", { name: "+ Add another subject" }));
    await user.type(screen.getByLabelText("03 · CODE"), "C");

    await user.click(screen.getByRole("button", { name: "Remove Subject 02" }));

    expect(screen.getByLabelText("01 · CODE")).toHaveValue("A");
    expect(screen.getByLabelText("02 · CODE")).toHaveValue("C");
    expect(screen.queryByLabelText("03 · CODE")).toBeNull();
  });
});

describe("+ Add subject", () => {
  it("sends the Exam and the new Subject, clears the fields, and reads the page again", async () => {
    const user = userEvent.setup();
    const addSubject = answering<AdminExamPage>({ status: "saved", value: chePage() });
    render(<AddSubjectForm opened={chePage()} action={addSubject} />);
    const form = screen.getByRole("form", { name: "Add subject" });

    await user.type(within(form).getByLabelText("CODE"), "KIN");
    await user.type(within(form).getByLabelText("NAME"), "Kinetics");
    await user.click(within(form).getByRole("button", { name: "Add subject" }));

    expect(addSubject).toHaveBeenCalledWith(ANY, {
      input: { exam: "CHE", code: "KIN", name: "Kinetics" },
      expected: ANY,
    });
    expect(await within(form).findByText("✓ SUBJECT ADDED")).toBeInTheDocument();
    expect(within(form).getByLabelText("CODE")).toHaveValue("");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("says why a code the Exam has is refused", async () => {
    const user = userEvent.setup();
    const addSubject = answering<AdminExamPage>({
      status: "refused",
      error: { kind: "invalid", fieldErrors: { code: ["PCHEM IS ALREADY A CHE SUBJECT"] } },
    });
    render(<AddSubjectForm opened={chePage()} action={addSubject} />);

    await user.type(screen.getByLabelText("CODE"), "pchem");
    await user.type(screen.getByLabelText("NAME"), "Physical Chemistry");
    await user.click(screen.getByRole("button", { name: "Add subject" }));

    expect(await screen.findByText("PCHEM IS ALREADY A CHE SUBJECT")).toBeInTheDocument();
    expect(screen.getByLabelText("CODE")).toHaveValue("pchem");
  });
});

describe("removing a Subject", () => {
  it("confirms in the page, never the browser's dialog, then removes it", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm");
    const removeSubject = answering<AdminExamPage>({ status: "saved", value: chePage() });
    render(
      <>
        <RemoveSubject opened={chePage()} subject="THERMO" action={removeSubject} />
        <Toaster />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Remove THERMO" }));
    const dialog = screen.getByRole("dialog", { name: "Remove THERMO from CHE?" });
    expect(removeSubject).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Remove subject" }));

    expect(removeSubject).toHaveBeenCalledWith(ANY, { input: { exam: "CHE", code: "THERMO" } });
    expect(await screen.findByText("✓ REMOVED · THERMO IS NO LONGER A CHE SUBJECT")).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.refresh).toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("removes nothing when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const removeSubject = answering<AdminExamPage>();
    render(<RemoveSubject opened={chePage()} subject="THERMO" action={removeSubject} />);

    await user.click(screen.getByRole("button", { name: "Remove THERMO" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(removeSubject).not.toHaveBeenCalled();
  });

  it("shows the reason instead of the button while a Product uses it, or it's the last one", () => {
    const { unmount } = render(
      <RemoveSubject
        opened={chePage({ subjectProducts: { PCHEM: 2, THERMO: 0 } })}
        subject="PCHEM"
        action={answering()}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(
      screen.getByText("2 Products use PCHEM. Remove it from those Products first."),
    ).toBeInTheDocument();
    unmount();

    const one = chePage();
    one.exam.subjects = [{ code: "PCHEM", name: "Physical Chemistry" }];
    render(<RemoveSubject opened={one} subject="PCHEM" action={answering()} />);
    expect(
      screen.getByText("CHE needs at least one Subject. Add another before deleting this one."),
    ).toBeInTheDocument();
  });

  it("shows the seam's reason in the dialog when a Product came to use it meanwhile", async () => {
    const user = userEvent.setup();
    const removeSubject = answering<AdminExamPage>({
      status: "refused",
      error: {
        kind: "invalid",
        fieldErrors: {},
        formError: "1 Product uses THERMO. Remove it from that Product first.",
      },
    });
    render(<RemoveSubject opened={chePage()} subject="THERMO" action={removeSubject} />);

    await user.click(screen.getByRole("button", { name: "Remove THERMO" }));
    await user.click(screen.getByRole("button", { name: "Remove subject" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "1 Product uses THERMO. Remove it from that Product first.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("Delete exam", () => {
  it("confirms in the page, deletes, and opens the first Exam", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm");
    const removeExam = answering<Exam>({ status: "saved", value: CHE });
    render(
      <>
        <DeleteExam opened={chePage()} action={removeExam} />
        <Toaster />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Delete exam" }));
    const dialog = screen.getByRole("dialog", { name: "Delete CHE?" });
    expect(dialog).toHaveAccessibleDescription(
      "Chemical Engineering, its 2 Subjects and its page settings are deleted. No Product belongs to it. This can’t be undone.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Delete exam" }));

    expect(removeExam).toHaveBeenCalledWith(ANY, { input: { code: "CHE" } });
    expect(await screen.findByText("✓ DELETED · CHE IS NO LONGER AN EXAM")).toBeVisible();
    expect(router.replace).toHaveBeenCalledWith("/admin/exam-pages", { scroll: false });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("shows the reason instead of the button while a Product belongs to the Exam", () => {
    render(
      <DeleteExam
        opened={chePage({
          products: [
            { id: "prd-x", shortName: "ChE cards", state: "live", showOnWebsite: false },
            { id: "prd-y", shortName: "ChE notes", state: "coming-soon", showOnWebsite: false },
          ],
        })}
        action={answering()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Delete exam" })).toBeNull();
    expect(
      screen.getByText("2 Products belong to CHE. Move or delete them first."),
    ).toBeInTheDocument();
  });

  it("says so in the dialog when the delete fails, keeping the Exam open", async () => {
    const user = userEvent.setup();
    const removeExam = answering<Exam>({ status: "failed" });
    render(<DeleteExam opened={chePage()} action={removeExam} />);

    await user.click(screen.getByRole("button", { name: "Delete exam" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete exam" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "COULDN’T DELETE IT · CHECK YOUR CONNECTION AND TRY AGAIN",
    );
    expect(router.replace).not.toHaveBeenCalled();
  });
});
