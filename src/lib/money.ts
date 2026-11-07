/**
 * Money is stored in centavos as integers and displayed in ₱ with en-PH
 * formatting (see docs/specs/2026-10-29-ayc-v1.md → Architecture).
 */

const wholePeso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const pesoWithCentavos = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Pure: format an integer centavo amount as pesos. Decimals appear only when
 * the amount is not a whole peso: 120000 → "₱1,200", 124950 → "₱1,249.50".
 * Throws a RangeError for a fractional or non-finite amount.
 */
export function formatPeso(centavos: number): string {
  if (!Number.isInteger(centavos)) {
    throw new RangeError(`formatPeso expects whole centavos, got ${centavos}`);
  }
  const pesos = centavos / 100;
  return centavos % 100 === 0 ? wholePeso.format(pesos) : pesoWithCentavos.format(pesos);
}
