"use client";

import Image from "next/image";
import { type DragEvent, useEffect, useId, useRef, useState } from "react";

import { callAdminAction } from "@/components/admin/call-admin-action";
import { ProductImage } from "@/components/website/product-image";
import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import {
  failedPhoto,
  movePhoto,
  pendingPhoto,
  photoCaption,
  photoFileRefusal,
  photoSizeWarning,
  photoState,
  uploadKeyOf,
} from "@/lib/admin/photo-rules";
import { cn } from "@/lib/utils";
import type { UploadTicket } from "@/services/uploads.types";

import { measureImage, putFile } from "./put-file";

// ─────────────────────────────────────────────────────────────────────────────
// PHOTOS · FIRST IS THE COVER (mockup 176–181; BUILD-MAP §3.3; spec, Phase 2 →
// Products: Photos). The photos are the editor's form value, in order, and save
// with the Product. Files chosen or dropped here are checked, then uploaded one
// by one straight to the upload seam's one-time URL, with progress; each one
// shows in the strip as unsaved until "Save product". Photos reorder by
// dragging, or with Move left and Move right for keyboard and screen readers.
// ─────────────────────────────────────────────────────────────────────────────

/** A file chosen in this editor, uploading or uploaded. */
interface PhotoUpload {
  name: string;
  /** The file in the browser, shown until it's saved. */
  preview: string;
  /** Whether its upload has begun, as opposed to waiting its turn. */
  started: boolean;
  /** 0 to 1. */
  progress: number;
  /** Below 1000 × 1000 or not square; it can still be saved. */
  warning: string | null;
  /** The path the upload seam gave it, once its file has arrived. */
  path: string | null;
  /** Why the server refused to take it, when it did: trying again won't help. */
  refusal: string | null;
}

interface PhotoStripProps {
  /** The form's photos, in order (photo-rules.ts). */
  photos: string[];
  /** Changes the form's photos from their current value; uploads finish after other edits. */
  onChange: (next: (photos: string[]) => string[]) => void;
  createUpload: AdminAction<UploadTicket>;
  /** The last save's message about the photos. */
  error?: string;
}

/** Pure: what the server said when it refused to give an upload URL, or null. */
function refusalOf(answer: AdminActionState<UploadTicket>): string | null {
  if (answer.status !== "refused") return null;
  const { error } = answer;
  if (error.kind === "forbidden") return error.message;
  if (error.kind === "invalid") {
    return Object.values(error.fieldErrors).flat()[0] ?? error.formError ?? null;
  }
  return null;
}

/** The strip's caption and its messages share these. */
const NOTE = "font-mono text-[11px] font-medium";

export function PhotoStrip({ photos, onChange, createUpload, error }: PhotoStripProps) {
  const [uploads, setUploads] = useState<Record<string, PhotoUpload>>({});
  const [refusals, setRefusals] = useState<string[]>([]);
  const [dragged, setDragged] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // The files themselves, for uploads that run after the render that chose them.
  const files = useRef(new Map<string, File>());
  const queue = useRef(Promise.resolve());
  const nextKey = useRef(0);
  const previews = useRef(new Set<string>());
  const labelId = useId();
  const list = useRef<HTMLUListElement>(null);
  // After Remove, focus goes to the Remove button now in the removed photo's place.
  const [focusAfterRemove, setFocusAfterRemove] = useState<number | null>(null);

  useEffect(() => {
    const shown = previews.current;
    return () => shown.forEach((preview) => URL.revokeObjectURL(preview));
  }, []);

  useEffect(() => {
    if (focusAfterRemove === null) return;
    const removes = list.current?.querySelectorAll<HTMLElement>("[data-remove]") ?? [];
    const next = removes[Math.min(focusAfterRemove, removes.length - 1)];
    (next ?? list.current?.querySelector<HTMLElement>("input[type=file]"))?.focus();
    setFocusAfterRemove(null);
  }, [focusAfterRemove]);

  const patch = (key: string, changes: Partial<PhotoUpload>) =>
    setUploads((current) => {
      const upload = current[key];
      return upload ? { ...current, [key]: { ...upload, ...changes } } : current;
    });

  /** Swaps one of the form's photos for another, wherever it is now. */
  const replace = (from: string, to: string) =>
    onChange((current) => current.map((photo) => (photo === from ? to : photo)));

  /** Uploads one file: a one-time URL from the server, then the file itself. */
  async function send(key: string) {
    const file = files.current.get(key);
    if (!file) return;
    patch(key, { started: true, progress: 0 });
    const ticket = await callAdminAction(createUpload, {
      input: { contentType: file.type, size: file.size },
    });
    let sent = ticket.status === "saved";
    if (ticket.status === "saved") {
      try {
        await putFile(ticket.value.uploadUrl, file, (progress) => patch(key, { progress }));
      } catch {
        sent = false;
      }
    }
    // Removed from the strip meanwhile: nothing to show.
    if (!files.current.has(key)) return;
    if (ticket.status === "saved" && sent) {
      patch(key, { path: ticket.value.path, progress: 1 });
      replace(pendingPhoto(key), ticket.value.path);
      setAnnouncement(`${file.name} uploaded.`);
    } else {
      patch(key, { started: false, progress: 0, refusal: refusalOf(ticket) });
      replace(pendingPhoto(key), failedPhoto(key));
      setAnnouncement(`${file.name}: upload failed.`);
    }
  }

  /** One by one. An upload that throws (a redirect to sign-in) doesn't hold up the rest. */
  const enqueue = (key: string) => {
    queue.current = queue.current.catch(() => undefined).then(() => send(key));
  };

  function add(chosen: File[]) {
    const refused: string[] = [];
    const added: { key: string; upload: PhotoUpload }[] = [];
    for (const file of chosen) {
      const refusal = photoFileRefusal(file);
      if (refusal) {
        refused.push(refusal);
        continue;
      }
      const key = String(nextKey.current++);
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      files.current.set(key, file);
      added.push({
        key,
        upload: {
          name: file.name,
          preview,
          started: false,
          progress: 0,
          warning: null,
          path: null,
          refusal: null,
        },
      });
      // Measured in the browser before upload; a warning never stops the save.
      void measureImage(file).then((size) => {
        if (size) patch(key, { warning: photoSizeWarning(size) });
      });
    }
    setRefusals(refused);
    if (added.length === 0) return;
    setUploads((current) => ({
      ...current,
      ...Object.fromEntries(added.map(({ key, upload }) => [key, upload])),
    }));
    onChange((current) => [...current, ...added.map(({ key }) => pendingPhoto(key))]);
    added.forEach(({ key }) => enqueue(key));
    setAnnouncement(
      `${added.length} ${added.length === 1 ? "photo" : "photos"} added. Uploading one by one.`,
    );
  }

  function retry(key: string) {
    patch(key, { refusal: null });
    replace(failedPhoto(key), pendingPhoto(key));
    enqueue(key);
  }

  function remove(index: number) {
    const photo = photos[index];
    if (photo === undefined) return;
    onChange((current) => current.filter((candidate) => candidate !== photo));
    const key = keyOf(photo);
    if (key !== null) {
      files.current.delete(key);
      setUploads(({ [key]: _removed, ...rest }) => rest);
    }
    setAnnouncement(`Photo ${index + 1} removed.`);
    setFocusAfterRemove(index);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= photos.length) return;
    onChange((current) => movePhoto(current, from, to));
    setAnnouncement(
      to === 0 ? "Moved to first: it's the cover." : `Moved to ${to + 1} of ${photos.length}.`,
    );
  }

  /** The upload a photo is, if it was chosen in this editor. */
  function keyOf(photo: string): string | null {
    return (
      uploadKeyOf(photo) ??
      Object.entries(uploads).find(([, upload]) => upload.path === photo)?.[0] ??
      null
    );
  }

  const tiles = photos.map((photo, index) => {
    const key = keyOf(photo);
    const upload = key === null ? undefined : uploads[key];
    return { photo, index, key, upload };
  });
  const following = tiles.filter(
    (tile): tile is typeof tile & { key: string; upload: PhotoUpload } =>
      tile.upload !== undefined &&
      (tile.upload.path !== tile.photo || tile.upload.warning !== null),
  );

  /** Files dropped anywhere on the strip are added; a dragged photo is moved instead. */
  function onStripDragOver(event: DragEvent) {
    if (event.dataTransfer.types.includes("Files")) event.preventDefault();
  }
  function onStripDrop(event: DragEvent) {
    if (event.dataTransfer.files.length === 0) return;
    event.preventDefault();
    add([...event.dataTransfer.files]);
  }

  return (
    <div className="flex flex-col gap-1.5" onDragOver={onStripDragOver} onDrop={onStripDrop}>
      <span id={labelId} className="font-mono text-xs font-medium text-muted-foreground">
        PHOTOS · FIRST IS THE COVER
      </span>
      <ul ref={list} aria-labelledby={labelId} className="grid grid-cols-4 gap-1.5">
        {tiles.map(({ photo, index, key, upload }) => {
          const failed = photoState(photo) === "failed";
          const uploading = photoState(photo) === "pending";
          const unsaved = upload !== undefined && upload.path === photo;
          return (
            <li
              key={key ?? photo}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(index));
                setDragged(index);
              }}
              onDragOver={(event) => {
                if (dragged !== null) event.preventDefault();
              }}
              onDrop={(event) => {
                if (dragged === null) return;
                event.preventDefault();
                event.stopPropagation();
                move(dragged, index);
                setDragged(null);
              }}
              onDragEnd={() => setDragged(null)}
              className={cn(
                "flex min-w-0 cursor-grab flex-col gap-1",
                dragged === index && "opacity-50",
              )}
            >
              <span
                className={cn(
                  "relative aspect-square overflow-hidden bg-ayc-sand",
                  index === 0 ? "border-2 border-ayc-blue" : "border",
                  failed && "border-destructive",
                )}
              >
                {upload ? (
                  <Image src={upload.preview} alt="" fill unoptimized className="object-cover" />
                ) : photo.startsWith("/") ? (
                  <ProductImage photo={{ src: photo, alt: "" }} sizes="80px" />
                ) : null}
                <span className="sr-only">
                  Photo {index + 1}
                  {upload ? `: ${upload.name}` : ""}
                </span>
                {index === 0 ? (
                  <span className="absolute top-0 left-0 bg-ayc-blue px-1 py-0.5 font-mono text-[9px] leading-none font-bold text-ayc-cream">
                    COVER
                  </span>
                ) : null}
                {upload?.warning ? (
                  <span
                    title={upload.warning}
                    className="absolute top-0 right-0 bg-ayc-warning px-1 py-0.5 font-mono text-[9px] leading-none font-bold text-ayc-navy"
                  >
                    <span aria-hidden="true">!</span>
                    <span className="sr-only">Warning: {upload.warning}</span>
                  </span>
                ) : null}
                {unsaved ? (
                  <span className="absolute bottom-0 left-0 bg-ayc-navy px-1 py-0.5 font-mono text-[9px] leading-none font-bold text-ayc-cream">
                    UNSAVED
                  </span>
                ) : null}
                {uploading && upload ? (
                  <span aria-hidden="true" className="absolute inset-0 bg-ayc-paper/60">
                    <span
                      className="absolute bottom-0 left-0 h-1 bg-ayc-blue"
                      style={{ width: `${Math.round(upload.progress * 100)}%` }}
                    />
                  </span>
                ) : null}
                {failed ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 flex items-center justify-center bg-destructive/25 font-bold text-destructive"
                  >
                    !
                  </span>
                ) : null}
              </span>
              <span className="flex justify-between">
                <TileButton
                  label={`Move left, photo ${index + 1}`}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  ‹
                </TileButton>
                <TileButton
                  label={`Move right, photo ${index + 1}`}
                  disabled={index === photos.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  ›
                </TileButton>
                <TileButton
                  remove
                  label={`Remove photo ${index + 1}`}
                  onClick={() => remove(index)}
                  className="text-destructive"
                >
                  ×
                </TileButton>
              </span>
            </li>
          );
        })}
        <li className="min-w-0">
          <label className="flex aspect-square cursor-pointer items-center justify-center border-[1.5px] border-dashed text-lg font-bold text-ayc-blue focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ayc-blue hover:bg-ayc-sand">
            <span aria-hidden="true">+</span>
            <input
              type="file"
              aria-label="Add photos"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                add([...(event.target.files ?? [])]);
                // The same file can be chosen again, e.g. after removing it.
                event.target.value = "";
              }}
            />
          </label>
        </li>
      </ul>
      <p className="text-xs text-muted-foreground">{photoCaption(photos.length)}</p>
      {following.length > 0 ? (
        <ul aria-label="Uploads" className="flex flex-col gap-1">
          {following.map(({ photo, key, upload }) => (
            <UploadLine
              key={key}
              upload={upload}
              state={lineState(photo, upload)}
              onRetry={() => retry(key)}
            />
          ))}
        </ul>
      ) : null}
      {refusals.length > 0 ? (
        <div role="alert" className={cn(NOTE, "flex flex-col gap-0.5 text-destructive")}>
          {refusals.map((refusal) => (
            <p key={refusal}>{refusal}</p>
          ))}
        </div>
      ) : null}
      {error ? <p className={cn(NOTE, "text-destructive")}>{error}</p> : null}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

/** Pure: what an upload's line under the strip says. */
function lineState(photo: string, upload: PhotoUpload): UploadLineProps["state"] {
  switch (photoState(photo)) {
    case "failed":
      return "failed";
    case "pending":
      return upload.started ? "uploading" : "waiting";
    case "ready":
      return "done";
  }
}

interface TileButtonProps {
  label: string;
  /** The Remove button, where focus lands after a photo is removed. */
  remove?: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: string;
}

/**
 * Move left, Move right and Remove under each photo. A disabled one stays
 * focusable (aria-disabled), so focus isn't lost when a photo reaches an end.
 */
function TileButton({
  label,
  remove = false,
  onClick,
  disabled = false,
  className,
  children,
}: TileButtonProps) {
  return (
    <button
      type="button"
      data-remove={remove || undefined}
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={cn(
        "flex size-6 cursor-pointer items-center justify-center font-mono text-sm font-bold hover:bg-ayc-sand aria-disabled:cursor-default aria-disabled:text-muted-foreground/50 aria-disabled:hover:bg-transparent",
        className,
      )}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

interface UploadLineProps {
  upload: PhotoUpload;
  state: "waiting" | "uploading" | "failed" | "done";
  onRetry: () => void;
}

/**
 * One upload under the strip: its progress; its failure with Try again, or
 * the server's reason when it refused the file; or its warning.
 */
function UploadLine({ upload, state, onRetry }: UploadLineProps) {
  const percent = Math.round(upload.progress * 100);
  return (
    <li className={cn(NOTE, "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5")}>
      <span className="max-w-full truncate text-foreground">{upload.name}</span>
      {state === "waiting" ? <span className="text-muted-foreground">WAITING</span> : null}
      {state === "uploading" ? (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span
            role="progressbar"
            aria-label={`Uploading ${upload.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="relative h-1.5 w-16 border border-ayc-navy"
          >
            <span
              className="absolute inset-y-0 left-0 bg-ayc-blue"
              style={{ width: `${percent}%` }}
            />
          </span>
          {percent}%
        </span>
      ) : null}
      {state === "failed" && upload.refusal ? (
        <span className="text-destructive">Upload refused · {upload.refusal}</span>
      ) : null}
      {state === "failed" && !upload.refusal ? (
        <span className="text-destructive">
          Upload failed ·{" "}
          <button
            type="button"
            aria-label={`Try again: ${upload.name}`}
            onClick={onRetry}
            className="min-h-6 cursor-pointer font-bold underline underline-offset-2"
          >
            Try again
          </button>
        </span>
      ) : null}
      {state === "done" && upload.warning ? (
        <span className="text-ayc-warning">{upload.warning} · IT CAN STILL BE SAVED</span>
      ) : null}
    </li>
  );
}
