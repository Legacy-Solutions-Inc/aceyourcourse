import type { AdminError } from "@/services/admin.types";

// What the Users panels on a Member's detail page (force sign-out; grant,
// extend and end access) say when the server didn't do what was asked.
// Pure.

/** What a panel says when the server couldn't be reached: nothing changed. */
export const UNREACHABLE = "Couldn’t reach the server, so nothing was changed.";

/** Pure: what a panel says about a refusal that isn't one field's. */
export function refusalText(error: AdminError): string {
  switch (error.kind) {
    case "invalid":
      return error.formError ?? "Nothing was changed.";
    case "forbidden":
      return error.message;
    case "not-found":
      return "This Member isn’t there any more, so nothing was changed.";
    case "conflict":
      return "Nothing was changed. Reload the page and try again.";
  }
}
