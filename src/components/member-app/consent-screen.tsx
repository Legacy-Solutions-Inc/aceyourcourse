import { useId } from "react";

import type { ConsentFormState } from "@/app/app/consent/actions";
import type { LegalVersions } from "@/content/legal/types";
import type { ConsentStatus } from "@/lib/member-app/consent";

import { ConsentForm } from "./consent-form";

/**
 * What the Member App keeps, and why: the consent screen's list (mockup
 * `consent`). It summarises the Privacy Policy, so it changes with it: check
 * it whenever PRIVACY_POLICY_VERSION changes (written for v2.1).
 */
const KEPT = [
  "Your Google name and email, to sign you in.",
  "Your Target Exams, exam dates and study progress, to run your countdown and dashboard.",
  "Which device is your Active Device, with a log of each switch, so only one device is signed in at a time.",
  "Your email and Member ID, stamped on each Reviewer PDF page you open, so a shared page can be traced to its account.",
  "Your Orders and Invoice Requests, if you buy, kept as long as the tax rules require, even after your account is deleted.",
];

const KEPT_TITLE = "What we keep, and why";

/** The heading for each reason the screen shows: never agreed, or what changed since. */
const HEADINGS: Record<Exclude<ConsentStatus, "ok">, string> = {
  "first-time": KEPT_TITLE,
  "terms-changed": "We’ve updated our Terms",
  "privacy-changed": "We’ve updated our Privacy Policy",
  "both-changed": "We’ve updated our Terms and Privacy Policy",
};

interface ConsentScreenProps {
  /** Why the screen shows: the consent check's answer. */
  status: Exclude<ConsentStatus, "ok">;
  /** The current Terms and Privacy versions: what the Member agrees to. */
  versions: LegalVersions;
  /** The sanitised `next`: where to go once the Member agrees. */
  next: string;
  /** The documents changed while the screen was open, so it reloaded with the current versions. */
  outdated: boolean;
  /** The consent Server Action. */
  action: (previous: ConsentFormState, formData: FormData) => Promise<ConsentFormState>;
  /** The Member App's sign-out Server Action, for someone who doesn't want to agree. */
  signOutAction: () => Promise<void>;
}

/**
 * The consent screen (mockup `consent`, BUILD-MAP §3 and §7; spec, Phase 3 →
 * Consent): what's kept and why, then the form (consent-form.tsx, the one
 * client part). Asked again after a version change, it says which document
 * changed.
 */
export function ConsentScreen({
  status,
  versions,
  next,
  outdated,
  action,
  signOutAction,
}: ConsentScreenProps) {
  const keptId = useId();
  const firstTime = status === "first-time";

  return (
    <main className="flex min-h-svh items-center justify-center bg-ayc-sand p-6">
      <div className="flex w-full max-w-[520px] flex-col border-[1.5px] bg-ayc-paper shadow-hard-lg">
        <p className="border-b-[1.5px] bg-ayc-blue px-4.5 py-3 font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-cream">
          {firstTime ? "BEFORE YOU START" : "BEFORE YOU CONTINUE"}
        </p>
        <div className="flex flex-col gap-3.5 p-5.5">
          <h1
            id={firstTime ? keptId : undefined}
            className="text-[26px] leading-[1.1] font-extrabold tracking-[-0.02em]"
          >
            {HEADINGS[status]}
          </h1>
          {outdated ? (
            <p role="status" className="border-[1.5px] border-ayc-blue bg-background p-3 text-sm">
              The Terms or Privacy Policy changed while this page was open. This is the current
              version: read it, then agree again.
            </p>
          ) : null}
          {firstTime ? null : (
            <>
              <p className="text-[15px] leading-normal">
                Read what’s changed, then agree to keep using the Member App.
              </p>
              <h2 id={keptId} className="text-lg font-extrabold">
                {KEPT_TITLE}
              </h2>
            </>
          )}
          <ol aria-labelledby={keptId} className="flex flex-col gap-2 text-[15px] leading-[1.45]">
            {KEPT.map((item, index) => (
              <li key={item} className="flex gap-2.5">
                <span aria-hidden="true" className="font-bold text-ayc-blue">
                  {index + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
          <p className="text-sm">
            We don’t sell your data. You can ask for a copy of it, or for your account to be
            deleted, at any time.
          </p>
          <ConsentForm versions={versions} next={next} action={action} />
          <p className="font-mono text-[11px] text-ayc-slate">
            WE SAVE THE DATE AND VERSION YOU AGREED TO.
          </p>
          <form
            action={signOutAction}
            className="flex flex-wrap items-center gap-2 border-t border-dashed border-ayc-rule pt-3.5 text-sm"
          >
            <span>Not ready to agree?</span>
            <button
              type="submit"
              className="min-h-11 cursor-pointer font-bold text-ayc-blue underline underline-offset-2"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
