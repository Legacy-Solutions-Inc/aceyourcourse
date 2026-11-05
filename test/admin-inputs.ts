import { newFaqForm } from "@/lib/admin/faq-form";
import { newProductForm } from "@/lib/admin/product-form";
import { newReviewForm } from "@/lib/admin/review-form";
import type { InviteStaffInput, NewExamForm } from "@/services/admin.schema";
import type { StaffActor } from "@/services/admin.types";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import { SAMPLE_USERS, type SampleUserKey } from "@/services/mock/staff";

// The sample Users (CONVENTIONS §5), and inputs the sample data saves, shared
// by the Admin-wide checks: the permission matrix, which sends them to the
// Server Actions, and the Staff Activity coverage test, which sends them to
// the seam.

function sampleUser(key: SampleUserKey) {
  const user = SAMPLE_USERS.find((candidate) => candidate.key === key);
  if (!user) throw new Error(`No sample User "${key}"`);
  return user;
}

/** A sample User's email. */
export const sampleEmail = (key: SampleUserKey): string => sampleUser(key).email;

/** The sample Owner or Editor, as the Staff User the sample data starts them as. */
export function sampleActor(key: "owner" | "editor"): StaffActor {
  const { email, name } = sampleUser(key);
  return { email, name, role: key };
}

/** Inputs that save on the seed, and change what they save. */
export const SAVES = {
  contactEmail: "hello@aceyourcourse.ph",
  invite: { email: "new.editor@example.com", role: "editor" } satisfies InviteStaffInput,
  /** A Coming Soon Product, which needs no photo. */
  newProduct: {
    ...newProductForm("MT"),
    title: "MT Notebook",
    shortName: "MT Notebook",
    size: "A5",
    subjectCodes: ["HEMA"],
    comingSoon: true,
  },
  /** prd-001's new price; the seed's is ₱1,200. */
  priceFrom: "1,250",
  newReview: { ...newReviewForm("prd-001"), text: "Sulit!" },
  newFaq: { ...newFaqForm("buying"), question: "Can I pay by GCash?", answer: "Yes." },
  examBlurb: "Every CE formula.",
  bundleHeadline: "The CE bundle",
  seoTitle: "CE Board Exam Reviewer",
  officialExamDate: "2027-04-24",
  bannerButtonLabel: "Shop now",
};

/**
 * An Exam with two Subjects that no Product uses yet, as "+ Add exam" sends
 * it. The seed's every Exam and Subject has Products, so the deletes need one.
 */
export const UNUSED_EXAM = {
  code: "CHE",
  board: "CHELE",
  name: "Chemical Engineering",
  longName: "Chemical Engineer Licensure Exam",
  blurb: "Every ChE formula.",
  madeFor: "ChE reviewees",
  subjects: [
    { code: "PCHEM", name: "Physical Chemistry" },
    { code: "THERMO", name: "Thermodynamics" },
  ],
} satisfies NewExamForm;

/** Adds UNUSED_EXAM to an edited seed, for editSampleCatalogue or an arm's reset. */
export function withUnusedExam(seed: CatalogueSeed): void {
  seed.exams.push(structuredClone(UNUSED_EXAM));
}
