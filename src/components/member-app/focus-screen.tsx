import Link from "next/link";

interface FocusScreenProps {
  /** Where back goes: the item's Subject in the Library, or the Library. */
  back: { href: string; label: string };
  /** The crumb after LIBRARY, such as "MSTC · FLASHCARDS". */
  crumb: string;
  /** What's open, such as the Topic's name: the mobile back bar's second line. */
  title: string;
  children: React.ReactNode;
}

/**
 * A focus screen (BUILD-MAP §2: flashcards, quiz, reviewer…): on desktop a
 * breadcrumb, "LIBRARY / MSTC · FLASHCARDS", above the screen; below 760 px
 * a back bar with ← and a two-line crumb, and no Menu button (the drawer
 * hides itself on these screens). The screen's own heading is the child's.
 */
export function FocusScreen({ back, crumb, title, children }: FocusScreenProps) {
  return (
    <>
      <nav
        aria-label="Back"
        className="flex items-center gap-2.5 border-b-[1.5px] bg-ayc-cream px-3 py-2 wide:hidden"
      >
        <Link
          href={back.href}
          aria-label={back.label}
          className="flex size-11 shrink-0 items-center justify-center border-[1.5px] text-lg font-bold"
        >
          <span aria-hidden="true">←</span>
        </Link>
        <span className="flex min-w-0 flex-col">
          <span className="font-mono text-[10px] font-medium tracking-[0.06em] text-ayc-blue">
            {crumb}
          </span>
          <span className="truncate text-[15px] font-bold">{title}</span>
        </span>
      </nav>
      <main
        id="main"
        className="mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col gap-4 px-4 pt-5 pb-10 wide:gap-6 wide:px-10 wide:pt-10"
      >
        <nav
          aria-label="Breadcrumb"
          className="hidden flex-wrap items-center gap-2 font-mono text-xs font-medium tracking-[0.04em] text-muted-foreground wide:flex"
        >
          <Link href={back.href} className="underline-offset-2 hover:underline">
            LIBRARY
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-foreground">
            {crumb}
          </span>
        </nav>
        {children}
      </main>
    </>
  );
}
