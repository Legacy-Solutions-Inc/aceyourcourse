import type { SignInProblem } from "@/lib/admin/sign-in-problem";
import type { DeniedScreenReason } from "@/services/admin.types";
import type { ContentKind } from "@/services/content.types";

/** An Exam and Subject as an address names them: their codes, in lower case. */
const subjectQuery = (examCode: string, subjectCode: string) =>
  new URLSearchParams({
    exam: examCode.toLowerCase(),
    subject: subjectCode.toLowerCase(),
  }).toString();

export const paths = {
  home: "/",
  /** The site's default share image (src/app/opengraph-image.tsx). */
  shareImage: "/opengraph-image",
  /** The brand mark as a 512 × 512 PNG (src/app/icon.tsx). */
  icon: "/icon",
  products: {
    list: "/products",
    details: (slug: string) => `/products/${slug}`,
  },
  exams: {
    details: (code: string) => `/exams/${code.toLowerCase()}`,
  },
  reviews: "/reviews",
  faq: "/faq",
  about: "/about",
  legal: {
    privacy: "/legal/privacy",
    terms: "/legal/terms",
  },
  /** The signed-in Member App (Phase 3). */
  memberApp: {
    home: "/app",
    /**
     * The sign-in screen; `next` is where to go afterwards (an /app path
     * only), and `error` why the last sign-in didn't go on.
     */
    signIn: (next?: string, error?: SignInProblem) => {
      const query = new URLSearchParams();
      if (next) query.set("next", next);
      if (error) query.set("error", error);
      const search = query.toString();
      return search ? `/app/sign-in?${search}` : "/app/sign-in";
    },
    /** "Not open yet": signed in, but not let in while the Member App switch is off. */
    notOpenYet: "/app/not-open-yet",
    /**
     * The consent screen, before any other Member App screen until the Member
     * agrees to the current Terms and Privacy Policy; `next` is where to go
     * afterwards (an /app path only). `outdated` says a document changed
     * while the screen was open, so it shows the current version.
     */
    consent: (next?: string, { outdated = false }: { outdated?: boolean } = {}) => {
      const query = new URLSearchParams();
      if (next) query.set("next", next);
      if (outdated) query.set("outdated", "1");
      const search = query.toString();
      return search ? `/app/consent?${search}` : "/app/consent";
    },
    /**
     * The Active Device screen, for a request that isn't from the Member's
     * Active Device: "Session ended" for a replaced device, "Use the Member
     * App on this device" for a session with no device token. `next` is where
     * to go once this device is active (an /app path only), and `error` why
     * the last "Sign in on this device" didn't go on.
     */
    device: (next?: string, error?: SignInProblem) => {
      const query = new URLSearchParams();
      if (next) query.set("next", next);
      if (error) query.set("error", error);
      const search = query.toString();
      return search ? `/app/device?${search}` : "/app/device";
    },
    /** The add form for another Target Exam, opened from the exam switcher and Account. */
    addExam: "/app/add-exam",
    /** Home, saying a Target Exam the Member removed earlier is back. */
    examRestored: (examCode: string) => `/app?restored=${encodeURIComponent(examCode)}`,
    library: "/app/library",
    /** The Library open on one of the selected Target Exam's Subjects. */
    librarySubject: (subjectCode: string) =>
      `/app/library?subject=${encodeURIComponent(subjectCode)}`,
    /** One deck, quiz or Reviewer PDF: opening it runs the access decision. */
    content: (kind: ContentKind, id: string) => `/app/library/${kind}/${encodeURIComponent(id)}`,
    /** One of the Member's past attempts at a quiz, reviewed on the quiz's page (ticket 11). */
    quizAttempt: (quizId: string, attemptId: string) =>
      `/app/library/quiz/${encodeURIComponent(quizId)}?attempt=${encodeURIComponent(attemptId)}`,
    /**
     * A card image's signed URL in the sample data (ticket 08): served by a
     * development-only route until it expires, standing in for Storage's.
     */
    sampleCardImage: (token: string) => `/api/dev/card-images/${encodeURIComponent(token)}`,
    courses: "/app/courses",
    plans: "/app/plans",
    billing: "/app/billing",
    account: "/app/account",
    support: "/app/support",
  },
  auth: {
    /** The OAuth callback: Google sign-in comes back here, then goes on to `next`. */
    callback: "/auth/callback",
  },
  /** The staff-only Admin (CONVENTIONS §2). */
  admin: {
    overview: "/admin",
    /**
     * The sign-in screen; `next` is where to go afterwards (an /admin path
     * only), and `error` why the last sign-in didn't go on.
     */
    signIn: (next?: string, error?: SignInProblem) => {
      const query = new URLSearchParams();
      if (next) query.set("next", next);
      if (error) query.set("error", error);
      const search = query.toString();
      return search ? `/admin/sign-in?${search}` : "/admin/sign-in";
    },
    /** The 403 screen, saying why. */
    denied: (reason?: DeniedScreenReason) =>
      reason ? `/admin/denied?reason=${reason}` : "/admin/denied",
    examPages: "/admin/exam-pages",
    products: "/admin/products",
    reviews: "/admin/reviews",
    settings: "/admin/settings",
    /** Users (Owners only): the Beta Testers tab for now; the rest comes with ticket 16. */
    users: "/admin/users",
    /** Member App content (Phase 3): each Subject's Topics, picked by Exam and Subject. */
    content: "/admin/content",
    /** Member App content open on one Subject's Topics list. */
    contentTopics: (examCode: string, subjectCode: string) =>
      `/admin/content?${subjectQuery(examCode, subjectCode)}`,
    /** A Subject's card import (ticket 06): choose a CSV and zip, check them, import. */
    cardImport: (examCode: string, subjectCode: string) =>
      `/admin/content/import?${subjectQuery(examCode, subjectCode)}`,
    /** A Subject's quiz import (ticket 09): the same screen, for quiz questions. */
    quizImport: (examCode: string, subjectCode: string) =>
      `/admin/content/import?${subjectQuery(examCode, subjectCode)}&kind=quizzes`,
    /** The card import's template CSV, downloaded (Staff only). */
    cardImportTemplate: "/admin/content/import/template",
    /** The quiz import's template CSV, downloaded (Staff only). */
    quizImportTemplate: "/admin/content/import/quiz-template",
    /** The zip of the templates' example image, downloaded (Staff only). */
    importExampleImages: "/admin/content/import/example-images",
    /**
     * A Topic's deck in the card editor (ticket 07), with one card open in the
     * form, or "new" for a new card.
     */
    deck: (topicId: string, card?: string) =>
      `/admin/content/deck?topic=${encodeURIComponent(topicId)}${
        card ? `&card=${encodeURIComponent(card)}` : ""
      }`,
    /** A card's back image, from the private content bucket (Staff only). */
    cardImage: (cardId: string) => `/admin/content/deck/image/${encodeURIComponent(cardId)}`,
    /**
     * A Topic's quiz (ticket 09): its settings and questions, with one
     * question open in the question editor's form (ticket 10), or "new".
     */
    quiz: (topicId: string, question?: string) =>
      `/admin/content/quiz?topic=${encodeURIComponent(topicId)}${
        question ? `&question=${encodeURIComponent(question)}` : ""
      }`,
    /** A question's figure, from the private content bucket (Staff only). */
    questionFigure: (questionId: string) =>
      `/admin/content/quiz/figure/${encodeURIComponent(questionId)}`,
    /** Development-only: POST resets the sample data; 404 unless the Admin runs on it. */
    resetSampleData: "/api/dev/sample-data/reset",
    /**
     * Development-only: an upload in the sample arm of the upload seam. PUT
     * (with its one-time token) sends the file, GET serves it; 404 unless the
     * Admin runs on sample data.
     */
    sampleUpload: (id: string) => `/api/dev/uploads/${id}`,
    /** Member App content: the Reviewer PDFs, their uploads and progress (ticket 12). */
    reviewerPdfs: "/admin/content/reviewer-pdfs",
  },
  /**
   * The Reviewer PDF job's endpoints (ticket 12), for the server itself and
   * Vercel Cron only: each needs `Authorization: Bearer <CRON_SECRET>`, and
   * answers 404 when the server has none.
   */
  jobs: {
    /** POST {id}: one run of a Reviewer PDF's job, which starts the next. */
    reviewerPdfRun: "/api/reviewer-pdfs/run",
    /** GET, every minute (vercel.json): restarts the jobs whose runs have stopped. */
    reviewerPdfCron: "/api/reviewer-pdfs/cron",
  },
} as const;
