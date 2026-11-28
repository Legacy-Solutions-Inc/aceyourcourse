import type { CatalogueSeed } from "@/services/catalogue.schema";
import type { Course, CourseModule, Lesson } from "@/services/courses.types";

import { stableUuid } from "./stable-uuid";

// ─────────────────────────────────────────────────────────────────────────────
// The sample video Courses (Phase 5, tickets 01 and 02; spec, Phase 5
// planning decisions → Sample data): three CE Courses with Modules and
// Lessons. Every Lesson has a ready (fake) video with a made-up length and is
// Published, so every Course is Visible.
// One is Included in CE All-Access; two are sold separately, one on sale at
// ₱1,499 and one not on sale, with no price yet. The ids are made from names, so they're the same on
// every restart and in the database seed.
// ─────────────────────────────────────────────────────────────────────────────

interface SampleLesson {
  title: string;
  notes?: string;
  freePreview?: boolean;
}

interface SampleCourse {
  title: string;
  examCode: string;
  subjectCode: string;
  description: string;
  access: Course["access"];
  priceCentavos: number | null;
  onSale: boolean;
  modules: { title: string; lessons: SampleLesson[] }[];
}

const SAMPLE_COURSES: readonly SampleCourse[] = [
  {
    title: "Surveying & Curves Lectures",
    examCode: "CE",
    subjectCode: "MSTC",
    description: "Recorded lectures on surveying and horizontal curves, worked problem by problem.",
    access: "included",
    priceCentavos: null,
    onSale: false,
    modules: [
      {
        title: "Surveying basics",
        lessons: [
          { title: "Distance and leveling", notes: "Taping corrections.\nDifferential leveling." },
          { title: "Traverse computations" },
          { title: "Areas and volumes" },
        ],
      },
      {
        title: "Horizontal curves",
        lessons: [
          {
            title: "Simple curves",
            notes: "Degree of curve, tangent distance and the long chord.",
            freePreview: true,
          },
          { title: "Compound and reverse curves" },
        ],
      },
    ],
  },
  {
    title: "PSAD Masterclass",
    examCode: "CE",
    subjectCode: "PSAD",
    description: "Structural design from loads to details, in reinforced concrete and steel.",
    access: "sold-separately",
    priceCentavos: 149_900,
    onSale: true,
    modules: [
      {
        title: "Reinforced concrete",
        lessons: [{ title: "Beams in flexure" }, { title: "Shear and torsion" }],
      },
      { title: "Steel design", lessons: [{ title: "Tension members" }] },
    ],
  },
  {
    title: "HPGE Crash Course",
    examCode: "CE",
    subjectCode: "HPGE",
    description: "Hydraulics and geotechnical engineering, the formulas that come up most.",
    access: "sold-separately",
    // Switched to Sold separately, with no price yet, so not on sale.
    priceCentavos: null,
    onSale: false,
    modules: [
      {
        title: "Hydraulics",
        lessons: [{ title: "Fluid properties" }, { title: "Hydrostatic forces" }],
      },
      { title: "Geotechnical", lessons: [{ title: "Soil classification" }] },
    ],
  },
];

/** The sample Courses were made in this order, a minute apart. */
const MADE_FROM = Date.UTC(2026, 10, 28, 0, 0);

/** Pure: the nth sample Lesson's fake video id (the video fake plays any id). */
export const sampleVideoId = (n: number) => `sample-video-${String(n).padStart(2, "0")}`;

/** Pure: the nth sample Lesson's made-up length: between 8 and 23 minutes. */
const sampleVideoSeconds = (n: number) => 480 + ((n * 263) % 900);

/** Pure: a sample Course's id, from its title. */
export const sampleCourseId = (title: string) => stableUuid(`course:${title}`);

/** Pure: a sample Module's id, from its Course's title and its own. */
export const sampleModuleId = (course: string, module: string) =>
  stableUuid(`course-module:${course}:${module}`);

/** Pure: a sample Lesson's id, from its Course's, its Module's and its own title. */
export const sampleLessonId = (course: string, module: string, lesson: string) =>
  stableUuid(`lesson:${course}:${module}:${lesson}`);

/** The sample Courses whose Exam and Subject the catalogue has, with their Modules and Lessons. */
export function sampleCourses(catalogue: CatalogueSeed): {
  courses: Course[];
  courseModules: CourseModule[];
  lessons: Lesson[];
} {
  const courses: Course[] = [];
  const courseModules: CourseModule[] = [];
  const lessons: Lesson[] = [];
  SAMPLE_COURSES.forEach((sample, index) => {
    const exam = catalogue.exams.find((candidate) => candidate.code === sample.examCode);
    if (!exam?.subjects.some((subject) => subject.code === sample.subjectCode)) return;
    const id = sampleCourseId(sample.title);
    courses.push({
      id,
      examCode: sample.examCode,
      subjectCode: sample.subjectCode,
      title: sample.title,
      description: sample.description,
      coverSrc: null,
      visibility: "visible",
      access: sample.access,
      priceCentavos: sample.priceCentavos,
      onSale: sample.onSale,
      createdAt: new Date(MADE_FROM + index * 60_000).toISOString(),
    });
    sample.modules.forEach((module, moduleIndex) => {
      const moduleId = sampleModuleId(sample.title, module.title);
      courseModules.push({
        id: moduleId,
        courseId: id,
        position: moduleIndex + 1,
        title: module.title,
      });
      module.lessons.forEach((lesson, lessonIndex) => {
        lessons.push({
          id: sampleLessonId(sample.title, module.title, lesson.title),
          moduleId,
          position: lessonIndex + 1,
          title: lesson.title,
          notes: lesson.notes ?? "",
          freePreview: lesson.freePreview ?? false,
          state: "published",
          videoId: sampleVideoId(lessons.length + 1),
          videoSeconds: sampleVideoSeconds(lessons.length + 1),
          replacementVideoId: null,
          replacementState: null,
        });
      });
    });
  });
  return { courses, courseModules, lessons };
}
