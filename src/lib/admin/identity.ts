import "server-only";

import { isAuthRetryableFetchError, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { z } from "zod";

import { config } from "@/config";
import { env } from "@/env";
import { serverEnv } from "@/env.server";
import { adminMode } from "@/lib/admin/mode";
import { safeAdminNext } from "@/lib/admin/safe-next";
import {
  type PasswordSignInPurpose,
  passwordSignInPermitted,
  signInMethodCounts,
} from "@/lib/admin/sign-in-method";
import { googleProblem, type PasswordProblem, passwordProblem } from "@/lib/admin/sign-in-problem";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { paths } from "@/paths";
import { staffEmailSchema } from "@/services/admin.schema";
import type { SignInIdentity } from "@/services/admin.types";
import { SAMPLE_USERS, type SampleUser } from "@/services/mock/staff";

// ─────────────────────────────────────────────────────────────────────────────
// Who is signed in to the Admin (CONVENTIONS §3). The Staff Guard asks this
// module for the signed-in User's email and name, then checks the staff list
// itself: nothing here grants access.
//
// Two arms, by the Admin's mode:
// - sample: the development-only "Sign in as" list sets the ayc_admin_sample
//   cookie, which is honoured in "sample" mode and ignored otherwise. The
//   sample Users stand in for Google accounts, so this arm owns them.
// - live (ticket 16): Google sign-in through Supabase. The User comes from
//   supabase.auth.getUser(), which asks Supabase to verify the session, never
//   from getSession() or the cookie alone. Only a verified email counts, and
//   user_metadata, which the User can change, is never read.
//   How the session signed in counts too (ticket 19): its `amr`, from the
//   verified claims (supabase.auth.getClaims()). Google counts everywhere; a
//   password only where the password box is allowed: under `pnpm dev`, or
//   while the deployed site is tested with ADMIN_PASSWORD_SIGN_IN "true"
//   (ticket 24, temporary; see sign-in-method.ts).
// ─────────────────────────────────────────────────────────────────────────────

export const SAMPLE_IDENTITY_COOKIE = "ayc_admin_sample";

/** Who the session says is signing in. Only "verified" passes on to the staff list. */
export type SignInAttempt =
  | { status: "signed-out" }
  | { status: "unverified"; email: string }
  | { status: "verified"; identity: SignInIdentity };

const SIGNED_OUT: SignInAttempt = { status: "signed-out" };

function sampleName(email: string): string | null {
  return SAMPLE_USERS.find((user) => user.email === email)?.name ?? null;
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/**
 * Pure: the sign-in a Supabase User makes. The email is verified when
 * Supabase confirmed it, or the sign-in provider (Google) says it verified
 * it. The name is the provider's profile name (Google's, preferred), for
 * display only. user_metadata is never read: the User can set it themselves.
 */
export function attemptFromUser(user: User | null): SignInAttempt {
  const email = staffEmailSchema.safeParse(user?.email);
  if (!user || !email.success) return SIGNED_OUT;

  // The provider's own record of this email; the User can't change it.
  const forEmail = (user.identities ?? []).filter(
    (identity) => text(identity.identity_data?.email)?.toLowerCase() === email.data,
  );
  const profile = forEmail.find(({ provider }) => provider === "google") ?? forEmail[0];
  const verified =
    Boolean(user.email_confirmed_at) || profile?.identity_data?.email_verified === true;
  if (!verified) return { status: "unverified", email: email.data };

  const name = text(profile?.identity_data?.full_name) ?? text(profile?.identity_data?.name);
  return { status: "verified", identity: { email: email.data, name } };
}

/**
 * Whether the session's verified claims, for this User, say it signed in a way
 * that counts here. getClaims() checks the token's signature (or asks Supabase
 * when it can't); a failure, or no session, doesn't count.
 */
async function sessionMethodCounts(userId: string): Promise<boolean> {
  try {
    const { data, error } = await createClient(cookies()).auth.getClaims();
    if (error || !data) return false;
    return (
      data.claims.sub === userId && signInMethodCounts(data.claims.amr, passwordSignInAllowed())
    );
  } catch {
    return false;
  }
}

/**
 * getSession() asks Supabase to verify the session; unreachable, it is signed
 * out. A session that signed in a way that doesn't count here is signed out
 * too: not recorded, and not a 403.
 */
async function supabaseAttempt(): Promise<SignInAttempt> {
  const user = await getSession();
  if (!user || !(await sessionMethodCounts(user.id))) return SIGNED_OUT;
  return attemptFromUser(user);
}

async function sampleAttempt(): Promise<SignInAttempt> {
  const parsed = staffEmailSchema.safeParse((await cookies()).get(SAMPLE_IDENTITY_COOKIE)?.value);
  return parsed.success
    ? { status: "verified", identity: { email: parsed.data, name: sampleName(parsed.data) } }
    : SIGNED_OUT;
}

/** The sign-in this request carries, in this mode. Closed mode has none. */
export async function getSignInAttempt(): Promise<SignInAttempt> {
  if (adminMode === "live") return supabaseAttempt();
  if (adminMode === "sample") return sampleAttempt();
  return SIGNED_OUT;
}

/**
 * The signed-in User (email trimmed and lowercased), or null when signed out
 * or their email isn't verified. A sample cookie that doesn't hold an email
 * address is treated as signed out.
 */
export async function getIdentity(): Promise<SignInIdentity | null> {
  const attempt = await getSignInAttempt();
  return attempt.status === "verified" ? attempt.identity : null;
}

/** The "Sign in as" list: the sample Users in sample mode, and nobody otherwise. */
export function listSampleUsers(): readonly SampleUser[] {
  return adminMode === "sample" ? SAMPLE_USERS : [];
}

/** Sample mode only: signs in as this email. Throws in any other mode. */
export async function startSampleSession(email: string): Promise<SignInIdentity> {
  if (adminMode !== "sample") {
    throw new Error("The sample sign-in exists only with sample data.");
  }
  const parsed = staffEmailSchema.parse(email);
  (await cookies()).set(SAMPLE_IDENTITY_COOKIE, parsed, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Sample mode never runs in production; the flag is here for the record.
    secure: env.NODE_ENV === "production",
  });
  return { email: parsed, name: sampleName(parsed) };
}

export type GoogleSignInStart =
  { ok: true; url: string } | { ok: false; reason: "not-set-up" | "unreachable" };

/** The part of Supabase's public auth settings (GET /auth/v1/settings) read here. */
const authSettingsSchema = z.object({
  // Email may be missing: Google's check mustn't depend on it.
  external: z.object({ google: z.boolean(), email: z.boolean().catch(false) }),
});

/** Which sign-in providers this Supabase has on. */
type AuthProviders = z.infer<typeof authSettingsSchema>["external"];

const NO_PROVIDERS: AuthProviders = { google: false, email: false };

/**
 * Which providers this Supabase has on (Google, Email): its public auth
 * settings say so. Asked before sending anyone to Google, because a provider
 * that's off answers the browser with a bare JSON error, and before showing
 * the development password box. Null when it didn't answer.
 */
async function authProviders(): Promise<AuthProviders | null> {
  const { url, publishableKey } = config.supabase;
  if (!url || !publishableKey) return NO_PROVIDERS;
  try {
    const response = await fetch(new URL("/auth/v1/settings", url), {
      headers: { apikey: publishableKey },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const settings = authSettingsSchema.safeParse(await response.json());
    return settings.success ? settings.data.external : NO_PROVIDERS;
  } catch {
    return null;
  }
}

/**
 * Live mode only: where to send the browser to sign in with Google. Supabase's
 * server client runs the PKCE flow: it keeps the code verifier in a cookie,
 * and Google returns through /auth/callback, which exchanges the code and
 * goes on to `next` (sanitised to an Admin path). Google always asks which
 * account to use, so "Use another account" can pick another one.
 */
export async function startGoogleSignIn(next: unknown): Promise<GoogleSignInStart> {
  if (adminMode !== "live") throw new Error("Google sign-in runs in live mode only.");
  const providers = await authProviders();
  if (providers === null) return { ok: false, reason: "unreachable" };
  if (!providers.google) return { ok: false, reason: "not-set-up" };

  const redirectTo = new URL(paths.auth.callback, config.site.url);
  redirectTo.searchParams.set("next", safeAdminNext(next));
  const { data, error } = await createClient(cookies()).auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo.toString(),
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) return { ok: false, reason: "unreachable" };
  return { ok: true, url: data.url };
}

/**
 * Live mode: where "Continue with Google" and "Use another account" send the
 * browser: Google, or back to sign-in saying why it couldn't start.
 */
export async function googleSignInDestination(next: unknown): Promise<string> {
  const safeNext = safeAdminNext(next);
  const start = await startGoogleSignIn(safeNext);
  return start.ok ? start.url : paths.admin.signIn(safeNext, googleProblem(start.reason));
}

/**
 * Where the password sign-in may run at all: live mode under `pnpm dev`
 * (ticket 19) or, while the deployed site is tested, with ADMIN_PASSWORD_SIGN_IN
 * "true" (ticket 24, temporary). Anywhere else the box isn't offered, its
 * action answers 404, and the Staff Guard never counts a password session.
 */
export function passwordSignInAllowed(): boolean {
  return passwordSignInPermitted({
    adminMode,
    nodeEnv: env.NODE_ENV,
    passwordSwitch: serverEnv.ADMIN_PASSWORD_SIGN_IN,
  });
}

/** What the password box is for, for its heading: "DEVELOPMENT ONLY" under `pnpm dev`, "TESTING ONLY" elsewhere. */
export function passwordSignInPurpose(): PasswordSignInPurpose {
  return env.NODE_ENV === "development" ? "development" : "testing";
}

/**
 * Whether the sign-in screen offers the password box: where it's allowed,
 * while Supabase says its Email provider is on. Not when Supabase doesn't
 * answer.
 */
export async function passwordSignInOffered(): Promise<boolean> {
  if (!passwordSignInAllowed()) return false;
  return (await authProviders())?.email === true;
}

export type PasswordSignInStart = { ok: true } | { ok: false; problem: PasswordProblem };

/**
 * The password box's sign-in: a Supabase session for this email
 * and password, set in the cookies as Google's is. Only signs in: Supabase
 * makes no User here. The Staff Guard decides what happens next. Throws
 * where the password sign-in isn't allowed.
 */
export async function startPasswordSession(
  email: string,
  password: string,
): Promise<PasswordSignInStart> {
  if (!passwordSignInAllowed()) {
    throw new Error("The password sign-in isn't allowed here.");
  }
  try {
    const { error } = await createClient(cookies()).auth.signInWithPassword({ email, password });
    if (!error) return { ok: true };
    return {
      ok: false,
      problem: isAuthRetryableFetchError(error) ? "unreachable" : passwordProblem(error),
    };
  } catch {
    return { ok: false, problem: "unreachable" };
  }
}

/**
 * Live mode: exchanges the OAuth code from Google for a Supabase session.
 * Whether it worked; a missing, used or expired code didn't.
 */
export async function finishGoogleSignIn(code: string): Promise<boolean> {
  if (adminMode !== "live") return false;
  try {
    const { error } = await createClient(cookies()).auth.exchangeCodeForSession(code);
    return !error;
  } catch {
    return false;
  }
}

/** Signs out of the Admin: the Supabase session in live mode, the sample cookie otherwise. */
export async function endSession(): Promise<void> {
  if (adminMode === "live") {
    try {
      await createClient(cookies()).auth.signOut();
    } catch {
      // Supabase unreachable: the intent is to sign out, so carry on.
    }
  }
  (await cookies()).delete(SAMPLE_IDENTITY_COOKIE);
}
