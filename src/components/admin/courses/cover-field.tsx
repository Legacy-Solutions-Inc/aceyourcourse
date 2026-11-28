"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import { callAdminAction } from "@/components/admin/call-admin-action";
import { putFile } from "@/components/admin/products/put-file";
import type { AdminAction } from "@/lib/admin/action";
import { failedPhoto, pendingPhoto, photoFileRefusal, photoState } from "@/lib/admin/photo-rules";
import { cn } from "@/lib/utils";
import type { UploadTicket } from "@/services/uploads.types";

interface CoverFieldProps {
  /** The Course's cover (its src), a finished upload's path, an upload on its way, or "". */
  value: string;
  /** Changes the value from its current one: an upload finishes after other edits. */
  onChange: (next: (current: string) => string) => void;
  createUpload: AdminAction<UploadTicket>;
  /** The Course, for Storage to file the cover under; none for a new Course. */
  courseId: string | null;
  /** The Subject block's code, shown while there's no cover. */
  subject: string;
  error?: string;
}

/**
 * "Cover image · 16:9" in Course settings (BUILD-MAP §3.7): uploaded the way
 * a Product photo is, straight to storage, then saved with the settings. A
 * Course with no cover shows its Subject block on cards.
 */
export function CoverField({
  value,
  onChange,
  createUpload,
  courseId,
  subject,
  error,
}: CoverFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<{ name: string; preview: string } | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const nextKey = useRef(0);

  useEffect(() => {
    const preview = chosen?.preview;
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [chosen]);

  async function upload(file: File) {
    const refused = photoFileRefusal(file);
    setRefusal(refused);
    if (refused) return;
    const key = String(nextKey.current++);
    const pending = pendingPhoto(key);
    setChosen({ name: file.name, preview: URL.createObjectURL(file) });
    onChange(() => pending);

    const ticket = await callAdminAction(createUpload, {
      input: { contentType: file.type, size: file.size, ...(courseId ? { owner: courseId } : {}) },
    });
    let sent = ticket.status === "saved";
    if (ticket.status === "saved") {
      try {
        await putFile(ticket.value.uploadUrl, file, () => {});
      } catch {
        sent = false;
      }
    }
    // Only if it's still the cover waiting for this upload.
    const done = ticket.status === "saved" && sent ? ticket.value.path : failedPhoto(key);
    onChange((current) => (current === pending ? done : current));
  }

  const state = photoState(value);
  const shown = chosen && value !== "" ? chosen.preview : /^(\/|https:)/.test(value) ? value : null;
  const describedBy = [error || refusal ? `${id}-error` : null, `${id}-status`]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-mono text-xs font-medium text-muted-foreground">
        COVER IMAGE · 16:9
      </label>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2.5 border-[1.5px] border-dashed p-2.5 text-[13px] font-medium",
          (error || state === "failed") && "border-destructive",
        )}
      >
        <span className="relative flex aspect-video w-24 flex-none items-center justify-center overflow-hidden border bg-ayc-blue font-mono text-[11px] font-bold text-white">
          {shown ? <Image src={shown} alt="" fill unoptimized className="object-cover" /> : subject}
        </span>
        <span id={`${id}-status`} className="min-w-0 flex-1 break-words">
          {state === "pending"
            ? `Uploading ${chosen?.name ?? "the cover"}…`
            : state === "failed"
              ? "The upload failed. Choose it again, or remove it."
              : value === ""
                ? "No cover: cards show the Subject block"
                : (chosen?.name ?? "This Course’s cover")}
        </span>
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-describedby={describedBy}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="min-h-6 cursor-pointer font-bold text-ayc-blue hover:underline"
        >
          {value === "" ? "Upload" : "Replace"}
        </button>
        {value !== "" ? (
          <button
            type="button"
            onClick={() => {
              setChosen(null);
              onChange(() => "");
            }}
            className="min-h-6 cursor-pointer font-bold text-destructive hover:underline"
          >
            Remove
          </button>
        ) : null}
      </div>
      {error || refusal ? (
        <p id={`${id}-error`} className="font-mono text-[11px] font-medium text-destructive">
          {refusal ?? error}
        </p>
      ) : null}
    </div>
  );
}
