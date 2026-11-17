import type { Metadata } from "next";

import { config } from "@/config";
import { requireMemberAppOpen } from "@/lib/member-app/guard";

// Every Member App screen, signed in or not. Search engines never index the
// Member App (robots.ts disallows /app too), and closed mode answers 404 here
// as well as in each page's gate.
export const metadata: Metadata = {
  title: { template: `%s · ${config.site.name}`, default: `Member App · ${config.site.name}` },
  robots: { index: false, follow: false },
};

export default function MemberAppLayout({ children }: { children: React.ReactNode }) {
  requireMemberAppOpen();
  return children;
}
