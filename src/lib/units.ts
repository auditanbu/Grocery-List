// Relative (not "@/") so the seed/import scripts can import this file directly.
import type { UnitType } from "../generated/prisma/enums";

export type { UnitType };

/**
 * Stepper increments, keyed by unit type.
 *
 *   g, ml            -> 50   (50 → 100 → 150)
 *   kg, L            -> 0.5  (0.5 → 1 → 1.5)
 *   Rs               -> 10   (₹10 → ₹20)
 *   countable (none) -> 1    (1 → 2 → 3)
 */
export const UNIT_STEP: Record<UnitType, number> = {
  G: 50,
  ML: 50,
  KG: 0.5,
  L: 0.5,
  RS: 10,
  COUNT: 1,
};

/** Short suffix shown next to a quantity. Countable items have none. */
export const UNIT_LABEL: Record<UnitType, string> = {
  KG: "kg",
  G: "g",
  L: "L",
  ML: "ml",
  RS: "Rs",
  COUNT: "",
};

/** Decimal places a quantity is rounded/displayed to. */
export const UNIT_PRECISION: Record<UnitType, number> = {
  KG: 1,
  L: 1,
  G: 0,
  ML: 0,
  RS: 0,
  COUNT: 0,
};

export const UNIT_TYPES = Object.keys(UNIT_STEP) as UnitType[];

/** How the unit reads in a picker: "kg", "g", "Rs", "Countable". */
export function unitOptionLabel(unit: UnitType): string {
  return unit === "COUNT" ? "Countable" : UNIT_LABEL[unit];
}

export function stepFor(unit: UnitType): number {
  return UNIT_STEP[unit] ?? 1;
}

/**
 * Quantities never drop below a single step — one step is the smallest
 * meaningful amount to buy (50 g, 0.5 kg, ₹10, 1 piece).
 */
export function minFor(unit: UnitType): number {
  return stepFor(unit);
}

/** Guards against float drift like 0.30000000000000004 when stepping by 0.5. */
export function roundQty(value: number, unit: UnitType): number {
  const factor = 10 ** UNIT_PRECISION[unit];
  return Math.round(value * factor) / factor;
}

/** Snaps an arbitrary value onto the unit's step grid, clamped at the minimum. */
export function normalizeQty(value: number, unit: UnitType): number {
  const step = stepFor(unit);
  const snapped = Math.round(value / step) * step;
  return roundQty(Math.max(snapped, minFor(unit)), unit);
}

export function increment(value: number, unit: UnitType): number {
  return roundQty(value + stepFor(unit), unit);
}

export function decrement(value: number, unit: UnitType): number {
  return roundQty(Math.max(value - stepFor(unit), minFor(unit)), unit);
}

/** "0.5", "150", "10", "3" — no unit suffix. */
export function formatQtyValue(value: number, unit: UnitType): string {
  return value.toFixed(UNIT_PRECISION[unit]);
}

/** "0.5 kg", "150 g", "₹10", "3". */
export function formatQty(value: number, unit: UnitType): string {
  const amount = formatQtyValue(value, unit);
  if (unit === "COUNT") return amount;
  if (unit === "RS") return `₹${amount}`;
  return `${amount} ${UNIT_LABEL[unit]}`;
}

export function formatPrice(value: number): string {
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Maps the spreadsheet's "Qty Type" column onto the UnitType enum.
 * A blank cell means the item is countable.
 */
export function parseUnitType(raw: string | null | undefined): UnitType {
  const value = (raw ?? "").trim().toLowerCase();
  switch (value) {
    case "kg":
    case "kgs":
    case "kilogram":
      return "KG";
    case "g":
    case "gm":
    case "gms":
    case "gram":
    case "grams":
      return "G";
    case "l":
    case "ltr":
    case "litre":
    case "liter":
      return "L";
    case "ml":
      return "ML";
    case "rs":
    case "rs.":
    case "₹":
    case "rupees":
      return "RS";
    default:
      return "COUNT";
  }
}
