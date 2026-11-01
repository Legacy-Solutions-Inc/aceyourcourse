import "server-only";

import { revalidateTag } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/admin/guard";
import { invalidInput, roleRefusal } from "@/services/admin.schema";
import type { AdminError, AdminResult, RequiredRole, StaffActor } from "@/services/admin.types";

// ─────────────────────────────────────────────────────────────────────────────
// adminAction builds every Admin Server Action (CONVENTIONS §3). A Server
// Action is a public endpoint, so in order it:
//   1. runs the Staff Guard, which reads the staff list on the server (signed
//      out goes to sign-in, a User who isn't Staff to the 403 screen), and
//      refuses an Editor an Owners-only action,
//   2. validates the input with the area's zod schema,
//   3. calls the Admin seam, which checks the Staff Role again,
//   4. clears each cache tag the seam returns, so the save is live, and
//   5. returns a plain state for useActionState.
// Closed mode answers 404, through the Guard.
// ─────────────────────────────────────────────────────────────────────────────

/** What an Admin form's Server Action answers. */
export type AdminActionState<T> =
  | { status: "idle" }
  | { status: "saved"; value: T }
  | { status: "refused"; error: AdminError }
  /** The save broke down (the seam failed, or the request never arrived): nothing was saved. */
  | { status: "failed" };

/** What an Admin form sends: its input, and the stamp the record had when the form opened. */
export interface AdminSubmission {
  input: unknown;
  expected?: { savedAt: string };
}

export type AdminAction<T> = (
  previous: AdminActionState<T>,
  submission: AdminSubmission,
) => Promise<AdminActionState<T>>;

export type AdminHandler<Input, T> = (
  actor: StaffActor,
  input: Input,
  expected: { savedAt: string } | undefined,
) => Promise<AdminResult<T>>;

const RELOAD = "RELOAD THE PAGE AND TRY AGAIN";

// The submission comes from the browser, so even its shape is checked.
const submissionSchema = z.object({
  input: z.unknown(),
  expected: z.object({ savedAt: z.string().datetime() }).optional(),
});

/** An Admin Server Action: `role` decides who may use it, `schema` validates its input. */
export function adminAction<Schema extends z.ZodTypeAny, T>(
  options: { role: RequiredRole; schema: Schema },
  handler: AdminHandler<z.output<Schema>, T>,
): AdminAction<T> {
  return async (_previous, submission) => {
    // Not requireOwner, which sends an Editor to the 403 screen: a Server Action
    // answers the form instead, so an Editor's call is refused as forbidden.
    const actor = await requireStaff();
    const refusal = roleRefusal(actor, options.role);
    if (refusal) return { status: "refused", error: refusal };

    const sent = submissionSchema.safeParse(submission);
    if (!sent.success) {
      return { status: "refused", error: { kind: "invalid", fieldErrors: {}, formError: RELOAD } };
    }
    const input = options.schema.safeParse(sent.data.input);
    if (!input.success) return { status: "refused", error: invalidInput(input.error) };

    let result: AdminResult<T>;
    try {
      result = await handler(actor, input.data, sent.data.expected);
    } catch (error) {
      console.error("An Admin save failed", error);
      return { status: "failed" };
    }
    if (!result.ok) return { status: "refused", error: result.error };

    for (const tag of result.tags) revalidateTag(tag);
    return { status: "saved", value: result.value };
  };
}
