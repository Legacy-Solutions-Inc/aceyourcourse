"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { callAdminAction } from "@/components/admin/call-admin-action";
import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { OneTimePurchase } from "@/services/admin.types";

import { PlanOnSaleSwitch } from "./plan-on-sale-switch";

export interface OneTimePurchaseActions {
  setPrice: AdminAction<OneTimePurchase>;
  setOnSale: AdminAction<OneTimePurchase>;
}

interface OneTimePurchasesProps {
  purchases: readonly OneTimePurchase[];
  /** The Exam chip picked, or null for ALL. */
  examChip: string | null;
  actions: OneTimePurchaseActions;
}

const head = "font-mono text-[10px] font-bold tracking-[0.06em] text-ayc-slate";

/**
 * Plans & prices → "ONE-TIME PURCHASES · NO EXPIRY" (Phase 5, ticket 06;
 * BUILD-MAP §3.8): every separately sold Course (for the Exam chip picked),
 * each with its price in whole pesos and its On sale switch, Owners only. A
 * Course switched to Sold separately in Course settings arrives here with no
 * price, not on sale. Lessons and videos are managed in Courses & videos.
 * The server checks every rule; this shows what it answered.
 */
export function OneTimePurchases({ purchases, examChip, actions }: OneTimePurchasesProps) {
  const shown = examChip
    ? purchases.filter((purchase) => purchase.examCode === examChip)
    : purchases;
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-2.5">
      <div className="border-[1.5px] bg-ayc-paper">
        <h2 id={headingId} className={cn(head, "border-b-[1.5px] px-3.5 py-2.5")}>
          ONE-TIME PURCHASES · NO EXPIRY · {shown.length}
        </h2>
        {shown.length === 0 ? (
          <p className="px-3.5 py-5 text-center text-sm text-muted-foreground">
            No course is sold separately{examChip ? ` for ${examChip}` : ""}. Switch one to Sold
            separately in its Course settings.
          </p>
        ) : (
          <ul className="flex flex-col">
            {shown.map((purchase) => (
              <PurchaseRow key={purchase.id} purchase={purchase} actions={actions} />
            ))}
          </ul>
        )}
      </div>
      <p className="font-mono text-[11px] text-muted-foreground">
        LESSONS AND VIDEOS ARE MANAGED IN{" "}
        <Link href={paths.admin.courses} className="font-bold text-ayc-blue underline">
          COURSES &amp; VIDEOS
        </Link>
        . PRICE CHANGES APPLY TO NEW PURCHASES ONLY.
      </p>
    </section>
  );
}

/** Pure: what a refused price says. */
function priceRefusal(state: AdminActionState<unknown>): string {
  if (state.status === "failed") return "NOT SAVED · CHECK YOUR CONNECTION AND TRY AGAIN";
  if (state.status !== "refused") return "";
  const { error } = state;
  if (error.kind === "invalid") {
    return error.fieldErrors?.price?.[0] ?? error.formError ?? "CHECK THE PRICE";
  }
  if (error.kind === "forbidden") return error.message;
  if (error.kind === "not-found") return "THAT COURSE IS GONE · RELOAD THE PAGE";
  return "NOT SAVED · RELOAD THE PAGE AND TRY AGAIN";
}

/** One separately sold Course: its price form and On sale switch. */
function PurchaseRow({
  purchase,
  actions,
}: {
  purchase: OneTimePurchase;
  actions: OneTimePurchaseActions;
}) {
  const router = useRouter();
  const [price, setPrice] = useState(
    purchase.priceCentavos === null ? "" : String(purchase.priceCentavos / 100),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const errorId = useId();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const state = await callAdminAction(actions.setPrice, {
        input: { id: purchase.id, price },
      });
      if (state.status !== "saved") {
        setError(priceRefusal(state));
        return;
      }
      // The price as saved, in whole pesos: "1,299" reads back as "1299".
      const saved = state.value.priceCentavos;
      if (saved !== null) setPrice(String(saved / 100));
      toast(`✓ ${purchase.title.toUpperCase()} · ${formatPeso(saved ?? 0)}`);
      router.refresh();
    });
  }

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 border-b border-ayc-ruled px-3.5 py-2.5 last:border-b-0",
        !purchase.onSale && "bg-ayc-sand/70",
      )}
    >
      <div className="flex min-w-40 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold">{purchase.title}</span>
          {purchase.onSale ? null : (
            <span className="border border-ayc-slate px-1.25 py-0.5 font-mono text-[9px] leading-none font-bold text-ayc-slate">
              NOT ON SALE
            </span>
          )}
          {purchase.visible ? null : (
            <span className="border border-ayc-slate px-1.25 py-0.5 font-mono text-[9px] leading-none font-bold text-ayc-slate">
              HIDDEN
            </span>
          )}
        </span>
        <span className="font-mono text-[10px] text-ayc-slate">
          VIDEO COURSE · {purchase.examCode} · {purchase.subjectCode}
        </span>
      </div>
      <form noValidate onSubmit={save} className="flex flex-wrap items-center gap-1.5">
        <span aria-hidden="true" className={head}>
          PRICE ₱
        </span>
        <input
          name="price"
          inputMode="numeric"
          value={price}
          placeholder="No price yet"
          aria-label={`Price: ${purchase.title}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => setPrice(event.target.value)}
          className="min-h-10 w-28 border-[1.5px] bg-white px-2 text-sm font-bold aria-invalid:border-destructive"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-10 cursor-pointer border-[1.5px] px-3 text-sm font-bold disabled:cursor-wait"
        >
          {pending ? "Saving…" : "Save price"}
        </button>
      </form>
      <div className="flex items-center gap-1.5">
        <span className={head}>ON</span>
        <PlanOnSaleSwitch
          id={purchase.id}
          checked={purchase.onSale}
          title={purchase.title}
          action={actions.setOnSale}
        />
      </div>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="basis-full font-mono text-[11px] font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}
    </li>
  );
}
