import { z } from "zod";

import { staffEmailSchema } from "@/services/admin.schema";

// The Member seam's zod schemas, shared by its arms.

/** An email as the Beta Tester list and the Members hold it: trimmed and lowercased. */
export const memberEmailSchema = staffEmailSchema;

/** The signed-in User a Member record is made for. The seam's callers pass what sign-in verified. */
export const memberUserSchema = z.object({
  userId: z.string().uuid(),
  email: memberEmailSchema,
  name: z
    .string()
    .nullable()
    .transform((name) => name?.trim() || null),
});
