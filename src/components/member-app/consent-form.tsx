"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";

import type { ConsentFormState } from "@/app/app/consent/actions";
import type { LegalVersions } from "@/content/legal/types";
import { paths } from "@/paths";

const IDLE: ConsentFormState = { error: null };

const linkClass = "font-bold text-ayc-blue underline underline-offset-2 hover:text-ayc-blue-dark";

interface ConsentFormProps {
  /** The current Terms and Privacy versions: what the Member agrees to, sent back with the form. */
  versions: LegalVersions;
  /** The sanitised `next`: where to go once the Member agrees. */
  next: string;
  /** The consent Server Action. */
  action: (previous: ConsentFormState, formData: FormData) => Promise<ConsentFormState>;
}

/**
 * The consent screen's form: two required boxes, unchecked to start, and
 * "Agree and continue" disabled until both are ticked. The boxes are a
 * convenience: the action refuses anything short of both agreements on the
 * server.
 */
export function ConsentForm({ versions, next, action }: ConsentFormProps) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const errorId = useId();
  const describedBy = state.error ? errorId : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="termsVersion" value={versions.terms} />
      <input type="hidden" name="privacyVersion" value={versions.privacy} />
      <label className="flex cursor-pointer items-start gap-2.5 text-[15px] leading-[1.4]">
        <input
          type="checkbox"
          name="terms"
          value="agreed"
          required
          checked={terms}
          onChange={(event) => setTerms(event.target.checked)}
          aria-describedby={describedBy}
          className="mt-px size-5.5 shrink-0 cursor-pointer accent-ayc-blue"
        />
        <span>
          I agree to the{" "}
          <Link href={paths.legal.terms} className={linkClass}>
            Terms of Use
          </Link>{" "}
          (version {versions.terms}).
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-2.5 text-[15px] leading-[1.4]">
        <input
          type="checkbox"
          name="privacy"
          value="agreed"
          required
          checked={privacy}
          onChange={(event) => setPrivacy(event.target.checked)}
          aria-describedby={describedBy}
          className="mt-px size-5.5 shrink-0 cursor-pointer accent-ayc-blue"
        />
        <span>
          I’ve read the{" "}
          <Link href={paths.legal.privacy} className={linkClass}>
            Privacy Policy
          </Link>{" "}
          (version {versions.privacy}) and agree to the processing described above.
        </span>
      </label>
      {state.error ? (
        <p id={errorId} role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!(terms && privacy) || pending}
        className="flex min-h-13.5 cursor-pointer items-center justify-center border-[1.5px] bg-ayc-orange px-4.5 text-base font-bold text-ayc-navy shadow-hard-sm disabled:cursor-not-allowed disabled:bg-ayc-sand disabled:text-ayc-slate disabled:shadow-none"
      >
        Agree and continue
      </button>
    </form>
  );
}
