import type { Metadata } from "next";
import Link from "next/link";

import { AuthScreen } from "@/components/admin/auth-screen";
import { getDeniedScreen } from "@/lib/admin/guard";
import { formatLoggedAt } from "@/lib/admin/time";
import { paths } from "@/paths";
import { getWebsiteSettings } from "@/services/catalogue";

import { switchAccount } from "../actions";

export const metadata: Metadata = { title: "Not authorised" };

interface DeniedPageProps {
  searchParams: Promise<{ reason?: string | string[] }>;
}

const primaryButton =
  "flex min-h-10.5 cursor-pointer items-center border-[1.5px] bg-primary px-4 text-sm font-bold text-primary-foreground";
const secondaryButton =
  "flex min-h-10.5 cursor-pointer items-center border-[1.5px] px-4 text-sm font-bold hover:bg-ayc-sand";

/**
 * The 403 screen (mockup 895–905): a User who isn't Staff, an expired Invite,
 * or an Editor on an Owner-only screen. Nothing was changed, and a refused
 * sign-in shows when it was recorded.
 */
export default async function DeniedPage({ searchParams }: DeniedPageProps) {
  const screen = await getDeniedScreen((await searchParams).reason);

  const useAnotherAccount = (
    <form action={switchAccount}>
      <button
        type="submit"
        className={screen.reason === "owners-only" ? secondaryButton : primaryButton}
      >
        Use another account
      </button>
    </form>
  );

  if (screen.reason === "owners-only") {
    return (
      <AuthScreen tone="denied">
        <p className="font-mono text-[11px] font-bold tracking-[0.08em] text-destructive">
          403 · OWNERS ONLY
        </p>
        <h1 className="text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em]">
          This page is for Owners only
        </h1>
        <p className="text-[15px] leading-normal">
          You’re signed in as <b className="wrap-anywhere">{screen.actor.email}</b>, an Editor. Only
          Owners can open this page. Nothing was changed.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={paths.admin.overview} className={primaryButton}>
            Back to the Overview
          </Link>
          {useAnotherAccount}
        </div>
      </AuthScreen>
    );
  }

  const { memberAppLive } = await getWebsiteSettings();
  return (
    <AuthScreen tone="denied">
      <p className="font-mono text-[11px] font-bold tracking-[0.08em] text-destructive">
        403 · NOT AUTHORISED
      </p>
      <h1 className="text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em]">
        This account can’t open the admin dashboard
      </h1>
      {screen.reason === "invite-expired" ? (
        <p className="text-[15px] leading-normal">
          You’re signed in as <b className="wrap-anywhere">{screen.email}</b>. Your invite expired.
          Ask an Owner to renew it. Nothing was changed.
        </p>
      ) : (
        <p className="text-[15px] leading-normal">
          You’re signed in as <b className="wrap-anywhere">{screen.email}</b>, which isn’t on the
          admin list. Nothing was changed. If you should have access, ask the site owner to
          authorise this account.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {useAnotherAccount}
        {memberAppLive ? (
          <Link href={paths.memberApp.home} className={secondaryButton}>
            Go to the member app
          </Link>
        ) : (
          <Link href={paths.home} className={secondaryButton}>
            Go to the website
          </Link>
        )}
      </div>
      {screen.loggedAt ? (
        <p className="font-mono text-[11px] text-muted-foreground">
          THIS ATTEMPT WAS LOGGED · {formatLoggedAt(screen.loggedAt)}
        </p>
      ) : null}
    </AuthScreen>
  );
}
