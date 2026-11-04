import { z } from "zod";

/**
 * How a Supabase session signed in: its `amr` claim, a list of
 * { method, timestamp }. Supabase records the method when the session starts
 * and keeps it when the token refreshes.
 */
const amrSchema = z.array(z.object({ method: z.string() }));

/** The sign-in methods the Admin counts, by NODE_ENV. Google (`oauth`) everywhere; a password under `pnpm dev` only. */
function countedMethods(nodeEnv: string | undefined): readonly string[] {
  return nodeEnv === "development" ? ["oauth", "password"] : ["oauth"];
}

/**
 * Pure: whether a session's sign-in counts for the Admin (ticket 19;
 * CONVENTIONS §3). It fails closed: any other method (otp, magiclink,
 * anonymous, a refresh alone), or an amr that's missing or unreadable, never
 * counts. So production stays Google-only, whatever Supabase's Email setting
 * says.
 */
export function signInMethodCounts(amr: unknown, nodeEnv: string | undefined): boolean {
  const parsed = amrSchema.safeParse(amr);
  if (!parsed.success) return false;
  const counted = countedMethods(nodeEnv);
  return parsed.data.some(({ method }) => counted.includes(method));
}
