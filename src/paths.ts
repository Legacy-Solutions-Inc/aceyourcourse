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
    /** The Terms of Use's "Payments and refunds" section, at its stable anchor (since v2.1). */
    paymentsAndRefunds: "/legal/terms#payments-and-refunds",
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
    /**
     * One page of a Reviewer PDF, stamped for the signed-in Member (ticket
     * 14): the protected page endpoint, which runs the access decision on
     * every request. `retry` counts the Member's Try agains, each a new request.
     */
    reviewerPage: (id: string, page: number, retry = 0) =>
      `/app/reviewer-pdfs/${encodeURIComponent(id)}/pages/${page}${retry > 0 ? `?retry=${retry}` : ""}`,
    /** One of the Member's past attempts at a quiz, reviewed on the quiz's page (ticket 11). */
    quizAttempt: (quizId: string, attemptId: string) =>
      `/app/library/quiz/${encodeURIComponent(quizId)}?attempt=${encodeURIComponent(attemptId)}`,
    /**
     * A card image's signed URL in the sample data (ticket 08): served by a
     * development-only route until it expires, standing in for Storage's.
     */
    sampleCardImage: (token: string) => `/api/dev/card-images/${encodeURIComponent(token)}`,
    /** The Courses screen (Phase 5, ticket 03): the selected Target Exam's video Courses. */
    courses: "/app/courses",
    /** One Course's page: its Modules and Lessons. Opening it runs the access decision. */
    course: (id: string) => `/app/courses/${encodeURIComponent(id)}`,
    /** One Lesson's screen, in its Course: the player runs the access decision first. */
    lesson: (courseId: string, lessonId: string) =>
      `/app/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`,
    plans: "/app/plans",
    /** Plans open on one Exam's (ticket 02): where a lock's "See plans" and "Renew access" lead. */
    plansFor: (examCode: string) => `/app/plans?exam=${encodeURIComponent(examCode)}`,
    /**
     * Plans open on one Exam's at a One-time purchase, picked (Phase 5,
     * ticket 06): where a locked Course's "Unlock for ₱1,499" leads.
     */
    plansForCourse: (examCode: string, courseId: string) =>
      `/app/plans?exam=${encodeURIComponent(examCode)}&course=${encodeURIComponent(courseId)}#course-${encodeURIComponent(courseId)}`,
    /** Where PayMongo's Cancel returns to (ticket 04): Plans for the Exam, saying nothing was charged. */
    plansCancelled: (examCode: string) =>
      `/app/plans?exam=${encodeURIComponent(examCode)}&payment=cancelled`,
    /** One of the Member's Orders (ticket 03): Confirming payment, then Paid or Failed. */
    order: (reference: string) => `/app/plans/orders/${encodeURIComponent(reference)}`,
    billing: "/app/billing",
    /** One of the Member's Paid Orders' Payment Acknowledgement (Phase 4, ticket 06). */
    acknowledgement: (reference: string) => `/app/billing/${encodeURIComponent(reference)}`,
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
    /**
     * Staff Activity (Owners only; Phase 4, ticket 15), under Settings, with
     * its filters and cursor in the search params
     * (src/lib/admin/staff-activity-view.ts).
     */
    staffActivity: "/admin/settings/activity",
    /**
     * Users (Owners only): the Users list (ticket 16), with its search, filter
     * and page in the search params (src/lib/admin/users-list.ts).
     */
    users: "/admin/users",
    /** The Users screen's Beta Testers tab (ticket 01). */
    betaTesters: "/admin/users?tab=beta-testers",
    /** The Users screen's Privacy Requests tab (ticket 18): what Members asked for from Account. */
    privacyRequests: "/admin/users?tab=privacy-requests",
    /** A Member's detail page in Users, by their User id (ticket 16). */
    user: (userId: string) => `/admin/users/${encodeURIComponent(userId)}`,
    /** One Privacy Request's screen, where an Owner carries it out (ticket 19). */
    privacyRequest: (id: string) => `/admin/users/privacy-requests/${encodeURIComponent(id)}`,
    /** A data-copy request's file: "Download this Member's data" posts here (ticket 19). */
    privacyRequestData: (id: string) =>
      `/admin/users/privacy-requests/${encodeURIComponent(id)}/data`,
    /**
     * Plans & prices (Owners only; Phase 4, ticket 01), with the Exam chip
     * and the selected Plan in the search params (src/lib/admin/plan-view.ts).
     */
    plans: "/admin/plans",
    /**
     * Orders & payments (Owners only; Phase 4, ticket 07), with the search and
     * filters in the search params (src/lib/admin/orders-list.ts).
     */
    orders: "/admin/orders",
    /** One Order's detail page, by its reference ("AYC-10482"). */
    order: (reference: string) => `/admin/orders/${encodeURIComponent(reference)}`,
    /** The Orders list's CSV export, with the list's filters in the search params. */
    ordersExport: "/admin/orders/export",
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
    /** Courses & videos (Phase 5, ticket 01): the Courses list, and the Course builder. */
    courses: "/admin/content/courses",
    /** "+ New course": the list, with a new Course's settings. */
    newCourse: "/admin/content/courses?course=new",
    /**
     * One Course in the builder: its Modules and Lessons, or its settings, or
     * one Lesson in the Lesson editor.
     */
    course: (id: string, open?: { settings?: true } | { lesson: string }) =>
      `/admin/content/courses?course=${encodeURIComponent(id)}${
        open === undefined
          ? ""
          : "lesson" in open
            ? `&lesson=${encodeURIComponent(open.lesson)}`
            : "&view=settings"
      }`,
    /** Member App content: the Reviewer PDFs, their uploads and progress (ticket 12). */
    reviewerPdfs: "/admin/content/reviewer-pdfs",
    /** One Reviewer PDF (ticket 13): its preview, placement, Free Preview and status. */
    reviewerPdf: (id: string) => `/admin/content/reviewer-pdfs/${encodeURIComponent(id)}`,
    /** One of a Reviewer PDF's clean page images, for its preview (Staff only, never cached). */
    reviewerPdfPage: (id: string, page: number) =>
      `/admin/content/reviewer-pdfs/${encodeURIComponent(id)}/pages/${page}`,
  },
  /**
   * The Reviewer PDF job's endpoints (ticket 12), for the server itself and
   * Vercel Cron only: each needs `Authorization: Bearer <CRON_SECRET>`, and
   * answers 404 when the server has none.
   */
  jobs: {
    /** POST {id}: one run of a Reviewer PDF's job, which starts the next. */
    reviewerPdfRun: "/api/reviewer-pdfs/run",
    /** GET, once a day (vercel.json): restarts the jobs whose runs have stopped. */
    reviewerPdfCron: "/api/reviewer-pdfs/cron",
    /** GET, once a day (vercel.json): records overdue Pending Orders Expired, or Paid (ticket 05). */
    orderExpirySweep: "/api/paymongo/expiry-sweep",
    /** POST: PayMongo's webhook events (ticket 05). */
    payMongoWebhook: "/api/paymongo/webhook",
  },
} as const;
