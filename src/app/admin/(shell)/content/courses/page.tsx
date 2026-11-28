import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminScreen } from "@/components/admin/admin-screen";
import { CourseBuilder } from "@/components/admin/courses/course-builder";
import { CourseSettings } from "@/components/admin/courses/course-settings";
import { CoursesList } from "@/components/admin/courses/courses-list";
import { LessonEditor } from "@/components/admin/courses/lesson-editor";
import { requireStaff } from "@/lib/admin/guard";
import { paths } from "@/paths";
import { getCourseForAdmin, listCoursesForAdmin } from "@/services/admin";
import { videoService } from "@/services/video";

import {
  addCourse,
  addCourseModule,
  addLesson,
  checkLessonVideoStatus,
  createCourseCoverUpload,
  createLessonUpload,
  moveCourseModuleInCourse,
  moveLessonInModule,
  moveLessonToOtherModule,
  previewLesson,
  removeCourse,
  removeCourseModule,
  removeLesson,
  saveCourse,
  saveCourseModuleTitle,
  saveCourseVisibility,
  saveLesson,
  saveLessonPublished,
  saveLessonUploadOutcome,
} from "./actions";

export const metadata: Metadata = { title: "Courses & videos" };

interface CoursesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const param = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

/** Where the page is, for signing in and coming back to it. */
function hereOf(course: string | undefined, view: string | undefined, lesson: string | undefined) {
  if (!course) return paths.admin.courses;
  if (course === "new") return paths.admin.newCourse;
  if (lesson) return paths.admin.course(course, { lesson });
  return paths.admin.course(course, view === "settings" ? { settings: true } : undefined);
}

/**
 * Courses & videos, for any Staff User (Phase 5, tickets 01 and 02; BUILD-MAP §3.7),
 * read fresh on every request: the Courses list, and beside it the Course
 * picked (`course`): its Modules and Lessons, its settings (`view=settings`),
 * or one Lesson in the Lesson editor (`lesson`); "new" opens a new Course's
 * settings. A Course that isn't there answers 404; a Lesson that isn't in it
 * opens the builder.
 */
export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const query = await searchParams;
  const courseId = param(query.course);
  const view = param(query.view);
  const lessonId = param(query.lesson);
  const actor = await requireStaff(hereOf(courseId, view, lessonId));
  const list = await listCoursesForAdmin(actor);
  const settingsActions = {
    createCourseCoverUpload,
    addCourse,
    saveCourse,
    saveCourseVisibility,
    removeCourse,
  };

  let body: React.ReactNode;
  if (courseId === "new") {
    body = <CourseSettings opened={null} exams={list.exams} actions={settingsActions} />;
  } else if (courseId) {
    const opened = await getCourseForAdmin(actor, courseId);
    if (!opened) notFound();
    const lessonModule = opened.modules.find((candidate) =>
      candidate.lessons.some((lesson) => lesson.id === lessonId),
    );
    const lesson = lessonModule?.lessons.find((candidate) => candidate.id === lessonId);
    if (lessonModule && lesson) {
      body = (
        <LessonEditor
          key={`${lesson.id}:${lesson.stamp.savedAt}:${lesson.state}`}
          course={{ id: opened.course.id, title: opened.course.title }}
          moduleTitle={lessonModule.title}
          lesson={lesson}
          video={{ connected: videoService() !== null, watermark: actor.email }}
          actions={{
            saveLesson,
            saveLessonPublished,
            removeLesson,
            createLessonUpload,
            saveLessonUploadOutcome,
            checkLessonVideoStatus,
            previewLesson,
          }}
        />
      );
    } else if (view === "settings") {
      body = (
        <CourseSettings
          key={opened.stamp.savedAt}
          opened={opened}
          exams={opened.exams}
          actions={settingsActions}
        />
      );
    } else {
      body = (
        <CourseBuilder
          opened={opened}
          actions={{
            addCourseModule,
            saveCourseModuleTitle,
            moveCourseModuleInCourse,
            removeCourseModule,
            addLesson,
            moveLessonInModule,
            moveLessonToOtherModule,
          }}
        />
      );
    }
  } else {
    body = (
      <p className="border border-dashed border-ayc-rule p-3.5 text-sm text-muted-foreground">
        Pick a Course to build its Modules and Lessons, or add a new one.
      </p>
    );
  }

  return (
    <AdminScreen screen="courses">
      <div className="grid min-w-0 items-start gap-4 wide:grid-cols-[minmax(220px,280px)_1fr]">
        <CoursesList courses={list.courses} selected={courseId ?? null} />
        <div className="min-w-0">{body}</div>
      </div>
    </AdminScreen>
  );
}
