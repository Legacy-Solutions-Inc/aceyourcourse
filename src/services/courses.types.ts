import type { ContentVisibility } from "@/services/content.types";

// ─────────────────────────────────────────────────────────────────────────────
// Video Courses (Phase 5; spec, Phase 5 planning decisions → A Course;
// CONTEXT.md: Course, Module, Lesson). A Course belongs to one Exam and one of
// that Exam's Subjects, and holds Modules, each holding Lessons in order. The
// Course builder (ticket 01) makes them before any video exists; ticket 02
// adds the video and the other Lesson states.
// ─────────────────────────────────────────────────────────────────────────────

/** How Members get a Course: with their Exam's All-Access, or bought on its own. */
export const COURSE_ACCESS = ["included", "sold-separately"] as const;
export type CourseAccess = (typeof COURSE_ACCESS)[number];

/**
 * A Lesson's state: no video yet, its upload running, VdoCipher processing
 * it, ready but unpublished (draft), published, or its upload failed.
 */
export const LESSON_STATES = [
  "no-video",
  "uploading",
  "processing",
  "draft",
  "published",
  "upload-failed",
] as const;
export type LessonState = (typeof LESSON_STATES)[number];

/**
 * Where "Replace video" is on a Lesson with a ready video: the new video
 * uploading, processing, or its upload failed. The ready one plays meanwhile.
 */
export const LESSON_REPLACEMENT_STATES = ["uploading", "processing", "upload-failed"] as const;
export type LessonReplacementState = (typeof LESSON_REPLACEMENT_STATES)[number];

export interface Course {
  id: string;
  examCode: string;
  subjectCode: string;
  title: string;
  /** Plain text; may be empty. */
  description: string;
  /** The 16:9 cover's public URL, or null: cards then show the Subject block. */
  coverSrc: string | null;
  /** Hidden until it has a Published Lesson and Staff make it Visible. */
  visibility: ContentVisibility;
  /** Only an Owner changes these three (ticket 06); the builder only shows them. */
  access: CourseAccess;
  /** The one-time price in centavos, whole pesos; null until an Owner sets one. */
  priceCentavos: number | null;
  onSale: boolean;
  /** ISO time it was made: the list's order. */
  createdAt: string;
}

export interface CourseModule {
  id: string;
  courseId: string;
  /** Its place in the Course, from 1. */
  position: number;
  title: string;
}

export interface Lesson {
  id: string;
  moduleId: string;
  /** Its place in its Module, from 1. */
  position: number;
  title: string;
  /** Shown under the video: plain text with line breaks; may be empty. */
  notes: string;
  /** Any signed-in Member can watch it. */
  freePreview: boolean;
  state: LessonState;
  /** Its VdoCipher video's id: null only with no video. */
  videoId: string | null;
  /** The video's length in whole seconds, once it's ready (draft or published). */
  videoSeconds: number | null;
  /** "Replace video"'s new video, while it uploads or processes, or if its upload failed; else null. */
  replacementVideoId: string | null;
  replacementState: LessonReplacementState | null;
}

/**
 * Course Ownership (ticket 03; CONTEXT.md: Course Ownership): a Member's
 * permanent right to one Course, from a Paid Order or given by an Owner. It
 * never expires. The access decision opens a separately sold Course with it,
 * and a Hidden Course stays open to its owners. Tickets 06 and 07 make them.
 */
export interface CourseOwnership {
  userId: string;
  courseId: string;
  /** ISO time it began. */
  since: string;
  /** The Paid Order that gave it, or null when an Owner gave it ("Given by Ace Your Course"). */
  orderId: string | null;
}
