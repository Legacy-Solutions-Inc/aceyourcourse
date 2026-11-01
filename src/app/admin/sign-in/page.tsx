import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthScreen } from "@/components/admin/auth-screen";
import { SignInAsPanel } from "@/components/admin/sign-in-as-panel";
import { BrandLogo } from "@/components/website/brand-logo";
import { config } from "@/config";
import { getStaff } from "@/lib/admin/guard";
import { listSampleUsers } from "@/lib/admin/identity";
import { safeAdminNext } from "@/lib/admin/safe-next";

import { signInAs } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

interface SignInPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

/** "Sign in to manage the site" (mockup 883–893). Staff already signed in go straight on. */
export default async function SignInPage({ searchParams }: SignInPageProps) {
  const next = safeAdminNext((await searchParams).next);
  if (await getStaff()) redirect(next);

  return (
    <AuthScreen tone="sign-in">
      {/* Its own box, so the column doesn't stretch the logo across the card. */}
      <span className="self-start">
        <BrandLogo alt={config.site.name} priority />
      </span>
      <p className="mt-1.5 font-mono text-[11px] font-bold tracking-[0.08em] text-ayc-blue">
        ADMIN DASHBOARD
      </p>
      <h1 className="text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em]">
        Sign in to manage the site
      </h1>
      <p className="text-[15px] leading-normal">
        Only Google accounts on the admin list can open the dashboard.
      </p>
      <SignInAsPanel users={listSampleUsers()} next={next} action={signInAs} />
    </AuthScreen>
  );
}
