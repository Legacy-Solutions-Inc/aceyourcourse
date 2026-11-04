interface GoogleSignInFormProps {
  /** The sanitised `next`, sent back with the form. */
  next: string;
  action: (formData: FormData) => Promise<void>;
}

/**
 * Live mode's "Continue with Google" (ticket 16): a plain form, so it works
 * before any JavaScript loads. Its action sends the browser to Google.
 */
export function GoogleSignInForm({ next, action }: GoogleSignInFormProps) {
  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
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
    </form>
  );
}
