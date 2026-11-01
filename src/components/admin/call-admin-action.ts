import { unstable_rethrow } from "next/navigation";

import type { AdminAction, AdminActionState, AdminSubmission } from "@/lib/admin/action";

const IDLE = { status: "idle" } as const;

/**
 * Calls an Admin Server Action from the browser. A request that never arrives,
 * or a server that breaks down, answers "failed", as adminAction does for a
 * seam that throws. A redirect from the Staff Guard isn't a failure: it's
 * rethrown so Next follows it to sign-in or the 403 screen.
 */
export async function callAdminAction<T>(
  action: AdminAction<T>,
  submission: AdminSubmission,
  previous: AdminActionState<T> = IDLE,
): Promise<AdminActionState<T>> {
  try {
    return await action(previous, submission);
  } catch (error) {
    unstable_rethrow(error);
    return { status: "failed" };
  }
}
