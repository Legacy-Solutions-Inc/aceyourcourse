import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthScreen } from "@/components/admin/auth-screen";
import { GoogleSignInForm } from "@/components/admin/google-sign-in-form";
import { PasswordSignInForm } from "@/components/admin/password-sign-in-form";
import { SignInAsPanel } from "@/components/admin/sign-in-as-panel";
import { BrandLogo } from "@/components/website/brand-logo";
import { config } from "@/config";
import { getStaff } from "@/lib/admin/guard";
import {
  listSampleUsers,
  passwordSignInOffered,
  passwordSignInPurpose,
} from "@/lib/admin/identity";
import { adminMode } from "@/lib/admin/mode";
import { safeAdminNext } from "@/lib/admin/safe-next";
import { parseSignInProblem, SIGN_IN_PROBLEMS } from "@/lib/admin/sign-in-problem";

import { continueWithGoogle, signInAs, signInWithPassword } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

interface SignInPageProps {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}

/**
 * "Sign in to manage the site" (mockup 883–893). Staff already signed in go
 * straight on. "Continue with Google" goes to Google in live mode, and opens
 * the "Sign in as" list in sample mode. In live mode, under `pnpm dev` (headed
 * "Development only", ticket 19) or with ADMIN_PASSWORD_SIGN_IN "true" (headed
 * "Testing only", ticket 24), while Supabase has Email on, the password box
 * sits under it (not in the mockup). `error` says why the last sign-in didn't go
 * on. It only reads: signing in happens in /auth/callback (Google), the
 * password box's action, or the Sign in as action (sample).
 */
export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const next = safeAdminNext(params.next);
  if (await getStaff()) redirect(next);
  const problem = parseSignInProblem(params.error);
  const passwordBox = await passwordSignInOffered();

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
      {problem ? (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {SIGN_IN_PROBLEMS[problem]}
        </p>
      ) : null}
      {adminMode === "live" ? (
        <>
          <GoogleSignInForm next={next} action={continueWithGoogle} />
          {passwordBox ? (
            <PasswordSignInForm
              next={next}
              purpose={passwordSignInPurpose()}
              action={signInWithPassword}
            />
          ) : null}
        </>
      ) : (
        <SignInAsPanel users={listSampleUsers()} next={next} action={signInAs} />
      )}
    </AuthScreen>
  );
}
