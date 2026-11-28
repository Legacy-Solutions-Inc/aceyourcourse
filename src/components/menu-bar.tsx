import { SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface MenuBarProps {
  /** Names the bar's landmark, such as "Admin menu". */
  label: string;
  /** The logo, with any tag, on the left. */
  brand: React.ReactNode;
  className?: string;
}

/**
 * Below 760 px, the bar across the top of the Admin and the Member App: the
 * logo on the left and the "Menu" button, which opens the drawer, on the
 * right. It stays at the top as the page scrolls, so the button never covers
 * the page or sits on the browser's toolbar. The mockups float the button at
 * the bottom right (Admin 908, Member App L693); the client moved it up.
 * Render it inside the drawer's Sheet.
 */
export function MenuBar({ label, brand, className }: MenuBarProps) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between gap-3 border-b-[1.5px] bg-ayc-sand px-4 wide:hidden",
        className,
      )}
    >
      {brand}
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex h-11 cursor-pointer items-center gap-2.5 border-[1.5px] bg-primary pr-4 pl-3.5 text-sm font-bold text-primary-foreground shadow-hard shadow-ayc-orange focus-visible:outline-ayc-orange"
        >
          <span aria-hidden="true" className="flex flex-col gap-1">
            <span className="h-0.5 w-4 bg-primary-foreground" />
            <span className="h-0.5 w-4 bg-primary-foreground" />
            <span className="h-0.5 w-4 bg-primary-foreground" />
          </span>
          Menu
        </button>
      </SheetTrigger>
    </nav>
  );
}
