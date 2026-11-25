"use client";

import { useState } from "react";

import { useStaffAction } from "@/components/admin/settings/use-staff-action";
import type { AdminAction } from "@/lib/admin/action";
import { checkMessage } from "@/lib/admin/order-view";
import { cn } from "@/lib/utils";
import type { OrderStatusCheck } from "@/services/admin.types";

interface CheckStatusButtonProps {
  reference: string;
  /** Whether the Order is recorded Pending, so there's something to ask PayMongo. */
  checkable: boolean;
  action: AdminAction<OrderStatusCheck>;
}

type Notice = { tone: "pending" | "done" | "failed"; text: string };

/** Pure: a check's line colour: still waiting, an outcome applied, or nothing changed. */
function toneOf({ outcome }: OrderStatusCheck): Notice["tone"] {
  if (outcome === "paid") return "done";
  if (outcome === "failed") return "failed";
  return "pending";
}

/**
 * "Check status with PayMongo" (mockup 778; story 148): the server asks
 * PayMongo, as Confirming payment's backup does, and applies a new outcome
 * through the Order ledger. The line says what PayMongo said, then the page
 * reads the Order again, so the status and timeline show it. It stays on the
 * page when that Order is no longer Pending, so the line still says what the
 * check did; only the button goes.
 */
export function CheckStatusButton({ reference, checkable, action }: CheckStatusButtonProps) {
  const { pending, run } = useStaffAction();
  const [notice, setNotice] = useState<Notice | null>(null);

  function check() {
    setNotice(null);
    run(action, { reference }, (state) => {
      if (state.status === "saved") {
        setNotice({ tone: toneOf(state.value), text: checkMessage(state.value) });
      } else if (state.status === "refused") {
        const { error } = state;
        setNotice({
          tone: "failed",
          text:
            error.kind === "invalid"
              ? (error.formError ?? "NOTHING WAS CHECKED")
              : error.kind === "forbidden"
                ? error.message
                : "THIS ORDER ISN’T THERE ANY MORE · RELOAD THE PAGE",
        });
      } else {
        setNotice({ tone: "failed", text: "COULDN’T REACH THE SERVER · NOTHING CHANGED" });
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {checkable ? (
        <button
          type="button"
          onClick={check}
          disabled={pending}
          className="min-h-10.5 cursor-pointer border-[1.5px] bg-transparent px-4 text-sm font-bold hover:bg-ayc-sand disabled:cursor-wait"
        >
          {pending ? "Checking with PayMongo…" : "Check status with PayMongo"}
        </button>
      ) : null}
      <p
        role="status"
        className={cn(
          "min-h-4 font-mono text-[11px] font-medium",
          notice?.tone === "done"
            ? "text-ayc-success"
            : notice?.tone === "failed"
              ? "text-destructive"
              : "text-ayc-warning",
        )}
      >
        {notice?.text ?? ""}
      </p>
    </div>
  );
}
