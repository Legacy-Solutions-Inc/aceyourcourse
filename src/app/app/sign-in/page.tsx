import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GoogleSignInForm } from "@/components/admin/google-sign-in-form";
import { SignInAsPanel } from "@/components/admin/sign-in-as-panel";
import { BrandLogo } from "@/components/website/brand-logo";
import { config } from "@/config";
import { listSampleMembers } from "@/lib/admin/identity";
import { adminMode } from "@/lib/admin/mode";
import { parseSignInProblem } from "@/lib/admin/sign-in-problem";
import { getMemberAppAccess } from "@/lib/member-app/guard";
import { safeMemberAppNext } from "@/lib/member-app/safe-next";
import { MEMBER_SIGN_IN_PROBLEMS } from "@/lib/member-app/sign-in-problem";
import { paths } from "@/paths";

import { continueWithGoogle, signInAs } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

interface SignInPageProps {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}

const SELLING_POINTS = [
  "Flashcards, quizzes, and reviewers by subject and topic",
  "Video courses that resume where you left off",
  "A countdown to your board exam date",
];

/**
 * The Member App's sign-in screen (mockup L13–37; BUILD-MAP §3): Google only.
 * Someone already signed in goes straight on: to `next` when the gate lets
 * them in, or to "Not open yet". "Continue with Google" goes to Google in
 * live mode, and opens the development-only "Sign in as" list in sample mode.
 * `error` says why the last sign-in didn't go on. It only reads: signing in
 * happens in /auth/callback (Google) or the Sign in as action (sample).
 *
 * The mockup's "One device at a time" notice comes with the Active Device.
 */
export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const next = safeMemberAppNext(params.next);
  const access = await getMemberAppAccess();
  if (access.status === "open") redirect(next);
  if (access.status === "not-open-yet") redirect(paths.memberApp.notOpenYet);
  const problem = parseSignInProblem(params.error);

  return (
    <main className="flex min-h-svh flex-wrap">
      <div className="flex flex-[1_1_360px] flex-col justify-between gap-9 bg-ayc-blue p-7 text-ayc-cream wide:p-16">
        <span className="self-start bg-ayc-cream p-1.5">
          <BrandLogo alt={config.site.name} priority />
        </span>
        <div className="flex flex-col gap-4">
          <p className="text-[clamp(34px,4.6vw,60px)] leading-none font-extrabold tracking-[-0.03em] text-balance">
            Your reviewer, one card at a time.
          </p>
          <ul className="flex flex-col gap-2 text-base leading-[1.4] text-ayc-on-navy-soft">
            {SELLING_POINTS.map((point) => (
              <li key={point} className="flex gap-2.5">
                <span aria-hidden="true" className="text-ayc-orange">
                  ✓
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="font-mono text-[11px] leading-[1.4] font-medium tracking-[0.06em] text-ayc-on-navy-soft">
          BUILT BY BOARD PASSERS · ILOILO CITY
        </p>
      </div>

      <div className="flex flex-[1_1_360px] items-center justify-center bg-background p-7 wide:p-16">
        <div className="flex w-full max-w-[400px] flex-col gap-5">
          <h1 className="text-[32px] font-extrabold tracking-[-0.025em]">Sign in</h1>
          <p className="text-base leading-normal">
            Use your Google account. No separate username or password.
          </p>
          {problem ? (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {MEMBER_SIGN_IN_PROBLEMS[problem]}
            </p>
          ) : null}
          {adminMode === "live" ? (
            <GoogleSignInForm next={next} action={continueWithGoogle} />
          ) : (
            <SignInAsPanel users={listSampleMembers()} next={next} action={signInAs} />
          )}
          <p className="text-[13px] text-muted-foreground">
            By continuing you agree to the{" "}
            <Link href={paths.legal.terms} className="text-ayc-blue underline underline-offset-2">
              Terms
            </Link>{" "}
            and{" "}
            <Link href={paths.legal.privacy} className="text-ayc-blue underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
