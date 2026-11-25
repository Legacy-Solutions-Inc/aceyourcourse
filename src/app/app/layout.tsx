import type { Metadata } from "next";

import { TestPaymentsStrip } from "@/components/member-app/test-payments-strip";
import { config } from "@/config";
import { requireMemberAppOpen } from "@/lib/member-app/guard";
import { showTestPaymentsStrip } from "@/services/payments";

// Every Member App screen, signed in or not. Search engines never index the
// Member App (robots.ts disallows /app too), and closed mode answers 404 here
// as well as in each page's gate. With PayMongo's test key, every screen is
// headed "TEST PAYMENTS · no real money" (Phase 4, ticket 04; story 151l).
export const metadata: Metadata = {
  title: { template: `%s · ${config.site.name}`, default: `Member App · ${config.site.name}` },
  robots: { index: false, follow: false },
};

export default function MemberAppLayout({ children }: { children: React.ReactNode }) {
  requireMemberAppOpen();
  return (
    <>
      {showTestPaymentsStrip() ? <TestPaymentsStrip /> : null}
      {children}
    </>
  );
}
