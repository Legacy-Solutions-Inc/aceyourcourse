import type { ProductFormat } from "@/services/catalogue.types";

/** The label Visitors see for each Product format. */
const LABELS = {
  "flash-cards": "Flash cards",
  notebook: "Notebook",
  posters: "Posters",
  bundle: "Bundle",
} satisfies Record<ProductFormat, string>;

export function productFormatLabel(format: ProductFormat): string {
  return LABELS[format];
}
