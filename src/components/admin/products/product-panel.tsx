import type { AdminProductRow } from "@/services/admin.types";

interface ProductPanelProps {
  /** The selected Product's id, "new", or null. */
  selected: string | null;
  /** The selected Product's row, or null when it isn't in the catalogue. */
  row: AdminProductRow | null;
}

/**
 * The right-hand panel (mockup 177–228). The product editor fills it in ticket
 * 05; until then it names the selection, or asks for one.
 */
export function ProductPanel({ selected, row }: ProductPanelProps) {
  const label =
    selected === "new" ? "NEW PRODUCT" : row ? `EDIT · ${row.shortName.toUpperCase()}` : null;
  return (
    <aside
      aria-label="Product editor"
      className="flex min-w-0 flex-col gap-3 border-[1.5px] bg-ayc-paper p-4"
    >
      {label ? (
        <>
          <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">{label}</p>
          <p className="text-sm text-muted-foreground">The product editor opens here.</p>
        </>
      ) : (
        <>
          <p className="font-bold">Select a product</p>
          <p className="text-sm text-muted-foreground">
            Pick one from the list to edit it, or add a new one.
          </p>
        </>
      )}
    </aside>
  );
}
