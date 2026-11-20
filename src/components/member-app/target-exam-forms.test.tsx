import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ExamDateState, ExamFormState } from "@/app/app/(shell)/actions";

import { ExamForm } from "./exam-form";
import {
  countdownWords,
  dateSetByLabel,
  examDateLabel,
  switcherExams,
  type YourExam,
} from "./target-exam-view";
import { YourExams } from "./your-exams";

// The Target Exam forms (Phase 3, ticket 03): the Exam picker in onboarding
// and the add form, and Account's "Your exams". Their checks are a
// convenience; the actions and the seam decide (target-exams.test.tsx).
const CE = { code: "CE", board: "CELE", name: "Civil Engineering", officialExamDate: "2026-11-21" };
const ME = { code: "ME", board: "MELE", name: "Mechanical Engineering", officialExamDate: null };
const EE = {
  code: "EE",
  board: "REE",
  name: "Electrical Engineering",
  officialExamDate: "2027-04-10",
};
const TODAY = "2026-11-17";

describe("ExamForm", () => {
  function renderForm(result: ExamFormState = { error: null }) {
    const action = vi.fn(async (_previous: ExamFormState, _formData: FormData) => result);
    const user = userEvent.setup();
    render(
      <ExamForm
        exams={[CE, ME, EE]}
        today={TODAY}
        submitLabel="Start my countdown"
        action={action}
      />,
    );
    return { action, user, date: screen.getByLabelText("Exam date") };
  }
  const pill = (name: RegExp) => screen.getByRole("radio", { name });
  const sent = (action: ReturnType<typeof renderForm>["action"]) => {
    const [, formData] = action.mock.calls[0] ?? [];
    return { examCode: formData?.get("examCode"), examDate: formData?.get("examDate") };
  };

  it("starts on the first Exam, with its Official Exam Date filled in", () => {
    const { date } = renderForm();
    expect(pill(/^CE/)).toBeChecked();
    expect(date).toHaveValue("2026-11-21");
    expect(date).toHaveAttribute("min", TODAY);
    expect(date).not.toBeRequired();
  });

  it("offers a passed Official Exam Date as it is", () => {
    const action = vi.fn(async (_previous: ExamFormState, _formData: FormData) => ({
      error: null,
    }));
    render(
      <ExamForm
        exams={[{ ...CE, officialExamDate: "2026-11-10" }]}
        today={TODAY}
        submitLabel="Add exam"
        action={action}
      />,
    );
    const date = screen.getByLabelText("Exam date");
    expect(date).toHaveValue("2026-11-10");
    // The earliest date offered reaches back to it, so the form can be sent as it is.
    expect(date).toHaveAttribute("min", "2026-11-10");
  });

  it("lets each pill be selected, one at a time, filling in that Exam's Official Exam Date", async () => {
    const { user, date } = renderForm();

    await user.click(pill(/^EE/));

    expect(pill(/^EE/)).toBeChecked();
    expect(pill(/^CE/)).not.toBeChecked();
    expect(date).toHaveValue("2027-04-10");
    expect(screen.getByText(/The official REE exam date is 10 Apr 2027/)).toBeInTheDocument();
  });

  it("asks for a date when the Exam has no Official Exam Date", async () => {
    const { user, date } = renderForm();

    await user.click(pill(/^ME/));

    expect(date).toHaveValue("");
    expect(date).toBeRequired();
    expect(
      screen.getByText("There’s no official MELE date yet. Enter your exam date."),
    ).toBeInTheDocument();
  });

  it("keeps a date the Member typed when they pick another Exam", async () => {
    const { user, date } = renderForm();

    await user.clear(date);
    await user.type(date, "2027-06-06");
    await user.click(pill(/^EE/));

    expect(date).toHaveValue("2027-06-06");
  });

  it("sends the Exam picked and the date", async () => {
    const { user, action, date } = renderForm();
    await user.click(pill(/^ME/));
    await user.type(date, "2027-02-08");
    await user.click(screen.getByRole("button", { name: "Start my countdown" }));

    expect(sent(action)).toEqual({ examCode: "ME", examDate: "2027-02-08" });
  });

  it("shows why the action refused, tied to the date field", async () => {
    const { user, date } = renderForm({ error: "Already one of your exams" });
    await user.click(screen.getByRole("button", { name: "Start my countdown" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Already one of your exams");
    expect(date).toHaveAccessibleDescription(/Already one of your exams/);
  });
});

describe("YourExams", () => {
  const row = (exam: Partial<YourExam> & Pick<YourExam, "code" | "name">): YourExam => ({
    board: `${exam.code}LE`,
    examDate: "2026-11-21",
    dateLabel: "21 Nov 2026",
    setByLabel: "Official exam date",
    countdown: "4 days to the exam",
    selected: false,
    ...exam,
  });
  const CE_ROW = row({ code: "CE", name: "Civil Engineering", selected: true });
  const ME_ROW = row({ code: "ME", name: "Mechanical Engineering", examDate: "2027-02-08" });

  function renderExams({
    exams = [CE_ROW, ME_ROW],
    dateResult = { error: null, saved: true } as ExamDateState,
    removeResult = { error: null } as ExamFormState,
  } = {}) {
    const changeDate = vi.fn(async (_previous: ExamDateState, _formData: FormData) => dateResult);
    const remove = vi.fn(async (_previous: ExamFormState, _formData: FormData) => removeResult);
    const user = userEvent.setup();
    render(
      <YourExams exams={exams} today={TODAY} changeDateAction={changeDate} removeAction={remove} />,
    );
    return { user, changeDate, remove };
  }
  const exam = (name: string) => screen.getByRole("article", { name });

  it("saves the date typed for that Target Exam, and says so", async () => {
    const { user, changeDate } = renderExams();
    const me = within(exam("Mechanical Engineering"));

    await user.clear(me.getByLabelText("ME exam date"));
    await user.type(me.getByLabelText("ME exam date"), "2027-03-03");
    await user.click(me.getByRole("button", { name: "Save date" }));

    const [, formData] = changeDate.mock.calls[0] ?? [];
    expect(formData?.get("examCode")).toBe("ME");
    expect(formData?.get("examDate")).toBe("2027-03-03");
    expect(await me.findByRole("status")).toHaveTextContent("Date saved.");
  });

  it("shows why a date was refused", async () => {
    const { user } = renderExams({
      dateResult: {
        error: "That date has passed. Enter today’s date or a later one.",
        saved: false,
      },
    });
    const ce = within(exam("Civil Engineering"));
    await user.click(ce.getByRole("button", { name: "Save date" }));

    expect(await ce.findByRole("alert")).toHaveTextContent("That date has passed.");
  });

  it("asks before removing, and removes nothing when the Member keeps it", async () => {
    const { user, remove } = renderExams();
    await user.click(screen.getByRole("button", { name: "Remove ME" }));

    const dialog = screen.getByRole("dialog", { name: "Remove ME from your exams?" });
    expect(dialog).toHaveAccessibleDescription(/Your progress and exam date are kept/);
    await user.click(within(dialog).getByRole("button", { name: "Keep it" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();
  });

  it("removes the Target Exam once confirmed", async () => {
    const { user, remove } = renderExams();
    await user.click(screen.getByRole("button", { name: "Remove ME" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove ME" }));

    expect(remove).toHaveBeenCalledTimes(1);
    const [, formData] = remove.mock.calls[0] ?? [];
    expect(formData?.get("examCode")).toBe("ME");
  });

  it("shows why the action refused to remove it, in the dialog", async () => {
    const { user } = renderExams({
      removeResult: { error: "You can’t remove your only exam. Add another one first." },
    });
    await user.click(screen.getByRole("button", { name: "Remove ME" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove ME" }));

    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent(
      "You can’t remove your only exam.",
    );
  });

  it("offers no Remove for the Member's only Target Exam, and says why", () => {
    renderExams({ exams: [CE_ROW] });
    expect(screen.getByRole("button", { name: "Remove CE" })).toBeDisabled();
    expect(screen.getByText(/This is your only exam, so it can’t be removed/)).toBeInTheDocument();
  });
});

describe("how a Target Exam is worded", () => {
  const NOW = new Date("2026-11-17T03:42:00.000Z");
  const target = {
    examCode: "CE",
    board: "CELE",
    name: "Civil Engineering",
    examDate: "2026-11-21" as string | null,
    dateSetBy: "official" as "official" | "member" | null,
    selected: true,
    addedAt: NOW.toISOString(),
  };

  it("words each Target Exam for the exam switcher", () => {
    expect(
      switcherExams([target, { ...target, examCode: "ME", examDate: null, selected: false }], NOW),
    ).toMatchObject([
      { code: "CE", meta: "Exam 21 Nov 2026", countdown: "4 days to the exam", selected: true },
      {
        code: "ME",
        meta: "No exam date yet",
        countdown: "No exam date yet. Set one in Account.",
        selected: false,
      },
    ]);
  });

  it("says whose date it is", () => {
    expect(dateSetByLabel({ dateSetBy: "member" })).toBe("Date set by you");
    expect(dateSetByLabel({ dateSetBy: "official" })).toBe("Official exam date");
    expect(dateSetByLabel({ dateSetBy: null })).toBeNull();
    expect(examDateLabel({ examDate: "2027-02-08" })).toBe("8 Feb 2027");
    expect(examDateLabel({ examDate: null })).toBe("No exam date yet");
  });

  it.each([
    [
      { kind: "days", days: 12 },
      { big: "12", small: "days to go" },
    ],
    [
      { kind: "days", days: 1 },
      { big: "1", small: "day to go" },
    ],
    [{ kind: "exam-day" }, { big: "Exam day", small: "It’s today. Kaya mo ’to." }],
    [{ kind: "passed" }, { big: "Exam passed", small: "Update your date in Account." }],
    [{ kind: "no-date" }, { big: "No exam date yet", small: "Set one in Account." }],
  ] as const)("words Home's countdown %j", (countdown, words) => {
    expect(countdownWords(countdown)).toEqual(words);
  });
});
