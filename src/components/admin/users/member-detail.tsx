import type { ReactNode } from "react";

import type { AdminAction } from "@/lib/admin/action";
import { formatChangedOn, formatLoggedAt } from "@/lib/admin/time";
import { memberInitials, passEnd, progressFigures } from "@/lib/admin/users-view";
import { formatDate } from "@/lib/manila-time";
import { cn } from "@/lib/utils";
import type {
  AdminAccessPass,
  AdminExamProgress,
  AdminMemberDetail,
  ForcedSignOut,
  UserRole,
} from "@/services/admin.types";
import type { TargetExam } from "@/services/member.types";

import { ForceSignOut } from "./force-sign-out";

interface MemberDetailProps {
  detail: AdminMemberDetail;
  /** The time of this request, for which passes have ended. */
  now: Date;
  forceSignOut: AdminAction<ForcedSignOut>;
}

const ROLES: Record<UserRole, string> = {
  member: "Member",
  editor: "Editor (Staff)",
  owner: "Owner (Staff)",
};

const label = "font-mono text-[11px] font-bold tracking-[0.06em]";
const card = "border-[1.5px] bg-ayc-paper";
const empty = "px-3.5 py-3 text-sm text-muted-foreground";

/** One section of the page: its mono heading, then its card. */
function DetailSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-2">
      <h2 id={id} className={label}>
        {title}
      </h2>
      <div className={card}>{children}</div>
    </section>
  );
}

/**
 * A Member's detail page (mockup 787–825; BUILD-MAP §3.10; story 130): the
 * profile with the Active Device and force sign-out, then their Target Exams,
 * Access Passes with their grants, progress per Target Exam (ticket 15's
 * calculator), device switches, consent and purchase history. Grant and
 * Extend come with ticket 17; purchases with Payments.
 */
export function MemberDetail({ detail, now, forceSignOut }: MemberDetailProps) {
  const { member, role, betaTester, activeDevice, deviceSwitches, consents } = detail;
  const shownName = member.name ?? member.email;
  return (
    <div className="grid items-start gap-4.5 wide:grid-cols-[300px_minmax(0,1fr)]">
      <section
        aria-labelledby="member-name"
        className={cn(card, "flex min-w-0 flex-col gap-2.5 p-4.5")}
      >
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-full bg-ayc-blue text-xl font-extrabold text-ayc-cream"
        >
          {memberInitials(member.name, member.email)}
        </span>
        <h2 id="member-name" className="text-xl font-extrabold wrap-anywhere">
          {shownName}
        </h2>
        <p className="font-mono text-xs wrap-anywhere text-muted-foreground">
          {member.email} · Google
        </p>
        <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[13px]">
          <dt className="font-mono text-xs text-muted-foreground">ROLE</dt>
          <dd className="font-bold">{ROLES[role]}</dd>
          <dt className="font-mono text-xs text-muted-foreground">BETA TESTER</dt>
          <dd>{betaTester ? "Yes" : "No"}</dd>
          <dt className="font-mono text-xs text-muted-foreground">JOINED</dt>
          <dd>{formatChangedOn(member.joinedAt)}</dd>
        </dl>
        <ForceSignOut
          member={{ userId: member.userId, name: member.name, email: member.email }}
          device={activeDevice}
          action={forceSignOut}
        />
      </section>

      <div className="flex min-w-0 flex-col gap-4">
        <DetailSection id="member-target-exams" title="TARGET EXAMS">
          {detail.targetExams.length > 0 ? (
            <ul>
              {detail.targetExams.map((exam) => (
                <TargetExamRow key={exam.examCode} exam={exam} />
              ))}
            </ul>
          ) : (
            <p className={empty}>No Target Exam yet.</p>
          )}
        </DetailSection>

        <DetailSection id="member-access-passes" title="ACCESS PASSES">
          {detail.accessPasses.length > 0 ? (
            <ul>
              {detail.accessPasses.map((pass) => (
                <PassRow key={pass.examCode} pass={pass} now={now} />
              ))}
            </ul>
          ) : (
            <p className={empty}>No Access Pass. They see Free Preview content only.</p>
          )}
        </DetailSection>

        <section aria-labelledby="member-progress" className="flex min-w-0 flex-col gap-2">
          <h2 id="member-progress" className={label}>
            PROGRESS
          </h2>
          {detail.progress.length > 0 ? (
            <Progress entries={detail.progress} />
          ) : (
            <p className={cn(card, empty)}>No progress yet: they have no Target Exam.</p>
          )}
        </section>

        <DetailSection
          id="member-device-switches"
          title={`DEVICE SWITCHES · ${deviceSwitches.length}`}
        >
          {deviceSwitches.length > 0 ? (
            <ol>
              {deviceSwitches.map((entry) => (
                <li
                  key={entry.switchedAt}
                  className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 border-b border-ayc-ruled px-3.5 py-2.5 last:border-b-0"
                >
                  <span className="text-sm font-semibold">{entry.deviceLabel}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {formatLoggedAt(entry.switchedAt)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={empty}>No device has been Active yet.</p>
          )}
          <p className="border-t border-dashed border-ayc-rule px-3.5 py-2 text-xs text-muted-foreground">
            Logged each time a device becomes their Active Device, the first one too. Many switches
            can mean a shared account.
          </p>
        </DetailSection>

        <DetailSection id="member-consent" title="CONSENT">
          {consents.length > 0 ? (
            <ul>
              {consents.map((consent) => (
                <li
                  key={consent.agreedAt}
                  className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 border-b border-ayc-ruled px-3.5 py-2.5 last:border-b-0"
                >
                  <span className="font-mono text-xs font-bold">
                    TERMS {consent.termsVersion} · PRIVACY {consent.privacyVersion}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    AGREED {formatLoggedAt(consent.agreedAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={empty}>Hasn’t agreed to the Terms and Privacy Policy yet.</p>
          )}
        </DetailSection>

        <DetailSection id="member-purchases" title="PURCHASE HISTORY">
          <p className={empty}>Purchases arrive with Payments (Phase 4).</p>
        </DetailSection>
      </div>
    </div>
  );
}

function TargetExamRow({ exam }: { exam: TargetExam }) {
  const setBy = exam.dateSetBy === "member" ? "SET BY THE MEMBER" : "OFFICIAL DATE";
  return (
    <li className="flex flex-col gap-0.5 border-b border-ayc-ruled px-3.5 py-2.5 last:border-b-0">
      <span className="text-sm font-bold">
        <span className="font-mono text-ayc-blue">{exam.examCode}</span> · {exam.name}
      </span>
      <span className="font-mono text-[11px] text-muted-foreground">
        {exam.examDate ? `EXAM DATE ${formatDate(exam.examDate)} · ${setBy}` : "NO EXAM DATE"}
      </span>
    </li>
  );
}

/** One Access Pass: its end in Manila, ACTIVE or ENDED, and each grant that made it. */
function PassRow({ pass, now }: { pass: AdminAccessPass; now: Date }) {
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
    </li>
  );
}

/** Each Target Exam's figures, then the account-wide last Study Day and streak. */
function Progress({ entries }: { entries: AdminExamProgress[] }) {
  const [first] = entries;
  const account = first ? progressFigures(first.progress) : null;
  return (
    <div className="flex flex-col gap-2.5">
      {entries.map(({ examCode, progress }) => {
        const figures = progressFigures(progress);
        return (
          <div key={examCode} className={cn(card, "flex flex-col gap-2 p-3.5")}>
            <h3 className="font-mono text-xs font-bold text-ayc-blue">{examCode}</h3>
            <dl className="grid grid-cols-1 gap-2.5 wide:grid-cols-3">
              <Figure term="CARDS GOT IT" value={figures.cards} />
              <Figure term="QUIZ AVERAGE" value={figures.quizAverage} note={figures.quizzes} />
              <Figure term="PAGES READ" value={figures.pages} />
            </dl>
          </div>
        );
      })}
      {account ? (
        <dl className={cn(card, "grid grid-cols-1 gap-2.5 p-3.5 wide:grid-cols-2")}>
          <Figure term="LAST ACTIVE" value={account.lastActive} />
          <Figure term="STUDY STREAK" value={account.streak} />
        </dl>
      ) : null}
    </div>
  );
}

function Figure({ term, value, note }: { term: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-[10px] font-medium text-muted-foreground">{term}</dt>
      <dd className="text-lg font-extrabold">{value}</dd>
      {note ? <dd className="font-mono text-[10px] text-muted-foreground">{note}</dd> : null}
    </div>
  );
}
