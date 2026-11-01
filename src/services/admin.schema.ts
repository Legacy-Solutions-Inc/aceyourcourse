import { z } from "zod";

// The Admin seam's zod input schemas (CONVENTIONS §3), shared by the seam's
// arms, the Staff Guard and the forms.

/** A sign-in email: trimmed and lowercased, because the staff list compares emails case-insensitively. */
export const staffEmailSchema = z.string().trim().toLowerCase().email();

const MISSING_EMAIL = "Enter an email address.";

/** The "Sign in as" form's "Other email" (sample mode). */
export const signInAsSchema = z.object({
  email: z
    .string({ required_error: MISSING_EMAIL, invalid_type_error: MISSING_EMAIL })
    .trim()
    .min(1, MISSING_EMAIL)
    .email("Enter a valid email address, like name@example.com."),
});
