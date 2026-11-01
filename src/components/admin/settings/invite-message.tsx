"use client";

import { useEffect, useId, useRef, useState } from "react";

import { copyToClipboard } from "@/lib/admin/copy-invite";

interface InviteMessageProps {
  /** The ready-to-send message, from inviteMessage(). */
  message: string;
  /** Start with the clipboard already refused: the text selected, ready to copy by hand. */
  copyFailed?: boolean;
}

/**
 * The invite message in a read-only field, with "Copy invite message". When
 * the clipboard can't be used, it selects the text and says "Copy it from
 * here", so the Owner can copy it themselves.
 */
export function InviteMessage({ message, copyFailed = false }: InviteMessageProps) {
  const [state, setState] = useState<"ready" | "copied" | "failed">(
    copyFailed ? "failed" : "ready",
  );
  const field = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  useEffect(() => {
    if (state !== "failed") return;
    field.current?.focus();
    field.current?.select();
  }, [state]);

  async function copy() {
    setState((await copyToClipboard(message)) ? "copied" : "failed");
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-mono text-xs font-medium text-muted-foreground">
        INVITE MESSAGE
      </label>
      <textarea
        id={id}
        ref={field}
        readOnly
        rows={6}
        value={message}
        onFocus={(event) => event.currentTarget.select()}
        className="w-full resize-none border-[1.5px] bg-white px-2.5 py-2.25 text-sm leading-normal text-foreground"
      />
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={copy}
          className="min-h-10 cursor-pointer border-[1.5px] bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          Copy invite message
        </button>
        <p
          role="status"
          className={
            state === "failed"
              ? "text-sm font-semibold text-destructive"
              : "font-mono text-[11px] font-medium text-ayc-success"
          }
        >
          {state === "copied"
            ? "✓ COPIED · PASTE IT INTO AN EMAIL OR CHAT"
            : state === "failed"
              ? "Couldn’t copy it for you. Copy it from here."
              : ""}
        </p>
      </div>
    </div>
  );
}
