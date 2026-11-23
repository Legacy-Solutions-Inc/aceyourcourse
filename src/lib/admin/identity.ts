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
import { safeMemberAppNext } from "@/lib/member-app/safe-next";
import { createClient } from "@/lib/supabase/server";
import { paths } from "@/paths";
import { staffEmailSchema } from "@/services/admin.schema";
import type { SignInIdentity } from "@/services/admin.types";
import type { MemberUser } from "@/services/member.types";
import { SAMPLE_MEMBERS, type SampleMember, sampleUserId } from "@/services/mock/members";
import { SAMPLE_USERS, type SampleUser } from "@/services/mock/staff";

// ─────────────────────────────────────────────────────────────────────────────
// Who is signed in to the Admin (CONVENTIONS §3). The Staff Guard asks this
// module for the signed-in User's email and name, then checks the staff list
// itself: nothing here grants access. The Member App (Phase 3) signs in the
// same way, with the same session: its gate asks getSignedInUser(), which
// adds the User's id, and checks the staff list and the Beta Tester list
// itself (src/lib/member-app/guard.ts).
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
//   (ticket 24, temporary; see sign-in-method.ts). The Admin and the Member
//   App count it alike (ticket 20), and offer the box in the same places.
// ─────────────────────────────────────────────────────────────────────────────

export const SAMPLE_IDENTITY_COOKIE = "ayc_admin_sample";

/** Who the session says is signing in. Only "verified" passes on to the staff list. */
export type SignInAttempt =
  | { status: "signed-out" }
  | { status: "unverified"; email: string }
  | { status: "verified"; identity: SignInIdentity };

const SIGNED_OUT: SignInAttempt = { status: "signed-out" };

function sampleName(email: string): string | null {
  return [...SAMPLE_USERS, ...SAMPLE_MEMBERS].find((user) => user.email === email)?.name ?? null;
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
async function supabaseUser(): Promise<User | null> {
  const user = await getSession();
  return user && (await sessionMethodCounts(user.id)) ? user : null;
}

async function supabaseAttempt(): Promise<SignInAttempt> {
  return attemptFromUser(await supabaseUser());
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

/**
 * The signed-in User for the Member App: their id, verified email (trimmed
 * and lowercased) and name, or null when signed out or their email isn't
 * verified. Live, the id is the Supabase User's, and how the session signed
 * in counts exactly as for the Staff Guard (supabaseUser, ticket 19), which
 * the Member App's password box relies on (ticket 20).
 * With sample data, where "Sign in as" stands in for Google, it is made from
 * the email, the same every time.
 */
export async function getSignedInUser(): Promise<MemberUser | null> {
  if (adminMode === "live") {
    const user = await supabaseUser();
    const attempt = attemptFromUser(user);
    return user && attempt.status === "verified" ? { userId: user.id, ...attempt.identity } : null;
  }
  if (adminMode === "sample") {
    const attempt = await sampleAttempt();
    if (attempt.status !== "verified") return null;
    return { userId: sampleUserId(attempt.identity.email), ...attempt.identity };
  }
  return null;
}

/** The Member App's "Sign in as" list: the sample Members in sample mode, and nobody otherwise. */
export function listSampleMembers(): readonly SampleMember[] {
  return adminMode === "sample" ? SAMPLE_MEMBERS : [];
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
 * goes on to `next`, sanitised to a path on the Surface that asked: the Admin's
 * sign-in never lands in the Member App, nor the Member App's in the Admin.
 * Google always asks which account to use, so "Use another account" can pick
 * another one.
 */
export async function startGoogleSignIn(
  next: unknown,
  surface: "admin" | "member-app" = "admin",
): Promise<GoogleSignInStart> {
  if (adminMode !== "live") throw new Error("Google sign-in runs in live mode only.");
  const providers = await authProviders();
  if (providers === null) return { ok: false, reason: "unreachable" };
  if (!providers.google) return { ok: false, reason: "not-set-up" };

  const redirectTo = new URL(paths.auth.callback, config.site.url);
  redirectTo.searchParams.set(
    "next",
    surface === "member-app" ? safeMemberAppNext(next) : safeAdminNext(next),
  );
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
 * Where the password sign-in may run at all, in the Admin and the Member App
 * alike (ticket 20): live mode under `pnpm dev` (ticket 19) or, while the
 * deployed site is tested, with ADMIN_PASSWORD_SIGN_IN "true" (ticket 24,
 * temporary). Anywhere else neither sign-in screen offers the box, both
 * actions answer 404, and neither the Staff Guard nor the Member App counts a
 * password session.
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
 * makes no User here. The Staff Guard, or the Member App's gate, decides
 * what happens next. Throws where the password sign-in isn't allowed.
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

/**
 * Signs out, of the Admin and the Member App alike (they share the session):
 * the Supabase session in live mode, the sample cookie otherwise. Only this
 * browser's session ends ("local"): Supabase's default ends every session the
 * User has, which would sign them out of the Admin on their laptop when they
 * sign out of the Member App on their phone. Their other devices stay signed
 * in; in the Member App the Active Device decides who's replaced (ADR 0011).
 */
export async function endSession(): Promise<void> {
  if (adminMode === "live") {
    try {
      await createClient(cookies()).auth.signOut({ scope: "local" });
    } catch {
      // Supabase unreachable: the intent is to sign out, so carry on.
    }
  }
  (await cookies()).delete(SAMPLE_IDENTITY_COOKIE);
}
