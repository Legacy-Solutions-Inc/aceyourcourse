"use client";

import { type FormEvent, type ReactNode, useId, useRef, useState } from "react";

import {
  AdminDialog,
  AdminDialogButton,
  AdminDialogButtons,
  type AdminDialogTone,
} from "@/components/admin/admin-dialog";
import { AdminTextField } from "@/components/admin/admin-text-field";
import { useStaffAction } from "@/components/admin/settings/use-staff-action";
import type { AdminAction } from "@/lib/admin/action";
import { formatChangedOn } from "@/lib/admin/time";
import { refusalText, UNREACHABLE } from "@/lib/admin/users-refusal";
import { passChangeText, passEnd } from "@/lib/admin/users-view";
import { EXTEND_DAYS, GRANT_DAYS, GRANT_MAX_DAYS } from "@/lib/member-app/access-pass";
import { cn } from "@/lib/utils";
import type { AccessPassChange, AdminAccessPass } from "@/services/admin.types";

/** The Server Actions the panel calls: grant, extend and end a Member's Access Pass. */
export interface PassActions {
  grant: AdminAction<AccessPassChange>;
  extend: AdminAction<AccessPassChange>;
  end: AdminAction<AccessPassChange>;
}

interface AccessPassesProps {
  member: { userId: string; name: string | null; email: string };
  /** The Member's passes by Exam code, each with the grants that made it. */
  passes: AdminAccessPass[];
  /** Every Exam in the catalogue, in its order: any of them can be granted. */
  exams: { code: string; name: string }[];
  /** The time of this request, for which passes have ended. */
  now: Date;
  actions: PassActions;
}

type Action = "grant" | "extend" | "end";
type Open = { action: "grant" } | { action: "extend" | "end"; examCode: string } | null;
type Notice = { tone: "done" | "refused"; text: string };
type FieldErrors = Partial<Record<"examCode" | "days" | "reason", string>>;

const label = "font-mono text-[11px] font-bold tracking-[0.06em]";
const smallButton =
  "min-h-9 cursor-pointer border-[1.5px] bg-transparent px-3 text-[13px] font-bold hover:bg-ayc-sand disabled:cursor-wait";
const NO_PAYMENT =
  "No payment is collected. They get an in-app notice the next time they open the Member App.";

/**
 * ACCESS PASSES on a Member's detail page (ticket 17; stories 131 and 133j;
 * BUILD-MAP §3.10, our decisions over the mockup's): each pass with its end in
 * Manila and the grants that made it, "Extend…" on each and "End access
 * now…" on an active one, then "Grant Access Pass…". Each asks for a reason
 * that Staff Activity keeps. The server decides everything (Owners only, the
 * days allowed, the pass rule); this panel only shows what it answered, then
 * reads the page again. The Member gets an in-app notice, never an email.
 */
export function AccessPasses({ member, passes, exams, now, actions }: AccessPassesProps) {
  const { pending, run } = useStaffAction();
  const [open, setOpen] = useState<Open>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failed, setFailed] = useState(false);
  const [reason, setReason] = useState("");
  const [grantExam, setGrantExam] = useState(exams[0]?.code ?? "");
  const [grantDays, setGrantDays] = useState<number | "custom">(GRANT_DAYS[0]);
  const [customDays, setCustomDays] = useState("");
  const [extendDays, setExtendDays] = useState<number>(EXTEND_DAYS[1]);
  const heading = useRef<HTMLHeadingElement>(null);
  const answered = useRef(false);
  const firstName = member.name?.trim().split(/\s+/)[0] ?? member.email;

  function start(next: NonNullable<Open>) {
    setNotice(null);
    setErrors({});
    setFailed(false);
    setReason("");
    setOpen(next);
  }

  function send(action: Action, input: Record<string, unknown>) {
    if (pending) return;
    setErrors({});
    setFailed(false);
    run(actions[action], { userId: member.userId, ...input, reason }, (state) => {
      if (state.status === "failed") {
        setFailed(true);
        return;
      }
      if (state.status === "refused") {
        const { error } = state;
        if (error.kind === "invalid" && Object.keys(error.fieldErrors).length > 0) {
          const first = (field: keyof FieldErrors) => error.fieldErrors[field]?.[0];
          setErrors({ examCode: first("examCode"), days: first("days"), reason: first("reason") });
          return;
        }
        setNotice({ tone: "refused", text: refusalText(error) });
      } else if (state.status === "saved") {
        setNotice({ tone: "done", text: passChangeText(action, state.value) });
      }
      answered.current = true;
      setOpen(null);
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!open) return;
    if (open.action === "grant") {
      send("grant", {
        examCode: grantExam,
        days: grantDays === "custom" ? customDays : grantDays,
      });
    } else if (open.action === "extend") {
      send("extend", { examCode: open.examCode, days: extendDays });
    } else {
      send("end", { examCode: open.examCode });
    }
  }

  const dialog = open ? dialogCopy(open, firstName) : null;

  return (
    <section aria-labelledby="member-access-passes" className="flex min-w-0 flex-col gap-2">
      <h2 ref={heading} tabIndex={-1} id="member-access-passes" className={label}>
        ACCESS PASSES
      </h2>
      <div className="border-[1.5px] bg-ayc-paper">
        {passes.length > 0 ? (
          <ul>
            {passes.map((pass) => (
              <PassRow
                key={pass.examCode}
                pass={pass}
                now={now}
                pending={pending}
                onExtend={() => start({ action: "extend", examCode: pass.examCode })}
                onEnd={() => start({ action: "end", examCode: pass.examCode })}
              />
            ))}
          </ul>
        ) : (
          <p className="px-3.5 py-3 text-sm text-muted-foreground">
            No Access Pass. They see Free Preview content only.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t border-dashed border-ayc-rule px-3.5 py-2.5">
          <button
            type="button"
            disabled={pending || exams.length === 0}
            onClick={() => start({ action: "grant" })}
            className={smallButton}
          >
            Grant Access Pass…
          </button>
          <span className="text-xs text-muted-foreground">{NO_PAYMENT}</span>
        </div>
      </div>
      <p
        role="status"
        className={cn(
          "min-h-4",
          notice?.tone === "refused"
            ? "text-sm font-semibold text-destructive"
            : "font-mono text-[11px] font-medium text-ayc-success",
        )}
      >
        {notice?.text ?? ""}
      </p>

      <AdminDialog
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
        tag={dialog?.tag ?? ""}
        tone={dialog?.tone ?? "info"}
        title={dialog?.title ?? ""}
        description={dialog?.description}
        onCloseAutoFocus={(event) => {
          if (!answered.current) return;
          // Answered, the button may be gone with the pass's state, so focus goes to the heading.
          answered.current = false;
          event.preventDefault();
          heading.current?.focus();
        }}
      >
        <form noValidate onSubmit={submit} className="flex flex-col gap-3">
          {open?.action === "grant" ? (
            <>
              <ExamSelect
                exams={exams}
                value={grantExam}
                error={errors.examCode}
                onChange={setGrantExam}
              />
              <DaysChoice
                legend="DAYS"
                name="grant-days"
                options={[...GRANT_DAYS, "custom" as const]}
                value={grantDays}
                error={grantDays === "custom" ? undefined : errors.days}
                onChange={setGrantDays}
              />
              {grantDays === "custom" ? (
                <AdminTextField
                  label={`CUSTOM DAYS · 1 TO ${GRANT_MAX_DAYS}`}
                  name="custom-days"
                  inputMode="numeric"
                  autoComplete="off"
                  value={customDays}
                  error={errors.days}
                  onChange={(event) => setCustomDays(event.target.value)}
                />
              ) : null}
            </>
          ) : null}
          {open?.action === "extend" ? (
            <DaysChoice
              legend="DAYS TO ADD"
              name="extend-days"
              options={[...EXTEND_DAYS]}
              value={extendDays}
              error={errors.days}
              onChange={(days) => {
                if (days !== "custom") setExtendDays(days);
              }}
            />
          ) : null}
          <AdminTextField
            label="REASON · SAVED IN STAFF ACTIVITY"
            name="reason"
            autoComplete="off"
            placeholder={dialog?.placeholder}
            value={reason}
            error={errors.reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {failed ? (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {UNREACHABLE}
            </p>
          ) : null}
          <AdminDialogButtons>
            <AdminDialogButton onClick={() => setOpen(null)}>Cancel</AdminDialogButton>
            <AdminDialogButton
              type="submit"
              variant={open?.action === "end" ? "danger" : "primary"}
              disabled={pending}
            >
              {pending ? dialog?.pendingLabel : dialog?.submitLabel}
            </AdminDialogButton>
          </AdminDialogButtons>
        </form>
      </AdminDialog>
    </section>
  );
}

interface DialogCopy {
  tag: string;
  tone: AdminDialogTone;
  title: string;
  description: ReactNode;
  placeholder: string;
  submitLabel: string;
  pendingLabel: string;
}

/** Pure: what each dialog says. */
function dialogCopy(open: NonNullable<Open>, firstName: string): DialogCopy {
  switch (open.action) {
    case "grant":
      return {
        tag: "GRANT ACCESS PASS",
        tone: "info",
        title: `Grant ${firstName} an Access Pass`,
        description: `The days start from the pass’s end, or from now if it has ended. An Exam they don’t have joins their Target Exams. ${NO_PAYMENT}`,
        placeholder: "e.g. Beta tester",
        submitLabel: "Grant access",
        pendingLabel: "Granting…",
      };
    case "extend":
      return {
        tag: "EXTEND ACCESS",
        tone: "info",
        title: `Add days to ${firstName}’s ${open.examCode} pass`,
        description: `The days start from the pass’s end, or from now if it has ended. ${NO_PAYMENT}`,
        placeholder: "e.g. Payment confirmed late",
        submitLabel: "Add days",
        pendingLabel: "Adding…",
      };
    case "end":
      return {
        tag: "END ACCESS",
        tone: "danger",
        title: `End ${firstName}’s ${open.examCode} access now?`,
        description:
          "They see the expired state straight away and get an in-app notice. Their progress stays, and a later grant starts from now.",
        placeholder: "e.g. Granted by mistake",
        submitLabel: "End access now",
        pendingLabel: "Ending…",
      };
  }
}

/** One Access Pass: its end in Manila, ACTIVE or ENDED, each grant that made it, and its actions. */
function PassRow({
  pass,
  now,
  pending,
  onExtend,
  onEnd,
}: {
  pass: AdminAccessPass;
  now: Date;
  pending: boolean;
  onExtend: () => void;
  onEnd: () => void;
}) {
  const { date, expired } = passEnd(pass.endsAt, now);
  return (
    <li
      aria-label={`${pass.examCode} pass`}
      className="flex flex-col gap-1.5 border-b border-ayc-ruled px-3.5 py-3 last:border-b-0"
    >
      <span className="flex flex-wrap items-center justify-between gap-2.5 text-sm">
        <span className="font-mono font-bold text-ayc-blue">{pass.examCode}</span>
        <span>{expired ? `ENDED ${date}` : `UNTIL ${date}`}</span>
        <span
          className={cn(
            "border-[1.5px] px-1.5 py-1 font-mono text-[10px] leading-none font-bold",
            expired ? "border-destructive text-destructive" : "border-ayc-success text-ayc-success",
          )}
        >
          {expired ? "ENDED" : "ACTIVE"}
        </span>
      </span>
      {pass.grants.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {pass.grants.map((grant) => (
            <li key={grant.grantedAt + grant.endsAt} className="text-xs leading-normal">
              <span className="font-mono text-[11px] text-muted-foreground">
                +{grant.days} DAYS · {formatChangedOn(grant.grantedAt)} · BY{" "}
                {grant.grantedBy.name.toUpperCase()}
              </span>{" "}
              “{grant.reason}”
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-xs text-muted-foreground">No grants recorded</span>
      )}
      <span className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={onExtend} className={smallButton}>
          Extend…
        </button>
        {expired ? null : (
          <button
            type="button"
            disabled={pending}
            onClick={onEnd}
            className={cn(smallButton, "border-destructive text-destructive")}
          >
            End access now…
          </button>
        )}
      </span>
    </li>
  );
}

/** The Exam to grant: every Exam in the catalogue, by code and name. */
function ExamSelect({
  exams,
  value,
  error,
  onChange,
}: {
  exams: { code: string; name: string }[];
  value: string;
  error?: string;
  onChange: (code: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="font-mono text-xs font-medium text-muted-foreground">
        EXAM
      </label>
      <select
        id={id}
        name="examCode"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-w-0 border-[1.5px] bg-white px-2.5 py-2.25 font-mono text-[13px] text-foreground aria-invalid:border-destructive"
      >
        {exams.map((exam) => (
          <option key={exam.code} value={exam.code}>
            {exam.code} · {exam.name}
          </option>
        ))}
      </select>
      {error ? (
        <p id={`${id}-error`} className="font-mono text-[11px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The days to give, as radio buttons, with "Custom" when a custom number is allowed. */
function DaysChoice({
  legend,
  name,
  options,
  value,
  error,
  onChange,
}: {
  legend: string;
  name: string;
  options: (number | "custom")[];
  value: number | "custom";
  error?: string;
  onChange: (value: number | "custom") => void;
}) {
  const id = useId();
  return (
    <fieldset aria-describedby={error ? `${id}-error` : undefined} className="flex flex-col gap-2">
      <legend className="mb-2 font-mono text-xs font-medium text-muted-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option}
            className={cn(
              "flex min-h-10.5 cursor-pointer items-center gap-2 border-[1.5px] bg-ayc-paper px-3 text-sm font-bold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
              value === option && "border-2 border-ayc-blue",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="size-4 flex-none accent-ayc-blue focus-visible:outline-none"
            />
            {option === "custom" ? "Custom" : `${option} days`}
          </label>
        ))}
      </div>
      {error ? (
        <p id={`${id}-error`} className="font-mono text-[11px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
