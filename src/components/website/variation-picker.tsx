"use client";

import { createContext, useContext, useId, useState } from "react";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { variationLabel } from "@/lib/catalogue/price";
import { formatPeso } from "@/lib/money";
import type { ProductVariation } from "@/services/catalogue.types";

// The picked variation is only a guide to the price: the store buttons don't
// carry it to the Marketplace, and there are no stock labels because the
// Marketplaces own the stock. It is shared so every price on the page (the
// price row and the buy-box header) follows it.

interface Selection {
  variations: ProductVariation[];
  /** "" until the Visitor picks; otherwise the picked variation's index. */
  selected: string;
  select: (value: string) => void;
}

const SelectionContext = createContext<Selection | null>(null);

export function VariationProvider({
  variations,
  children,
}: {
  variations: ProductVariation[];
  children: React.ReactNode;
}) {
  const [selected, select] = useState("");
  return (
    <SelectionContext.Provider value={{ variations, selected, select }}>
      {children}
    </SelectionContext.Provider>
  );
}

/** The picked variation's price, or `fallback` (the range) until one is picked. */
export function SelectedPrice({ fallback }: { fallback: string }) {
  const selection = useContext(SelectionContext);
  // "" is "nothing picked", not index 0.
  const picked =
    selection && selection.selected !== ""
      ? selection.variations[Number(selection.selected)]
      : undefined;
  return <>{picked ? formatPeso(picked.price) : fallback}</>;
}

/** The variations as a radio group. Must sit inside a VariationProvider. */
export function VariationPicker() {
  const selection = useContext(SelectionContext);
  const labelId = useId();
  if (!selection) throw new Error("VariationPicker must be inside a VariationProvider");

  return (
    <div className="flex flex-col gap-2.5">
      <p
        id={labelId}
        className="font-mono text-xs font-medium tracking-[0.06em] text-ayc-slate uppercase"
      >
        Variation
      </p>
      <RadioGroup
        aria-labelledby={labelId}
        value={selection.selected}
        onValueChange={selection.select}
        className="gap-2.5"
      >
        {selection.variations.map((variation, index) => {
          const id = `${labelId}-${index}`;
          const label = variationLabel(variation.name);
          return (
            <label
              key={variation.name}
              htmlFor={id}
              className="flex min-h-13 cursor-pointer items-center gap-3.5 border-[1.5px] border-ayc-navy bg-ayc-paper px-4 py-3 has-data-[state=checked]:border-2 has-data-[state=checked]:border-ayc-blue"
            >
              <RadioGroupItem
                id={id}
                value={String(index)}
                aria-label={`${label} ${formatPeso(variation.price)}`}
                className="size-4.5 border-2 border-ayc-blue text-ayc-blue [&_svg]:fill-ayc-blue"
              />
              <span className="min-w-0 flex-1 font-mono text-[13px] font-bold">{label}</span>
              <span className="text-[17px] font-extrabold">{formatPeso(variation.price)}</span>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
