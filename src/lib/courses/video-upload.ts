import type { UploadTarget } from "@/services/video.types";

// The browser's half of a Lesson video upload (Phase 5, ticket 02; spec,
// Phase 5 planning decisions → Uploads): the file goes straight from the
// browser to VdoCipher's upload host, never through our servers, as one
// multipart POST of the permission's fields and then the file
// (XMLHttpRequest, because fetch can't report upload progress). Not
// resumable: a failure starts over. With the video fake there is no host, so
// a quick progress bar plays instead.

/** How far an upload is: the share sent (0 to 1) and the seconds left, once it can tell. */
export interface UploadProgress {
  sent: number;
  secondsLeft: number | null;
}

/** An upload under way: how it ends, and a way to stop it. */
export interface VideoSend {
  done: Promise<"sent" | "failed">;
  abort(): void;
}

/** How long the fake's progress bar takes. */
export const FAKE_UPLOAD_MS = 2000;
const FAKE_STEPS = 10;

/**
 * Pure: the seconds left at this rate, once there's enough to go on (a
 * second in and 1% sent); null before then.
 */
export function secondsLeftOf(sent: number, elapsedMs: number): number | null {
  if (sent < 0.01 || elapsedMs < 1000) return null;
  if (sent >= 1) return 0;
  return ((elapsedMs / sent) * (1 - sent)) / 1000;
}

export function sendVideo(
  target: UploadTarget,
  file: File,
  onProgress: (progress: UploadProgress) => void,
  now: () => number = Date.now,
): VideoSend {
  const startedAt = now();
  const report = (sent: number) =>
    onProgress({ sent, secondsLeft: secondsLeftOf(sent, now() - startedAt) });

  if (target.kind === "fake") {
    let step = 0;
    let finish: (outcome: "sent" | "failed") => void = () => {};
    const done = new Promise<"sent" | "failed">((resolve) => {
      finish = resolve;
    });
    const timer = setInterval(() => {
      step += 1;
      report(step / FAKE_STEPS);
      if (step >= FAKE_STEPS) {
        clearInterval(timer);
        finish("sent");
      }
    }, FAKE_UPLOAD_MS / FAKE_STEPS);
    return {
      done,
      abort: () => {
        clearInterval(timer);
        finish("failed");
      },
    };
  }

  const request = new XMLHttpRequest();
  const done = new Promise<"sent" | "failed">((resolve) => {
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) report(event.loaded / event.total);
    };
    request.onload = () =>
      resolve(request.status >= 200 && request.status < 300 ? "sent" : "failed");
    request.onerror = () => resolve("failed");
    request.onabort = () => resolve("failed");
  });
  const form = new FormData();
  for (const [name, value] of target.fields) form.append(name, value);
  // The file goes last: the storage host reads every field before it.
  form.append("file", file);
  request.open("POST", target.url);
  request.send(form);
  return { done, abort: () => request.abort() };
}
