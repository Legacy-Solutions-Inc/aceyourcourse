import type { SignInProblem } from "@/lib/admin/sign-in-problem";
import type { DeniedScreenReason } from "@/services/admin.types";

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
    /** Development-only: POST resets the sample data; 404 unless the Admin runs on it. */
    resetSampleData: "/api/dev/sample-data/reset",
    /**
     * Development-only: an upload in the sample arm of the upload seam. PUT
     * (with its one-time token) sends the file, GET serves it; 404 unless the
     * Admin runs on sample data.
     */
    sampleUpload: (id: string) => `/api/dev/uploads/${id}`,
  },
} as const;
