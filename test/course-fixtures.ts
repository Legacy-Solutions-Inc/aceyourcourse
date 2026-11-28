import type {
  AdminCourse,
  AdminCourseModule,
  AdminLesson,
  CourseExamChoice,
} from "@/services/admin.types";
import type { Course } from "@/services/courses.types";

// A Course as the Course builder's screens get it (Phase 5, ticket 01): PSAD
// Masterclass, sold separately at ₱1,499, with two Modules, for the component
// tests.

export const OPENED = { savedAt: "2026-11-28T03:42:00.000Z", savedBy: null };

export const EXAMS: CourseExamChoice[] = [
  {
    code: "CE",
    name: "Civil Engineering",
    subjects: [
      { code: "MSTC", name: "Mathematics, Surveying & Transportation Engineering" },
      { code: "HPGE", name: "Hydraulics & Geotechnical Engineering" },
      { code: "PSAD", name: "Structural Design & Construction" },
    ],
  },
  {
    code: "CHE",
    name: "Chemical Engineering",
    subjects: [
      { code: "PCHEM", name: "Physical Chemistry" },
      { code: "THERMO", name: "Thermodynamics" },
    ],
  },
];

export const COURSE: Course = {
  id: "c0000000-0000-4000-8000-000000000001",
  examCode: "CE",
  subjectCode: "PSAD",
  title: "PSAD Masterclass",
  description: "Loads to details.",
  coverSrc: null,
  visibility: "hidden",
  access: "sold-separately",
  priceCentavos: 149_900,
  onSale: true,
  createdAt: "2026-11-28T00:00:00.000Z",
};

export const lesson = (
  id: string,
  moduleId: string,
  position: number,
  title: string,
  fields: Partial<AdminLesson> = {},
): AdminLesson => ({
  id,
  moduleId,
  position,
  title,
  notes: "",
  freePreview: false,
  state: "no-video",
  videoId: null,
  videoSeconds: null,
  replacementVideoId: null,
  replacementState: null,
  stamp: OPENED,
  savedPositions: 0,
  ...fields,
});

export const CONCRETE: AdminCourseModule = {
  id: "d0000000-0000-4000-8000-000000000001",
  position: 1,
  title: "Reinforced concrete",
  stamp: OPENED,
  lessons: [
    lesson(
      "e0000000-0000-4000-8000-000000000001",
      "d0000000-0000-4000-8000-000000000001",
      1,
      "Beams in flexure",
      { freePreview: true },
    ),
    lesson(
      "e0000000-0000-4000-8000-000000000002",
      "d0000000-0000-4000-8000-000000000001",
      2,
      "Shear and torsion",
    ),
  ],
};

export const STEEL: AdminCourseModule = {
  id: "d0000000-0000-4000-8000-000000000002",
  position: 2,
  title: "Steel design",
  stamp: OPENED,
  lessons: [],
};

export const OPENED_COURSE: AdminCourse = {
  course: COURSE,
  exam: { code: "CE", name: "Civil Engineering" },
  subject: { code: "PSAD", name: "Structural Design & Construction" },
  stamp: OPENED,
  modules: [CONCRETE, STEEL],
  exams: EXAMS,
  accessChange: { losing: 0, gaining: 0 },
  deleteBlocked: null,
};
