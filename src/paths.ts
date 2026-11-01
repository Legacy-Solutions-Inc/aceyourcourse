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
  memberApp: {
    home: "/app",
    plans: "/app/plans",
  },
  auth: {
    /** The OAuth callback, kept for Phase 2's Google sign-in. */
    callback: "/auth/callback",
  },
  /** The staff-only Admin (CONVENTIONS §2). */
  admin: {
    overview: "/admin",
    /** The sign-in screen; `next` is where to go afterwards (an /admin path only). */
    signIn: (next?: string) =>
      next ? `/admin/sign-in?next=${encodeURIComponent(next)}` : "/admin/sign-in",
    /** The 403 screen, saying why. */
    denied: (reason?: DeniedScreenReason) =>
      reason ? `/admin/denied?reason=${reason}` : "/admin/denied",
    examPages: "/admin/exam-pages",
    products: "/admin/products",
    reviews: "/admin/reviews",
    settings: "/admin/settings",
    /** Development-only: POST resets the sample data; 404 unless the Admin runs on it. */
    resetSampleData: "/api/dev/sample-data/reset",
  },
} as const;
