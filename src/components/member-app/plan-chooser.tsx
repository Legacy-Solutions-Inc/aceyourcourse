"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";
import { paths } from "@/paths";

import { defaultPlanId, type PlanRowView, plansHeading } from "./plans-view";

/** The Payment Methods a Member picks on the Plans page (spec, Phase 4 → Paying), QR Ph first. */
export const PAYMENT_METHODS = ["QR Ph", "GCash", "Maya", "Card"] as const;

interface PlanChooserProps {
  examCode: string;
  /** The Exam's Plan rows, shortest first. Never empty. */
  rows: readonly PlanRowView[];
}

const focusRing =
  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ayc-blue";

/**
 * The Plans page's choice (mockup L417–447): the Exam's Plans as radio rows,
 * the Best value one picked first, then the order summary with the Payment
 * Method. Buying arrives in ticket 03: until then the button reads "Buying
 * opens soon", disabled, and nothing is sent. Opened afresh for each Exam.
 */
export function PlanChooser({ examCode, rows }: PlanChooserProps) {
  const [planId, setPlanId] = useState(() => defaultPlanId(rows));
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>("QR Ph");
  const summaryId = useId();
  const picked = rows.find((row) => row.id === planId) ?? rows[0];

  return (
    <div className="flex flex-wrap items-start gap-5">
      <fieldset role="radiogroup" className="flex min-w-0 flex-[1.4_1_320px] flex-col gap-2.5">
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
                onChange={() => setPlanId(row.id)}
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
                {PAYMENT_METHODS.map((name) => (
                  <label key={name} className="cursor-pointer">
                    <input
                      type="radio"
                      name="method"
                      value={name}
                      checked={name === method}
                      onChange={() => setMethod(name)}
                      className="peer sr-only"
                    />
                    <span
                      className={cn(
                        "flex min-h-12 items-center justify-center border-[1.5px] text-sm font-bold",
                        name === method && "border-2 border-ayc-blue bg-background",
                        focusRing,
                      )}
                    >
                      {name}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              disabled
              className="mt-1 flex min-h-14 items-center justify-center border-[1.5px] bg-ayc-sand text-[17px] font-extrabold text-ayc-slate disabled:cursor-not-allowed"
            >
              Buying opens soon
            </button>
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
              , including Payments and refunds.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
