// What a test's stand-in for Next's `redirect()` throws: every one is
// `redirect: (url) => { throw new Error(`NEXT_REDIRECT ${url}`); }`.
// `expect(…).rejects.toThrow(redirectsTo(url))` passes only when the message
// is exactly that, so a redirect to any other URL fails. It compares the
// message, not a pattern, so nothing in the URL needs escaping.
export const redirectsTo = (url: string): Error => new Error(`NEXT_REDIRECT ${url}`);
