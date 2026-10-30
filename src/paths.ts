export const paths = {
  home: "/",
  /** The site's default share image (src/app/opengraph-image.tsx). */
  shareImage: "/opengraph-image",
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
    signIn: "/auth/sign-in",
    signUp: "/auth/sign-up",
    signUpConfirm: "/auth/sign-up-confirm",
    resetPassword: "/auth/reset-password",
    updatePassword: "/auth/update-password",
    callback: "/auth/callback",
  },
  dashboard: {
    overview: "/dashboard",
    blank: "/dashboard/blank",
    customers: {
      list: "/dashboard/customers",
      create: "/dashboard/customers/create",
      details: (customerId: string) => `/dashboard/customers/${customerId}`,
    },
    team: {
      members: "/dashboard/team/members",
      permissions: "/dashboard/team/permissions",
    },
    roleSettings: "/dashboard/role-settings",
    settings: {
      profile: "/dashboard/settings",
      security: "/dashboard/settings/security",
    },
  },
} as const;
