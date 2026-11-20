import Link from "next/link";

import { BrandLogo } from "@/components/website/brand-logo";
import { config } from "@/config";
import { paths } from "@/paths";

import type { ShellUser } from "./member-sidebar";

interface NotOpenYetProps {
  user: ShellUser;
  /** The support email: the contact email in Settings. */
  contactEmail: string;
  /** The Member App's sign-out Server Action. */
  signOutAction: () => Promise<void>;
}

/**
 * "Not open yet" (story 133c): someone who signed in while the Member App
 * switch is off, and is neither Staff nor a Beta Tester. They stay signed in,
 * so they get in the moment an Owner adds them or the Member App opens. It
 * isn't in the mockup, so it borrows the sign-in card's frame.
 */
export function NotOpenYet({ user, contactEmail, signOutAction }: NotOpenYetProps) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-ayc-blue p-6">
      <div className="flex w-full max-w-[460px] flex-col gap-4 border-[1.5px] bg-background p-8 shadow-hard-lg">
        <span className="self-start">
          <BrandLogo alt={config.site.name} priority />
        </span>
        <p className="mt-1.5 font-mono text-[11px] font-bold tracking-[0.08em] text-ayc-blue">
          MEMBER APP · COMING SOON
        </p>
        <h1 className="text-[32px] leading-[1.1] font-extrabold tracking-[-0.025em]">
          Not open yet
        </h1>
        <p className="text-base leading-normal">
          The Member App isn’t open to everyone yet. We’re testing it with a small group first, and
          it isn’t broken on your side.
        </p>
        <p className="text-[15px] leading-normal">
          You’re signed in as <b className="wrap-anywhere">{user.email}</b>. When the Member App
          opens, sign in with this Google account and you’ll get straight in.
        </p>
        <p className="border border-dashed border-ayc-rule p-3.5 text-sm leading-[1.45]">
          Questions, or think you should be in the beta? Email{" "}
          <a
            href={`mailto:${contactEmail}`}
            className="font-bold wrap-anywhere text-ayc-blue underline underline-offset-2"
          >
            {contactEmail}
          </a>
          .
        </p>
        <div className="flex flex-wrap gap-2">
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex min-h-11 cursor-pointer items-center border-[1.5px] bg-primary px-4 text-sm font-bold text-primary-foreground"
            >
              Sign out
            </button>
          </form>
          <Link
            href={paths.home}
            className="flex min-h-11 items-center border-[1.5px] px-4 text-sm font-bold hover:bg-ayc-sand"
          >
            Back to the website
          </Link>
        </div>
      </div>
    </main>
  );
}
