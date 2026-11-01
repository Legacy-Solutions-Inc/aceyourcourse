import type { Metadata } from "next";

import { config } from "@/config";
import { requireAdminOpen } from "@/lib/admin/guard";

// Every Admin screen, signed in or not. Search engines never index the Admin
// (robots.ts disallows /admin too), and closed mode answers 404 here as well as
// in each page's Staff Guard.
export const metadata: Metadata = {
  title: { template: `%s · Admin · ${config.site.name}`, default: `Admin · ${config.site.name}` },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  requireAdminOpen();
  return children;
}
