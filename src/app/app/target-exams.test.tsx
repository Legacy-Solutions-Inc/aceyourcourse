import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_COOKIE } from "@/lib/member-app/device-token";
import { getExamPageForAdmin, updateOfficialExamDate } from "@/services/admin.mock";
import { getOrCreateMember, listTargetExams, recordConsent } from "@/services/member.mock";
import { sampleUserId } from "@/services/mock/members";

import { sampleActor } from "../../../test/admin-inputs";
import { editSampleCatalogue } from "../../../test/catalogue-seed";
import {
  AGREED_TO_CURRENT,
  CE_OFFICIAL,
  onThisDevice,
  TEST_DEVICE_TOKEN,
  withExamDates,
} from "../../../test/member-inputs";
import { redirectsTo } from "../../../test/redirects";

// Onboarding and Target Exams in the Member App (Phase 3, ticket 03; spec →
// Target Exams; stories 84–88, 133g), on sample data: the pages as a browser
// would load them and the Server Actions as it would send them. The gate,
// consent and the Active Device for each of them are in member-app.test.tsx,
// device.test.tsx and actions.gate.test.ts.
//
// The data: CE has an Official Exam Date (21 Nov 2026), no other Exam has
// one, and CHE isn't on the Website. It's 17 Nov 2026, 11:42 in Manila.
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
  usePathname: () => "/app",
}));

const BOOT = new Date("2026-11-17T03:42:00.000Z");
const EDITOR = sampleActor("editor");
const BEA = "tester@example.com";
const ANGEL = sampleActor("owner").email;
const BEA_ID = sampleUserId(BEA);

/** Signed in, on the browser that is the Members' Active Device (see agreedAs). */
const signedInAs = (email: string) => {
  jar.set("ayc_admin_sample", email);
  jar.set(DEVICE_COOKIE, TEST_DEVICE_TOKEN);
};

/**
 * A sample User who is a Member and has agreed, with no Target Exam yet,
 * using the Member App on the test browser (their Active Device).
 */
async function agreedAs(email: string, name: string) {
  const userId = sampleUserId(email);
  await getOrCreateMember({ userId, email, name });
  await recordConsent(userId, AGREED_TO_CURRENT);
  await onThisDevice(userId);
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const actions = () => import("./(shell)/actions");
const home = async (query: { restored?: string } = {}) =>
  (await import("./(shell)/(home)/page")).default({ searchParams: Promise.resolve(query) });
const account = async () => (await import("./(shell)/account/page")).default();
const addExamPage = async () => (await import("./(shell)/add-exam/page")).default();
const library = async () =>
  (await import("./(shell)/library/page")).default({ searchParams: Promise.resolve({}) });
const shell = async () =>
  (await import("./(shell)/layout")).default({ children: <p>the screen</p> });

const addExam = async (fields: Record<string, string>) =>
  (await actions()).addExam({ error: null }, form(fields));
const changeExamDate = async (fields: Record<string, string>) =>
  (await actions()).changeExamDate({ error: null, saved: false }, form(fields));
const removeExam = async (examCode: string) =>
  (await actions()).removeExam({ error: null }, form({ examCode }));
const switchExam = async (examCode: string) => (await actions()).switchExam(form({ examCode }));

/** Adds a Target Exam through the action, which goes on to Home. */
async function added(fields: Record<string, string>, to = "/app") {
  await expect(addExam(fields)).rejects.toThrow(redirectsTo(to));
}

/** A Staff User changes an Exam's Official Exam Date in the Admin. */
async function staffSetOfficialDate(code: string, officialExamDate: string) {
  const opened = await getExamPageForAdmin(EDITOR, code);
  if (!opened) throw new Error(`No Exam page for ${code}`);
  const result = await updateOfficialExamDate(
    EDITOR,
    code,
    { officialExamDate },
    opened.stamps.officialExamDate,
  );
  expect(result).toMatchObject({ ok: true });
}

const targetExams = (email = BEA) => listTargetExams(sampleUserId(email));
const countdown = () => screen.getByRole("region", { name: /board exam countdown/ });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(BOOT);
  jar.clear();
  editSampleCatalogue(withExamDates);
  await agreedAs(BEA, "Bea Tester");
  signedInAs(BEA);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("onboarding", () => {
  it("shows a Member with no Target Exam the onboarding form on Home", async () => {
    render(await home());

    expect(
      screen.getByRole("heading", { level: 1, name: "Hi, Bea. Let’s set you up." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "When is your board exam?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start my countdown" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /countdown/ })).not.toBeInTheDocument();
  });

  it("offers every Exam on the Website as a selectable pill, and no other", async () => {
    render(await home());

    const pills = within(screen.getByRole("group", { name: "Your exam" })).getAllByRole("radio");
    expect(pills.map((pill) => (pill as HTMLInputElement).value)).toEqual([
      "CE",
      "ME",
      "EE",
      "MT",
      "CPA",
    ]);
    expect(screen.getByRole("radio", { name: "CE · Civil Engineering" })).toBeChecked();
  });

  it("prefills the Exam Date with the Exam's Official Exam Date", async () => {
    render(await home());
    expect(screen.getByLabelText("Exam date")).toHaveValue(CE_OFFICIAL);
    expect(screen.getByText(/The official CELE exam date is 21 Nov 2026/)).toBeInTheDocument();
  });

  it.each([
    ["/app/library", library],
    ["/app/account", account],
    ["/app/add-exam", addExamPage],
  ])("sends them from %s to Home until they have a Target Exam", async (_path, page) => {
    await expect(page()).rejects.toThrow(redirectsTo("/app"));
  });

  it("shows no exam switcher while they have no Target Exam", async () => {
    render(await shell());
    expect(screen.getByRole("navigation", { name: "Member App" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /STUDYING FOR/ })).not.toBeInTheDocument();
  });

  it("“Start my countdown” makes the Exam their first Target Exam, following the official date they kept, and goes to Home", async () => {
    await added({ examCode: "CE", examDate: CE_OFFICIAL });

    expect(await targetExams()).toMatchObject([
      { examCode: "CE", examDate: CE_OFFICIAL, dateSetBy: "official", selected: true },
    ]);

    render(await home());
    expect(screen.getByRole("heading", { level: 1, name: "Welcome, Bea" })).toBeInTheDocument();
    expect(screen.getByText("01 · HOME · CE · CELE")).toBeInTheDocument();
    expect(countdown()).toHaveTextContent("CELE BOARD EXAM");
    expect(countdown()).toHaveTextContent("4days to go");
    expect(countdown()).toHaveTextContent("21 Nov 2026 · Official exam date");
    expect(within(countdown()).getByRole("link", { name: "Change date" })).toHaveAttribute(
      "href",
      "/app/account",
    );
  });

  it("keeps the date the Member changed it to as their own", async () => {
    await added({ examCode: "CE", examDate: "2027-04-18" });

    render(await home());
    expect(countdown()).toHaveTextContent("152days to go");
    expect(countdown()).toHaveTextContent("18 Apr 2027 · Date set by you");
  });

  it("is the same for active Staff: the Owner onboards like any Member", async () => {
    await agreedAs(ANGEL, "Angel Owner");
    signedInAs(ANGEL);
    await added({ examCode: "ME", examDate: "2027-02-08" });

    expect(await targetExams(ANGEL)).toMatchObject([{ examCode: "ME", selected: true }]);
    expect(await targetExams(BEA)).toEqual([]);
  });

  it.each([
    ["an Exam with no Official Exam Date and no date", { examCode: "ME" }, "Enter your exam date."],
    [
      "a date in the past",
      { examCode: "CE", examDate: "2026-11-16" },
      "That date has passed. Enter today’s date or a later one.",
    ],
    ["a date that isn't one", { examCode: "CE", examDate: "2027-02-30" }, "Enter a real date."],
    [
      "an Exam that isn't on the Website",
      { examCode: "CHE", examDate: "2027-04-18" },
      "Pick one of the exams listed.",
    ],
    ["no Exam at all", { examDate: "2027-04-18" }, "Pick one of the exams listed."],
  ])("refuses %s with a message, and adds nothing", async (_label, fields, error) => {
    expect(await addExam(fields)).toEqual({ error });
    expect(await targetExams()).toEqual([]);
  });
});

describe("the countdown across Asia/Manila midnight", () => {
  beforeEach(async () => {
    await added({ examCode: "CE", examDate: CE_OFFICIAL });
  });

  it.each([
    ["one minute before midnight on 20 Nov", "2026-11-20T15:59:00.000Z", "1day to go"],
    ["at midnight on 21 Nov", "2026-11-20T16:00:00.000Z", "Exam dayIt’s today. Kaya mo ’to."],
    [
      "at midnight on 22 Nov",
      "2026-11-21T16:00:00.000Z",
      "Exam passedUpdate your date in Account.",
    ],
  ])("%s, Home reads %s", async (_when, now, words) => {
    vi.setSystemTime(new Date(now));
    render(await home());
    expect(countdown()).toHaveTextContent(words);
  });

  it("says the same in the exam switcher", async () => {
    vi.setSystemTime(new Date("2026-11-21T16:00:00.000Z"));
    render(await shell());
    expect(screen.getByRole("button", { name: /STUDYING FOR/ })).toHaveTextContent(
      "Exam passed. Update your date in Account.",
    );
  });
});

describe("the Official Exam Date", () => {
  it("moves a Member who kept it when Staff change it", async () => {
    await added({ examCode: "CE", examDate: CE_OFFICIAL });
    await staffSetOfficialDate("CE", "2026-11-28");

    render(await home());
    expect(countdown()).toHaveTextContent("11days to go");
    expect(countdown()).toHaveTextContent("28 Nov 2026 · Official exam date");
  });

  it("leaves a Member who edited their date where they put it", async () => {
    await added({ examCode: "CE", examDate: CE_OFFICIAL });
    expect(await changeExamDate({ examCode: "CE", examDate: "2026-12-05" })).toEqual({
      error: null,
      saved: true,
    });
    await staffSetOfficialDate("CE", "2026-11-28");

    render(await home());
    expect(countdown()).toHaveTextContent("18days to go");
    expect(countdown()).toHaveTextContent("5 Dec 2026 · Date set by you");
  });
});

describe("more Target Exams", () => {
  beforeEach(async () => {
    await added({ examCode: "CE", examDate: CE_OFFICIAL });
  });

  it("the add form offers the Exams on the Website that aren't the Member's already", async () => {
    render(await addExamPage());

    expect(screen.getByRole("heading", { level: 1, name: "Add an exam" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((pill) => (pill as HTMLInputElement).value)).toEqual([
      "ME",
      "EE",
      "MT",
      "CPA",
    ]);
    expect(screen.getByLabelText("Exam date")).toBeRequired();
    expect(screen.getByRole("button", { name: "Add exam" })).toBeInTheDocument();
  });

  it("adds a second Target Exam, selects it, and the shell and Home follow it", async () => {
    await added({ examCode: "ME", examDate: "2027-02-08" });

    render(await shell());
    const card = screen.getAllByRole("button", { name: /STUDYING FOR/ })[0];
    expect(card).toHaveTextContent("ME · MELE");
    expect(card).toHaveTextContent("83 days to the exam");

    render(await home());
    expect(screen.getByText("01 · HOME · ME · MELE")).toBeInTheDocument();
    expect(countdown()).toHaveTextContent("MELE BOARD EXAM");
    expect(screen.queryByText(/CELE/)).not.toBeInTheDocument();
  });

  it("switches back, and the shell and Home follow", async () => {
    await added({ examCode: "ME", examDate: "2027-02-08" });
    await switchExam("CE");

    expect((await targetExams()).find((exam) => exam.selected)?.examCode).toBe("CE");
    render(await home());
    expect(screen.getByText("01 · HOME · CE · CELE")).toBeInTheDocument();
    expect(countdown()).toHaveTextContent("CELE BOARD EXAM");
  });

  it("ignores a switch to an Exam that isn't one of the Member's", async () => {
    await switchExam("EE");
    await switchExam("CHE");
    expect(await targetExams()).toMatchObject([{ examCode: "CE", selected: true }]);
  });

  it("refuses an Exam that's already one of the Member's Target Exams", async () => {
    expect(await addExam({ examCode: "CE", examDate: "2027-04-18" })).toEqual({
      error: "Already one of your exams",
    });
    expect(await targetExams()).toMatchObject([{ examCode: "CE", examDate: CE_OFFICIAL }]);
  });

  it("says so when every Exam is the Member's already", async () => {
    for (const examCode of ["ME", "EE", "MT", "CPA"]) {
      await added({ examCode, examDate: "2027-02-08" });
    }
    render(await addExamPage());
    expect(screen.getByText(/You’ve added every exam we have/)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});

describe("Account: Your exams", () => {
  beforeEach(async () => {
    await added({ examCode: "CE", examDate: CE_OFFICIAL });
    await added({ examCode: "ME", examDate: "2027-02-08" });
  });

  it("lists each Target Exam with its Exam Date to edit, Remove, and “+ Add an exam”", async () => {
    render(await account());

    expect(screen.getByRole("heading", { level: 1, name: "Account" })).toBeInTheDocument();
    const section = screen.getByRole("region", { name: "Your exams" });
    const [ce, me] = within(section).getAllByRole("article");
    expect(ce).toHaveAccessibleName("Civil Engineering");
    expect(ce).toHaveTextContent("21 Nov 2026 · Official exam date · 4 days to the exam");
    expect(within(ce as HTMLElement).getByLabelText("CE exam date")).toHaveValue(CE_OFFICIAL);
    expect(me).toHaveTextContent("8 Feb 2027 · Date set by you · 83 days to the exam");
    expect(me).toHaveTextContent("STUDYING NOW");
    expect(within(me as HTMLElement).getByRole("button", { name: "Remove ME" })).toBeEnabled();
    expect(within(section).getByRole("link", { name: "+ Add an exam" })).toHaveAttribute(
      "href",
      "/app/add-exam",
    );
  });

  it("saves an edited Exam Date as the Member's own", async () => {
    expect(await changeExamDate({ examCode: "CE", examDate: "2027-04-18" })).toEqual({
      error: null,
      saved: true,
    });
    expect((await targetExams())[0]).toMatchObject({ examDate: "2027-04-18", dateSetBy: "member" });
  });

  it.each([
    [
      "a date in the past",
      "2026-11-16",
      "That date has passed. Enter today’s date or a later one.",
    ],
    ["a date that isn't one", "tomorrow", "Enter a real date."],
    ["no date", "", "Enter your exam date."],
  ])("refuses %s, and keeps the date", async (_label, examDate, error) => {
    expect(await changeExamDate({ examCode: "CE", examDate })).toEqual({ error, saved: false });
    expect((await targetExams())[0]).toMatchObject({
      examDate: CE_OFFICIAL,
      dateSetBy: "official",
    });
  });

  it("removes a Target Exam: it leaves the switcher and Home, and the selection falls back", async () => {
    expect(await removeExam("ME")).toEqual({ error: null });

    expect(await targetExams()).toMatchObject([{ examCode: "CE", selected: true }]);
    render(await shell());
    expect(screen.getAllByRole("button", { name: /STUDYING FOR/ })[0]).toHaveTextContent(
      "CE · CELE",
    );
    expect(screen.queryByText(/Mechanical Engineering/)).not.toBeInTheDocument();
  });

  it("refuses to remove the Member's last Target Exam, and offers no Remove for it", async () => {
    await removeExam("ME");

    expect(await removeExam("CE")).toEqual({
      error: "You can’t remove your only exam. Add another one first.",
    });
    expect(await targetExams()).toMatchObject([{ examCode: "CE" }]);

    render(await account());
    expect(screen.getByRole("button", { name: "Remove CE" })).toBeDisabled();
    expect(screen.getByText(/This is your only exam, so it can’t be removed/)).toBeInTheDocument();
  });

  it("restores a removed Target Exam when it's added again, with the date it had, and Home says so", async () => {
    await removeExam("ME");

    await added({ examCode: "ME", examDate: "2027-12-12" }, "/app?restored=ME");

    expect(await targetExams()).toMatchObject([
      { examCode: "CE" },
      { examCode: "ME", examDate: "2027-02-08", dateSetBy: "member", selected: true },
    ]);
    render(await home({ restored: "ME" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "ME is back in your exams, with the exam date it had.",
    );
  });

  it("says nothing about a restore that didn't happen", async () => {
    render(await home({ restored: "CE" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("one Member and another", () => {
  beforeEach(async () => {
    await added({ examCode: "CE", examDate: "2027-04-18" });
    await added({ examCode: "ME", examDate: "2027-02-08" });
    await agreedAs(ANGEL, "Angel Owner");
    signedInAs(ANGEL);
  });

  it("never shows one Member another's Target Exams", async () => {
    render(await home());
    expect(
      screen.getByRole("heading", { level: 1, name: "Hi, Angel. Let’s set you up." }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /countdown/ })).not.toBeInTheDocument();
  });

  it("never lets one Member change, switch or remove another's, whatever the form sends", async () => {
    const before = await targetExams(BEA);

    expect(
      await changeExamDate({ examCode: "CE", examDate: "2027-06-06", userId: BEA_ID }),
    ).toEqual({ error: "That exam isn’t one of yours.", saved: false });
    expect(await removeExam("CE")).toEqual({ error: "That exam isn’t one of yours." });
    await switchExam("CE");

    expect(await targetExams(BEA)).toEqual(before);
    expect(await targetExams(ANGEL)).toEqual([]);
  });
});
