"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type Outcome = { tone: "done" | "failed"; text: string };

const EXPORTED = "✓ CSV EXPORTED · MATCHING ORDERS ONLY";
const UNREACHABLE = "COULDN’T REACH THE SERVER · NOTHING WAS EXPORTED";
const REFUSED = "THE CSV WASN’T EXPORTED · RELOAD THE PAGE AND TRY AGAIN";
const FALLBACK_NAME = "ayc-orders.csv";

/** Pure: the file name in a Content-Disposition header, or the fallback. */
const filenameOf = (disposition: string | null) =>
  /filename="([^"]+)"/.exec(disposition ?? "")?.[1] ?? FALLBACK_NAME;

/**
 * "Export CSV" in the Orders header (story 147): asks the export route for
 * exactly the Orders the list's filters match (it logs the export in Staff
 * Activity), and saves the file only when the server gives it. A refusal,
 * such as a session that has ended, saves nothing and says why, so the line
 * never claims an export that didn't happen.
 */
export function ExportCsvButton({ href }: { href: string }) {
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function exportCsv() {
    setPending(true);
    setOutcome(null);
    try {
      const response = await fetch(href, { credentials: "same-origin" });
      if (!response.ok) {
        setOutcome({ tone: "failed", text: (await response.text()).trim() || REFUSED });
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameOf(response.headers.get("content-disposition"));
      document.body.append(link);
      link.click();
      link.remove();
      // The browser has the file once the click is handled.
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setOutcome({ tone: "done", text: EXPORTED });
    } catch {
      setOutcome({ tone: "failed", text: UNREACHABLE });
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span
        role="status"
        className={cn(
          "font-mono text-[11px] font-medium",
          outcome?.tone === "failed" ? "text-destructive" : "text-ayc-success",
        )}
      >
        {outcome?.text ?? ""}
      </span>
      <button
        type="button"
        onClick={exportCsv}
        disabled={pending}
        className="flex min-h-10 cursor-pointer items-center border-[1.5px] bg-ayc-orange px-4 text-sm font-bold text-ayc-navy shadow-hard-sm disabled:cursor-wait"
      >
        {pending ? "Exporting…" : "Export CSV"}
      </button>
    </span>
  );
}
