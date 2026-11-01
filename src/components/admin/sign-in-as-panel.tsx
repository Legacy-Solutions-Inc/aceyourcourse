"use client";

import { useActionState, useId, useState } from "react";

import type { SignInAsState } from "@/app/admin/sign-in/actions";
import type { SampleUser } from "@/services/mock/staff";

interface SignInAsPanelProps {
  users: readonly Pick<SampleUser, "name" | "email" | "startsAs">[];
  /** The sanitised `next`, sent back with the form. */
  next: string;
  action: (previous: SignInAsState, formData: FormData) => Promise<SignInAsState>;
}

const IDLE: SignInAsState = { error: null, email: "" };

/**
 * Stage A's "Continue with Google": it opens the development-only "Sign in as"
 * list of sample Users, plus an "Other email" field for any address. Sample
 * mode only; the sign-in page never renders it otherwise.
 */
export function SignInAsPanel({ users, next, action }: SignInAsPanelProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, IDLE);
  const panelId = useId();
  const errorId = useId();

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="flex min-h-13.5 cursor-pointer items-center justify-center gap-3 border-[1.5px] bg-white text-base font-bold shadow-hard transition-[transform,box-shadow] hover:-translate-x-px hover:-translate-y-px motion-reduce:transition-none"
      >
        <span
          aria-hidden="true"
          className="flex size-6 items-center justify-center rounded-full border-[1.5px] text-[13px] font-extrabold"
        >
          G
        </span>
        Continue with Google
      </button>

      <section
        id={panelId}
        hidden={!open}
        aria-labelledby={`${panelId}-title`}
        className="flex flex-col gap-3 border-[1.5px] bg-ayc-paper p-4"
      >
        <div className="flex flex-col gap-1">
          <h2 id={`${panelId}-title`} className="text-lg font-extrabold">
            Sign in as
          </h2>
          <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-destructive">
            SAMPLE DATA · DEVELOPMENT ONLY
          </p>
        </div>

        <form action={formAction}>
          <input type="hidden" name="next" value={next} />
          <ul className="flex flex-col gap-1.5">
            {users.map((user) => (
              <li key={user.email}>
                <button
                  type="submit"
                  name="email"
                  value={user.email}
                  disabled={pending}
                  className="flex w-full cursor-pointer flex-col items-start gap-0.5 border-[1.5px] bg-background px-3 py-2 text-left hover:bg-ayc-sand disabled:cursor-wait"
                >
                  <span className="text-[15px] font-bold">{user.name}</span>
                  <span className="font-mono text-[11px] wrap-anywhere text-muted-foreground">
                    {user.email} · {user.startsAs}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </form>

        <form action={formAction} noValidate className="flex flex-col gap-1.5">
          <input type="hidden" name="next" value={next} />
          <label htmlFor={`${panelId}-email`} className="text-sm font-bold">
            Other email
          </label>
          <div className="flex gap-2">
            <input
              id={`${panelId}-email`}
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={state.email}
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? errorId : undefined}
              className="min-h-11 min-w-0 flex-1 border-[1.5px] bg-white px-3 text-[15px] aria-invalid:border-destructive"
            />
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 cursor-pointer border-[1.5px] bg-primary px-4 text-sm font-bold text-primary-foreground disabled:cursor-wait"
            >
              Sign in
            </button>
          </div>
          {state.error ? (
            <p id={errorId} role="alert" className="text-sm font-semibold text-destructive">
              {state.error}
            </p>
          ) : null}
        </form>
      </section>
    </div>
  );
}
