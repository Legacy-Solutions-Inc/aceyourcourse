import { createHash, timingSafeEqual } from "node:crypto";

// Who may call the Reviewer PDF job's endpoints (ticket 12; ADR 0012): Vercel
// Cron, which sends `Authorization: Bearer <CRON_SECRET>`, and each run of
// the job, which sends the same to start the next. Pure.

/**
 * What a caller may do: come in, be refused (401), or find nothing there
 * (404), when the server has no secret and the endpoints don't run.
 */
export type CronAccess = "allowed" | "refused" | "no-secret";

const digest = (text: string) => createHash("sha256").update(text).digest();

/**
 * Pure: whether the request's Authorization header carries the server's
 * secret. Compared in constant time, over digests, so neither the secret's
 * length nor its first differing character leaks.
 */
export function cronAccess(authorization: string | null, secret: string | undefined): CronAccess {
  if (!secret) return "no-secret";
  return timingSafeEqual(digest(authorization ?? ""), digest(`Bearer ${secret}`))
    ? "allowed"
    : "refused";
}
