"use client";

import { useActionState, useId } from "react";

import type { PasswordSignInState } from "@/app/admin/sign-in/actions";
import type { PasswordSignInPurpose } from "@/lib/admin/sign-in-method";

interface PasswordSignInFormProps {
  /** The sanitised `next`, sent back with the form. */
  next: string;
  /** What the box is for, decided on the server: `pnpm dev`, or a deployment being tested (ticket 24). */
  purpose: PasswordSignInPurpose;
  action: (previous: PasswordSignInState, formData: FormData) => Promise<PasswordSignInState>;
}

const IDLE: PasswordSignInState = { error: null, fieldErrors: {}, email: "" };

const HEADINGS = {
  development: { label: "Development only", text: "DEVELOPMENT ONLY" },
  testing: { label: "Testing only", text: "TESTING ONLY" },
} as const;

const FIELD =
  "min-h-11 min-w-0 border-[1.5px] bg-white px-3 text-[15px] aria-invalid:border-destructive";

/**
 * The password box (ticket 19), under "Continue with Google": the sign-in
 * page renders it only where the password sign-in is allowed (live mode,
 * under `pnpm dev` or with ADMIN_PASSWORD_SIGN_IN "true", ticket 24), while
 * Supabase has Email on. It's headed "DEVELOPMENT ONLY" or "TESTING ONLY".
 * It only signs in: there's no sign-up and no password reset. It isn't in the mockup, so it stays plainly apart from the
 * mockup's screen. The typed email survives an error; the password doesn't.
 */
export function PasswordSignInForm({ next, purpose, action }: PasswordSignInFormProps) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const id = useId();
  const { email: emailError, password: passwordError } = state.fieldErrors;
  const heading = HEADINGS[purpose];

  return (
    <section
      aria-label={heading.label}
      className="mt-2 flex flex-col gap-3 border-[1.5px] border-dashed bg-ayc-paper p-4"
    >
      <div className="flex flex-col gap-1">
        <p className="font-mono text-[11px] font-bold tracking-[0.08em] text-ayc-blue">
          {heading.text}
        </p>
        <h2 className="text-lg font-extrabold">Sign in with a password</h2>
      </div>

      <form action={formAction} noValidate className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-email`} className="text-sm font-bold">
            Email
          </label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.email}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? `${id}-email-error` : undefined}
            className={FIELD}
          />
          {emailError ? (
            <p id={`${id}-email-error`} className="text-sm font-semibold text-destructive">
              {emailError}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-password`} className="text-sm font-bold">
            Password
          </label>
          <input
            id={`${id}-password`}
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? `${id}-password-error` : undefined}
            className={FIELD}
          />
          {passwordError ? (
            <p id={`${id}-password-error`} className="text-sm font-semibold text-destructive">
              {passwordError}
            </p>
          ) : null}
        </div>
        {state.error ? (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 cursor-pointer self-start border-[1.5px] bg-primary px-4 text-sm font-bold text-primary-foreground disabled:cursor-wait"
        >
          Sign in
        </button>
      </form>
    </section>
  );
}
