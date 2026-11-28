import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type { UploadProgress, VideoSend } from "@/lib/courses/video-upload";
import type { AdminLesson, AdminLessonPreview, AdminLessonUpload } from "@/services/admin.types";
import type { UploadTarget } from "@/services/video.types";

import { CONCRETE } from "../../../../test/course-fixtures";
import { LessonVideo, type LessonVideoActions } from "./lesson-video";

// The Lesson editor's video (Phase 5, ticket 02): the file checks before any
// permission is asked, the progress line, the warning before leaving, a
// failed upload and Try again, Processing until the status poll finds the
// video ready, "Connect the video service to upload" with no service, and
// the preview in the sample player. The Server Actions and the browser's
// upload are the boundaries, so they're replaced.
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  unstable_rethrow: () => {},
}));

const NO_VIDEO = CONCRETE.lessons[0] as AdminLesson;
const VIDEO_ID = "fake-video-1";
const READY: AdminLesson = {
  ...NO_VIDEO,
  state: "draft",
  videoId: VIDEO_ID,
  videoSeconds: 754,
};

const mp4 = (size = 1024, name = "beams.mp4", type = "video/mp4") => {
  const file = new File(["mp4"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

/** A stand-in for the browser's upload that the test finishes by hand. */
function manualSend() {
  let progress: (p: UploadProgress) => void = () => {};
  let finish: (outcome: "sent" | "failed") => void = () => {};
  const calls: { target: UploadTarget; file: File }[] = [];
  const send = vi.fn(
    (target: UploadTarget, file: File, onProgress: (p: UploadProgress) => void) => {
      calls.push({ target, file });
      progress = onProgress;
      const done = new Promise<"sent" | "failed">((resolve) => {
        finish = resolve;
      });
      return { done, abort: () => finish("failed") } satisfies VideoSend;
    },
  );
  return {
    send,
    calls,
    progress: (p: UploadProgress) => act(() => progress(p)),
    finish: (outcome: "sent" | "failed") => act(async () => finish(outcome)),
  };
}

function renderVideo({
  lesson = NO_VIDEO,
  connected = true,
  actions = {},
  send = manualSend().send,
  pollMs,
}: {
  lesson?: AdminLesson;
  connected?: boolean;
  actions?: Partial<LessonVideoActions>;
  send?: ReturnType<typeof manualSend>["send"];
  pollMs?: number;
} = {}) {
  const all = {
    createLessonUpload: vi.fn(async (): Promise<AdminActionState<AdminLessonUpload>> => ({
      status: "saved",
      value: {
        lesson: { ...lesson, state: "uploading", videoId: VIDEO_ID },
        videoId: VIDEO_ID,
        target: { kind: "fake" },
      },
    })),
    saveLessonUploadOutcome: vi.fn(async (): Promise<AdminActionState<AdminLesson>> => ({
      status: "saved",
      value: lesson,
    })),
    checkLessonVideoStatus: vi.fn(async (): Promise<AdminActionState<AdminLesson>> => ({
      status: "saved",
      value: lesson,
    })),
    previewLesson: vi.fn(async (): Promise<AdminActionState<AdminLessonPreview>> => ({
      status: "saved",
      value: { pass: { kind: "sample", token: `sample:${VIDEO_ID}` }, seconds: 754 },
    })),
    ...actions,
  };
  render(
    <LessonVideo
      lesson={lesson}
      connected={connected}
      watermark="editor@example.com"
      actions={all}
      send={send}
      pollMs={pollMs}
    />,
  );
  return all;
}

beforeEach(() => {
  refresh.mockClear();
});

describe("LessonVideo", () => {
  describe("the file checks", () => {
    it.each([
      ["an AVI", mp4(1024, "beams.avi", "video/x-msvideo"), "PICK AN MP4 OR MOV VIDEO"],
      ["a PDF named .mp4", mp4(1024, "beams.mp4", "application/pdf"), "PICK AN MP4 OR MOV VIDEO"],
      ["a file over 4 GB", mp4(4 * 1024 ** 3 + 1), "KEEP THE VIDEO TO 4 GB OR LESS"],
    ])("refuses %s before asking for permission", async (_case, file, message) => {
      const user = userEvent.setup({ applyAccept: false });
      const actions = renderVideo();
      await user.upload(screen.getByLabelText("Video file"), file);
      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(actions.createLessonUpload).not.toHaveBeenCalled();
    });

    it("shows the server's refusal of the file too", async () => {
      const user = userEvent.setup();
      renderVideo({
        actions: {
          createLessonUpload: vi.fn(async () => ({
            status: "refused" as const,
            error: {
              kind: "invalid" as const,
              fieldErrors: {},
              formError: "THE VIDEO SERVICE DIDN’T ANSWER · TRY AGAIN",
            },
          })),
        },
      });
      await user.upload(screen.getByLabelText("Video file"), mp4());
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "THE VIDEO SERVICE DIDN’T ANSWER · TRY AGAIN",
      );
    });
  });

  describe("uploading", () => {
    it("asks for permission with the file's name, type and size, then sends it, showing progress", async () => {
      const user = userEvent.setup();
      const browser = manualSend();
      const actions = renderVideo({ send: browser.send });
      expect(screen.getByText("NO VIDEO")).toBeInTheDocument();
      expect(screen.getByText("MP4 or MOV, up to 4 GB.")).toBeInTheDocument();
      const file = mp4(250 * 1024 * 1024);
      await user.upload(screen.getByLabelText("Video file"), file);
      await waitFor(() => expect(browser.send).toHaveBeenCalledOnce());
      expect(actions.createLessonUpload).toHaveBeenCalledWith(
        { status: "idle" },
        {
          input: { id: NO_VIDEO.id, name: "beams.mp4", type: "video/mp4", size: 250 * 1024 * 1024 },
        },
      );
      expect(browser.calls[0]).toEqual({ target: { kind: "fake" }, file });

      browser.progress({ sent: 0.41, secondsLeft: 360 });
      expect(screen.getByText("41% · about 6 min left · keep this page open")).toBeInTheDocument();
      expect(screen.getByRole("progressbar", { name: "Upload progress" })).toHaveAttribute(
        "aria-valuenow",
        "41",
      );

      await browser.finish("sent");
      await waitFor(() =>
        expect(actions.saveLessonUploadOutcome).toHaveBeenCalledWith(
          { status: "idle" },
          { input: { id: NO_VIDEO.id, video: VIDEO_ID, outcome: "sent" } },
        ),
      );
      expect(refresh).toHaveBeenCalled();
    });

    it("warns before leaving the page mid-upload, and not after", async () => {
      const user = userEvent.setup();
      const browser = manualSend();
      renderVideo({ send: browser.send });
      await user.upload(screen.getByLabelText("Video file"), mp4());
      await waitFor(() => expect(browser.send).toHaveBeenCalledOnce());
      const leaving = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(leaving);
      expect(leaving.defaultPrevented).toBe(true);

      await browser.finish("sent");
      await waitFor(() => expect(refresh).toHaveBeenCalled());
      const later = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(later);
      expect(later.defaultPrevented).toBe(false);
    });

    it("tells the server a failed send, so the Lesson shows Upload failed", async () => {
      const user = userEvent.setup();
      const browser = manualSend();
      const actions = renderVideo({ send: browser.send });
      await user.upload(screen.getByLabelText("Video file"), mp4());
      await waitFor(() => expect(browser.send).toHaveBeenCalledOnce());
      await browser.finish("failed");
      await waitFor(() =>
        expect(actions.saveLessonUploadOutcome).toHaveBeenCalledWith(
          { status: "idle" },
          { input: { id: NO_VIDEO.id, video: VIDEO_ID, outcome: "failed" } },
        ),
      );
    });
  });

  describe("a failed upload", () => {
    it("shows Upload failed · Try again, which starts over with a new upload", async () => {
      const user = userEvent.setup();
      const browser = manualSend();
      const actions = renderVideo({
        lesson: { ...NO_VIDEO, state: "upload-failed", videoId: VIDEO_ID },
        send: browser.send,
      });
      expect(screen.getByRole("alert")).toHaveTextContent("Upload failed · Try again");
      await user.click(screen.getByRole("button", { name: "Try again" }));
      await user.upload(screen.getByLabelText("Video file"), mp4());
      await waitFor(() => expect(actions.createLessonUpload).toHaveBeenCalledOnce());
    });
  });

  describe("processing", () => {
    it("shows Processing and asks for the status every few seconds, refreshing once it's ready", async () => {
      const processing: AdminLesson = { ...NO_VIDEO, state: "processing", videoId: VIDEO_ID };
      let answer: AdminLesson = processing;
      const checkLessonVideoStatus = vi.fn(async (): Promise<AdminActionState<AdminLesson>> => ({
        status: "saved",
        value: answer,
      }));
      renderVideo({ lesson: processing, actions: { checkLessonVideoStatus }, pollMs: 20 });
      expect(screen.getByText("PROCESSING")).toBeInTheDocument();
      expect(screen.getByText(/the video service is preparing it/)).toBeInTheDocument();
      await waitFor(() => expect(checkLessonVideoStatus).toHaveBeenCalled());
      expect(refresh).not.toHaveBeenCalled();
      answer = READY;
      await waitFor(() => expect(refresh).toHaveBeenCalled());
      expect(checkLessonVideoStatus).toHaveBeenCalledWith(
        { status: "idle" },
        { input: { id: NO_VIDEO.id } },
      );
    });

    it("doesn't ask for the status when nothing is in flight", async () => {
      const checkLessonVideoStatus = vi.fn();
      renderVideo({ lesson: READY, actions: { checkLessonVideoStatus }, pollMs: 10 });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(checkLessonVideoStatus).not.toHaveBeenCalled();
    });
  });

  describe("a ready video", () => {
    it("shows its length, previews it in the sample player with the Staff watermark, and offers Replace video", async () => {
      const user = userEvent.setup();
      const actions = renderVideo({ lesson: READY });
      expect(screen.getByText("VIDEO READY · 12:34")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Replace video" })).toBeEnabled();
      await user.click(screen.getByRole("button", { name: "▶ Preview" }));
      expect(actions.previewLesson).toHaveBeenCalledWith(
        { status: "idle" },
        { input: { id: READY.id } },
      );
      expect(await screen.findByText("SAMPLE VIDEO")).toBeInTheDocument();
      expect(screen.getByTestId("sample-watermark").style.backgroundImage).toContain(
        encodeURIComponent("editor@example.com"),
      );
    });

    it("says the current video plays while the new one processes, and when its upload failed", () => {
      renderVideo({
        lesson: { ...READY, replacementVideoId: "fake-video-2", replacementState: "processing" },
      });
      expect(screen.getByText(/the current one plays until it’s ready/)).toBeInTheDocument();
    });

    it("offers Try again after a replacement's upload failed", () => {
      renderVideo({
        lesson: { ...READY, replacementVideoId: "fake-video-2", replacementState: "upload-failed" },
      });
      expect(screen.getByRole("alert")).toHaveTextContent("the current one still plays");
      expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    });
  });

  describe("with no video service", () => {
    it("says Connect the video service to upload, with upload off", () => {
      renderVideo({ connected: false });
      expect(screen.getByText("Connect the video service to upload")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Upload video" })).toBeDisabled();
      expect(screen.getByLabelText("Video file")).toBeDisabled();
    });
  });
});
