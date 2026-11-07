// Prices as the Admin's forms take them: pesos, with or without ₱ and
// thousands commas, at most 2 decimals. The catalogue stores integer centavos.

const NOT_A_PRICE = "ENTER A PRICE IN PESOS, LIKE 1,250";
const NEGATIVE = "A PRICE CAN’T BE BELOW ₱0";
const DECIMALS = "USE AT MOST 2 DECIMALS, LIKE 1,250.50";

/** Below ₱10,000,000, so centavos stay well inside a safe integer. */
const MAX_PESO_DIGITS = 7;

export type ParsedPeso = { ok: true; centavos: number | null } | { ok: false; message: string };

/** Pure: a typed price as centavos, null when blank, or why it isn't a price. */
export function parsePeso(text: string): ParsedPeso {
  const price = text.replace(/[₱,\s]/g, "");
  if (!price) return { ok: true, centavos: null };
  if (/^-\d/.test(price)) return { ok: false, message: NEGATIVE };
  const match = /^(\d+)(?:\.(\d+))?$/.exec(price);
  if (!match) return { ok: false, message: NOT_A_PRICE };
  const [, pesos = "", cents = ""] = match;
  if (cents.length > 2) return { ok: false, message: DECIMALS };
  if (pesos.replace(/^0+(?=\d)/, "").length > MAX_PESO_DIGITS) {
    return { ok: false, message: NOT_A_PRICE };
  }
  return { ok: true, centavos: Number(pesos) * 100 + Number(cents.padEnd(2, "0")) };
}

const groupedPesos = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });

/** Pure: centavos as the form shows them, "1,250" or "1,249.50"; blank for none. */
export function pesoText(centavos: number | null): string {
  if (centavos === null) return "";
  const pesos = groupedPesos.format(Math.floor(centavos / 100));
  const cents = centavos % 100;
  return cents === 0 ? pesos : `${pesos}.${String(cents).padStart(2, "0")}`;
}
