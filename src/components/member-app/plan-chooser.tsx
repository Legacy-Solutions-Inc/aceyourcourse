"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";

import type { PayFormState } from "@/app/app/(shell)/plans/actions";
import { methodLabel, PAYMENT_METHODS, type PaymentMethod } from "@/lib/payments/payment-methods";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";

import { type CourseRowView, type PlanRowView, plansHeading } from "./plans-view";

/** The Plans page's Pay (Phase 4, ticket 03): a Pending Order for the Plan picked, or why not. */
export type PayAction = (previous: PayFormState, formData: FormData) => Promise<PayFormState>;

interface PlanChooserProps {
  examCode: string;
  /** The Exam's Plan rows, shortest first. Empty only when a Course is on sale. */
  rows: readonly PlanRowView[];
  /** The Exam's One-time purchases (Phase 5, ticket 06). */
  courses: readonly CourseRowView[];
  /** The item picked first (pickedItem): a Plan's id, or "course:" and a Course's; null with nothing to buy. */
  initial: string | null;
  /** Pay, where this server has a payments client; null where buying isn't set up. */
  pay: PayAction | null;
}

const IDLE: PayFormState = { error: null };
const noPay: PayAction = async (previous) => previous;

const focusRing =
  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ayc-blue";

/**
 * The Plans page's choice (mockup L417–447): the Exam's Plans as radio rows,
 * the Best value one picked first, then its One-time purchases (ticket 06:
 * "PSAD Masterclass · Video course only · yours to keep · ₱1,499", or "Owned ·
 * Watch" with no radio for one the Member owns), then the order summary with
 * the Payment Method and "Pay {price} with PayMongo", which sends the Exam,
 * the item and the method (the price is the server's to read). Where buying
 * isn't set up the button reads "Buying opens soon", disabled, and nothing is
 * sent. Opened afresh for each Exam.
 */
export function PlanChooser({ examCode, rows, courses, initial, pay }: PlanChooserProps) {
  const [itemId, setItemId] = useState(initial);
  const [method, setMethod] = useState<PaymentMethod>("qrph");
  const [state, payAction, paying] = useActionState(pay ?? noPay, IDLE);
  const summaryId = useId();
  const coursesId = useId();
  const items: readonly (PlanRowView | CourseRowView)[] = [
    ...rows,
    ...courses.filter((course) => !course.owned),
  ];
  const picked = items.find((item) => item.id === itemId);

  return (
    <form action={payAction} className="flex flex-wrap items-start gap-5">
      <input type="hidden" name="examCode" value={examCode} />
      <div className="flex min-w-0 flex-[1.4_1_320px] flex-col gap-5">
        {rows.length > 0 ? (
          <fieldset role="radiogroup" className="flex min-w-0 flex-col gap-2.5">
            <legend className="mb-2.5 font-mono text-xs font-medium tracking-[0.06em] text-muted-foreground">
              {plansHeading(examCode)}
            </legend>
            {rows.map((row) => {
              const checked = row.id === picked?.id;
              return (
                <label key={row.id} className="cursor-pointer">
                  <input
                    type="radio"
                    name="plan"
                    value={row.id}
                    checked={checked}
                    onChange={() => setItemId(row.id)}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "flex items-center gap-3.5 border-[1.5px] bg-ayc-paper p-4",
                      checked && "border-2 border-ayc-blue shadow-hard shadow-ayc-blue",
                      focusRing,
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-5 flex-none items-center justify-center rounded-full border-2 border-ayc-blue"
                    >
                      <span className={cn("size-2.5 rounded-full", checked && "bg-ayc-blue")} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
                        {row.period}
                        {row.bestValue ? (
                          <span className="border-[1.5px] border-ayc-navy bg-ayc-orange px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.06em] text-ayc-navy">
                            BEST VALUE
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[13px]">
                        Until {row.until}
                        {row.coversExamOn ? ` · covers your exam on ${row.coversExamOn}` : null}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-0.5 text-right">
                      <span className="text-[22px] font-black tracking-[-0.02em]">{row.price}</span>
                      <span className="text-xs text-muted-foreground">{row.perMonth}</span>
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        ) : null}
        {courses.length > 0 ? (
          <fieldset
            role="radiogroup"
            aria-labelledby={coursesId}
            className="flex min-w-0 flex-col gap-2.5"
          >
            <legend
              id={coursesId}
              className="mb-2.5 font-mono text-xs font-medium tracking-[0.06em] text-muted-foreground"
            >
              {courses.length === 1 ? "ONE-TIME PURCHASE" : "ONE-TIME PURCHASES"}
            </legend>
            {courses.map((course) =>
              course.owned ? (
                <div
                  key={course.id}
                  id={`course-${course.courseId}`}
                  className="flex items-center gap-3.5 border-[1.5px] bg-ayc-paper p-4"
                >
                  <CourseText course={course} />
                  <Link
                    href={course.href}
                    className="flex min-h-10 items-center border-[1.5px] border-ayc-navy px-3.5 text-sm font-bold"
                  >
                    Owned · Watch
                  </Link>
                </div>
              ) : (
                <label key={course.id} id={`course-${course.courseId}`} className="cursor-pointer">
                  <input
                    type="radio"
                    name="plan"
                    value={course.id}
                    checked={course.id === picked?.id}
                    onChange={() => setItemId(course.id)}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "flex items-center gap-3.5 border-[1.5px] bg-ayc-paper p-4",
                      course.id === picked?.id &&
                        "border-2 border-ayc-blue shadow-hard shadow-ayc-blue",
                      focusRing,
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-5 flex-none items-center justify-center rounded-full border-2 border-ayc-blue"
                    >
                      <span
                        className={cn(
                          "size-2.5 rounded-full",
                          course.id === picked?.id && "bg-ayc-blue",
                        )}
                      />
                    </span>
                    <CourseText course={course} />
                    <span className="text-[22px] font-black tracking-[-0.02em]">
                      {course.price}
                    </span>
                  </span>
                </label>
              ),
            )}
          </fieldset>
        ) : null}
      </div>

      {picked ? (
        <section
          aria-labelledby={summaryId}
          className="flex min-w-0 flex-[1_1_280px] flex-col border-[1.5px] bg-ayc-paper shadow-hard-lg"
        >
          <h2
            id={summaryId}
            className="border-b-[1.5px] border-dashed px-4.5 py-3.5 font-mono text-xs font-bold tracking-[0.06em]"
          >
            ORDER SUMMARY
          </h2>
          <div className="flex flex-col gap-3 px-4.5 py-4">
            <p className="flex justify-between gap-2.5 text-base">
              <span>{picked.summary}</span>
              <span className="font-bold">{picked.price}</span>
            </p>
            <p className="font-mono text-xs text-muted-foreground">{picked.summaryUntil}</p>
            <fieldset role="radiogroup" className="mt-1 flex flex-col gap-2">
              <legend className="mb-2 font-mono text-xs font-medium tracking-[0.06em] text-muted-foreground">
                PAY WITH
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((value) => (
                  <label key={value} className="cursor-pointer">
                    <input
                      type="radio"
                      name="method"
                      value={value}
                      checked={value === method}
                      onChange={() => setMethod(value)}
                      className="peer sr-only"
                    />
                    <span
                      className={cn(
                        "flex min-h-12 items-center justify-center border-[1.5px] text-sm font-bold",
                        value === method && "border-2 border-ayc-blue bg-background",
                        focusRing,
                      )}
                    >
                      {methodLabel(value)}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {pay ? (
              <button
                type="submit"
                disabled={paying}
                className="mt-1 flex min-h-14 items-center justify-center border-[1.5px] border-ayc-navy bg-ayc-orange text-[17px] font-extrabold text-ayc-navy shadow-hard-sm disabled:cursor-wait"
              >
                Pay {picked.price} with PayMongo
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="mt-1 flex min-h-14 items-center justify-center border-[1.5px] bg-ayc-sand text-[17px] font-extrabold text-ayc-slate disabled:cursor-not-allowed"
              >
                Buying opens soon
              </button>
            )}
            {state.error ? (
              <p role="alert" className="text-sm font-bold text-destructive">
                {state.error}
              </p>
            ) : null}
            <p className="text-[13px] leading-[1.45]">
              You’ll finish payment on PayMongo’s secure page. We never see or store your card
              details.
            </p>
            <p className="text-[13px] leading-[1.45]">
              By paying you agree to the{" "}
              <Link
                href={paths.legal.terms}
                className="font-bold text-ayc-blue underline underline-offset-2"
              >
                Terms of Use
              </Link>
              , including{" "}
              <Link
                href={paths.legal.paymentsAndRefunds}
                className="font-bold text-ayc-blue underline underline-offset-2"
              >
                Payments and refunds
              </Link>
              .
            </p>
          </div>
        </section>
      ) : null}
    </form>
  );
}

/** A One-time purchase's name and what it is: "PSAD Masterclass", "Video course only · yours to keep". */
function CourseText({ course }: { course: CourseRowView }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-lg font-extrabold">{course.title}</span>
      <span className="text-[13px]">{course.line}</span>
    </span>
  );
}
