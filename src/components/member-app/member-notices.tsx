"use client";

import { usePathname } from "next/navigation";

import { isFocusScreen } from "./member-menu";
import { useDismissible } from "./use-dismissible";

/** One notice as the banner shows it: its id, for "Dismiss", and what it says. */
export interface ShownNotice {
  id: string;
  text: string;
}

interface MemberNoticesProps {
  /** The Member's notices to show, newest first, read on the server for this render. */
  notices: ShownNotice[];
  /** The Server Action that dismisses one of the signed-in Member's notices for good. */
  dismiss: (noticeId: string) => Promise<{ ok: boolean }>;
}

const UNDISMISSED = "Couldn’t dismiss this notice. Try again.";

/**
 * The Member App's in-app notices (ticket 17; spec, Phase 3 planning
 * decisions → In-app notices; stories 131, 133h and 133j): one dismissible
 * banner per grant, extension or end of the Member's access, above every
 * screen but the focus screens, which keep studying uninterrupted. There's no
 * email and no notification centre.
 *
 * "Dismiss" hides the notice at once and tells the server, which keeps it
 * dismissed on every device; should the server not answer, the notice comes
 * back with a message. Focus moves to the next notice, or to the screen's
 * heading after the last.
 */
export function MemberNotices({ notices, dismiss }: MemberNoticesProps) {
  const pathname = usePathname();
  const { list, isDismissed, failed, onDismiss } = useDismissible(dismiss);

  const shown = notices.filter(({ id }) => !isDismissed(id));
  if (shown.length === 0 || isFocusScreen(pathname)) return null;

  return (
    <section
      aria-label="Notices"
      className="mx-auto w-full max-w-5xl px-4 pt-4 wide:px-10 wide:pt-6"
    >
      <ul ref={list} className="flex flex-col gap-2">
        {shown.map((notice, index) => (
          <li
            key={notice.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-[1.5px] border-ayc-blue bg-ayc-paper py-1.5 pr-1.5 pl-3.5"
          >
            <span className="font-mono text-[10px] font-bold tracking-[0.08em] text-ayc-blue">
              NOTICE
            </span>
            <p className="min-w-0 flex-1 text-sm font-semibold">{notice.text}</p>
            <button
              type="button"
              data-dismiss
              aria-label={`Dismiss: ${notice.text}`}
              onClick={() => onDismiss(notice.id, index)}
              className="min-h-11 cursor-pointer px-3 text-sm font-bold text-ayc-blue underline-offset-2 hover:underline"
            >
              Dismiss
            </button>
            {failed === notice.id ? (
              <p role="alert" className="w-full pb-1 text-sm font-semibold text-destructive">
                {UNDISMISSED}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
