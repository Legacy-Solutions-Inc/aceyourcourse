"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { callAdminAction } from "@/components/admin/call-admin-action";
import { PassPlayer } from "@/components/video/pass-player";
import type { AdminAction } from "@/lib/admin/action";
import {
  CONNECT_VIDEO_SERVICE,
  hasReadyVideo,
  uploadProgressLine,
  videoFileRefusal,
  videoInFlight,
  videoLength,
} from "@/lib/courses/course-rules";
import { sendVideo as sendVideoInBrowser, type UploadProgress } from "@/lib/courses/video-upload";
import type { AdminLesson, AdminLessonPreview, AdminLessonUpload } from "@/services/admin.types";

import { fieldErrorsOf, LABEL, PLAIN_BUTTON, PRIMARY_BUTTON, refusalText, TAG } from "./course-ui";

export interface LessonVideoActions {
  createLessonUpload: AdminAction<AdminLessonUpload>;
  saveLessonUploadOutcome: AdminAction<AdminLesson>;
  checkLessonVideoStatus: AdminAction<AdminLesson>;
  previewLesson: AdminAction<AdminLessonPreview>;
}

interface LessonVideoProps {
  lesson: AdminLesson;
  /** Whether this server has a video service: without one, upload is off. */
  connected: boolean;
  /** The Staff member's email, drawn across the sample player's preview. */
  watermark: string;
  actions: LessonVideoActions;
  /** How the browser sends the file (replaced in tests). */
  send?: typeof sendVideoInBrowser;
  /** How often the editor asks for the status while a video uploads or processes. */
  pollMs?: number;
}

/** How often the status is asked for while a video processes. */
export const STATUS_POLL_MS = 4000;

/** Pure: what the status poll watches for a change: the state, the video, the replacement's state. */
const videoKey = (lesson: AdminLesson) =>
  `${lesson.state}:${lesson.videoId}:${lesson.replacementState}`;

/**
 * The Lesson editor's video (Phase 5, ticket 02; BUILD-MAP §3.7; spec, Phase 5
 * planning decisions → Uploads, Access and playback): upload an MP4 or MOV
 * (checked here first, and again on the server), straight from the browser to
 * the video service, with progress ("41% · about 6 min left · keep this page
 * open") and a warning before leaving mid-upload; then "Processing", asking
 * for the status every few seconds while open, until the video is ready with
 * its length. "Upload failed · Try again" starts over. A ready video can be
 * previewed and replaced: the ready one plays until the new one is ready.
 * With no video service: "Connect the video service to upload".
 */
export function LessonVideo({
  lesson,
  connected,
  watermark,
  actions,
  send = sendVideoInBrowser,
  pollMs = STATUS_POLL_MS,
}: LessonVideoProps) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [preview, setPreview] = useState<AdminLessonPreview | null>(null);
  const [pending, startTransition] = useTransition();
  const sending = progress !== null;
  const ready = hasReadyVideo(lesson.state);
  const polling =
    connected &&
    !sending &&
    (videoInFlight(lesson.state) || videoInFlight(lesson.replacementState));

  // The browser warns before leaving while the file is still being sent.
  useEffect(() => {
    if (!sending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [sending]);

  // While a video uploads or processes, ask for its status every few
  // seconds: one check at a time, the next only once the last has answered.
  const seen = videoKey(lesson);
  useEffect(() => {
    if (!polling) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      const state = await callAdminAction(actions.checkLessonVideoStatus, {
        input: { id: lesson.id },
      });
      if (stopped) return;
      if (state.status === "saved" && videoKey(state.value) !== seen) {
        router.refresh();
        return;
      }
      timer = setTimeout(check, pollMs);
    };
    timer = setTimeout(check, pollMs);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [polling, pollMs, lesson.id, seen, actions.checkLessonVideoStatus, router]);

  function pick() {
    setProblem(null);
    input.current?.click();
  }

  function upload(file: File) {
    const refusal = videoFileRefusal({ name: file.name, type: file.type, size: file.size });
    if (refusal) {
      setProblem(refusal);
      return;
    }
    startTransition(async () => {
      const permission = await callAdminAction(actions.createLessonUpload, {
        input: { id: lesson.id, name: file.name, type: file.type, size: file.size },
      });
      if (permission.status !== "saved") {
        setProblem(fieldErrorsOf(permission).file ?? refusalText(permission, "NOT UPLOADED"));
        return;
      }
      const { videoId, target } = permission.value;
      setPreview(null);
      setProgress({ sent: 0, secondsLeft: null });
      const outcome = await send(target, file, setProgress).done;
      await callAdminAction(actions.saveLessonUploadOutcome, {
        input: { id: lesson.id, video: videoId, outcome },
      });
      setProgress(null);
      router.refresh();
    });
  }

  function watch() {
    setProblem(null);
    startTransition(async () => {
      const state = await callAdminAction(actions.previewLesson, { input: { id: lesson.id } });
      if (state.status === "saved") setPreview(state.value);
      else setProblem(refusalText(state, "NO PREVIEW"));
    });
  }

  const uploadButton = (label: string, primary = false) => (
    <button
      type="button"
      onClick={pick}
      disabled={!connected || pending || sending}
      className={primary ? PRIMARY_BUTTON : PLAIN_BUTTON}
    >
      {label}
    </button>
  );

  let body: React.ReactNode;
  if (sending) {
    body = (
      <div className="flex w-full flex-col gap-2" role="status">
        <span className={TAG}>UPLOADING</span>
        <div
          role="progressbar"
          aria-label="Upload progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.floor(progress.sent * 100)}
          className="h-2 w-full border border-ayc-rule bg-white"
        >
          <div className="h-full bg-ayc-blue" style={{ width: `${progress.sent * 100}%` }} />
        </div>
        <p className="font-mono text-[11px] font-medium">
          {uploadProgressLine(progress.sent, progress.secondsLeft)}
        </p>
      </div>
    );
  } else if (lesson.state === "processing" || lesson.state === "uploading") {
    body = (
      <div role="status" className="flex flex-col items-center gap-1">
        <span className={TAG}>PROCESSING</span>
        <p className="text-[13px] text-muted-foreground">
          {lesson.state === "processing"
            ? "Processing · the video service is preparing it. You can keep editing."
            : "Waiting for the upload to arrive. If it stopped, upload it again."}
        </p>
        {lesson.state === "uploading" ? uploadButton("Upload again") : null}
      </div>
    );
  } else if (lesson.state === "upload-failed") {
    body = (
      <p
        role="alert"
        className="flex items-center gap-2 font-mono text-[11px] font-bold text-destructive"
      >
        Upload failed · {uploadButton("Try again", true)}
      </p>
    );
  } else if (ready && lesson.videoSeconds !== null) {
    body = (
      <div className="flex w-full flex-col gap-2">
        {preview ? (
          <PassPlayer
            pass={preview.pass}
            seconds={preview.seconds}
            watermark={watermark}
            title={lesson.title}
          />
        ) : null}
        <p className="font-mono text-[11px] font-bold">
          VIDEO READY · {videoLength(lesson.videoSeconds)}
        </p>
        {lesson.replacementState === "upload-failed" ? (
          <p role="alert" className="font-mono text-[11px] font-bold text-destructive">
            The new video’s upload failed · the current one still plays
          </p>
        ) : videoInFlight(lesson.replacementState) ? (
          <p role="status" className="text-[13px] text-muted-foreground">
            Processing the new video · the current one plays until it’s ready.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {connected && !preview ? (
            <button type="button" onClick={watch} disabled={pending} className={PLAIN_BUTTON}>
              ▶ Preview
            </button>
          ) : null}
          {uploadButton(
            lesson.replacementState === "upload-failed" ? "Try again" : "Replace video",
          )}
        </div>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col items-center gap-2">
        <span className={TAG}>NO VIDEO</span>
        {uploadButton("Upload video", true)}
        <p className="text-[12px] text-muted-foreground">MP4 or MOV, up to 4 GB.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className={LABEL}>VIDEO</p>
      <div className="flex min-h-40 max-w-xl flex-col items-center justify-center gap-1 border-[1.5px] border-dashed bg-white p-4 text-center">
        {body}
        {connected ? null : (
          <p className="text-[13px] font-semibold text-muted-foreground">{CONNECT_VIDEO_SERVICE}</p>
        )}
      </div>
      <input
        ref={input}
        type="file"
        aria-label="Video file"
        accept="video/mp4,video/quicktime,.mp4,.mov"
        disabled={!connected}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) upload(file);
        }}
      />
      {problem ? (
        <p role="alert" className="font-mono text-[11px] font-bold text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
