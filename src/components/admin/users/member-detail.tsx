import Link from "next/link";
import type { ReactNode } from "react";

import {
  OrderStatusTag,
  PartialRefundNote,
  TestOrderTag,
} from "@/components/admin/orders/order-status-tag";

import type { AdminAction } from "@/lib/admin/action";
import { formatChangedOn, formatLoggedAt } from "@/lib/admin/time";
import { memberInitials, progressFigures } from "@/lib/admin/users-view";
import { orderItem } from "@/lib/admin/order-view";
import { formatDate } from "@/lib/manila-time";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type {
  AdminExamProgress,
  AdminMemberDetail,
  AdminOrder,
  ForcedSignOut,
  UserRole,
} from "@/services/admin.types";
import type { TargetExam } from "@/services/member.types";

import { AccessPasses, type PassActions } from "./access-passes";
import { ForceSignOut } from "./force-sign-out";

interface MemberDetailProps {
  detail: AdminMemberDetail;
  /** The time of this request, for which passes have ended. */
  now: Date;
  /** Every Exam in the catalogue, which "Grant Access Pass" offers. */
  exams: { code: string; name: string }[];
  forceSignOut: AdminAction<ForcedSignOut>;
  passActions: PassActions;
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
 * Access Passes with their grants and Grant, Extend and End access now
 * (ticket 17), progress per Target Exam (ticket 15's calculator), device
 * switches, consent, and their Orders, each linking to its detail page
 * (Phase 4, ticket 07; story 151z).
 */
export function MemberDetail({ detail, now, exams, forceSignOut, passActions }: MemberDetailProps) {
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

        <AccessPasses
          member={{ userId: member.userId, name: member.name, email: member.email }}
          passes={detail.accessPasses}
          exams={exams}
          now={now}
          actions={passActions}
        />

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

        <DetailSection id="member-orders" title={`ORDERS · ${detail.orders.length}`}>
          {detail.orders.length > 0 ? (
            <ul>
              {detail.orders.map((order) => (
                <MemberOrderRow key={order.id} order={order} />
              ))}
            </ul>
          ) : (
            <p className={empty}>No Orders yet.</p>
          )}
        </DetailSection>
      </div>
    </div>
  );
}

/** One of the Member's Orders (mockup 819–823, PURCHASE HISTORY), linking to its detail page. */
function MemberOrderRow({ order }: { order: AdminOrder }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b border-ayc-ruled px-3.5 py-2.5 last:border-b-0">
      <span className="flex min-w-0 flex-col gap-0.5">
        <Link
          href={paths.admin.order(order.reference)}
          className="w-fit font-mono text-xs font-bold text-ayc-navy underline-offset-2 hover:underline"
        >
          {order.reference}
        </Link>
        <span className="text-sm font-semibold">{orderItem(order)}</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {formatDate(order.createdAt)}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className="text-sm font-extrabold">{formatPeso(order.priceCentavos)}</span>
        <span className="flex gap-1.5">
          {order.livemode ? null : <TestOrderTag />}
          <OrderStatusTag status={order.status} />
        </span>
        <PartialRefundNote order={order} />
      </span>
    </li>
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
            <dl className="grid grid-cols-1 gap-2.5 wide:grid-cols-4">
              <Figure term="CARDS GOT IT" value={figures.cards} />
              <Figure term="QUIZ AVERAGE" value={figures.quizAverage} note={figures.quizzes} />
              <Figure term="PAGES READ" value={figures.pages} />
              <Figure term="LESSONS DONE" value={figures.lessons} />
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
