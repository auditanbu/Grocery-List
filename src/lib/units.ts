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

/**
 * Snaps an arbitrary value onto the unit's step grid, clamped at the
 * minimum — except an explicit 0 (or a non-positive/invalid input) is left
 * as exactly 0, since that's the deliberate "on the list, quantity not
 * decided yet" state rather than a rounding artifact.
 */
export function normalizeQty(value: number, unit: UnitType): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
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

/** The larger unit a small unit promotes to once it reaches 1000 (g/ml -> kg/L). */
const UNIT_PROMOTE_TO: Partial<Record<UnitType, UnitType>> = {
  G: "KG",
  ML: "L",
};

/** How many small units (g/ml) make one big unit (kg/L). */
const UNIT_PROMOTE_FACTOR = 1000;

/**
 * Snaps a quantity onto its unit's step grid and, for g/ml, promotes to
 * kg/L once the amount reaches 1000 (e.g. 1000 g -> 1.0 kg) so large
 * quantities read the way people actually write them.
 */
export function normalizeWithUnit(
  value: number,
  unit: UnitType,
): { quantity: number; unit: UnitType } {
  const normalized = normalizeQty(value, unit);
  const bigUnit = UNIT_PROMOTE_TO[unit];
  if (bigUnit && normalized >= UNIT_PROMOTE_FACTOR) {
    return { quantity: roundQty(normalized / UNIT_PROMOTE_FACTOR, bigUnit), unit: bigUnit };
  }
  return { quantity: normalized, unit };
}

/** One step up, promoting g/ml to kg/L at the 1000 boundary. */
export function incrementWithUnit(
  value: number,
  unit: UnitType,
): { quantity: number; unit: UnitType } {
  return normalizeWithUnit(increment(value, unit), unit);
}

/** The smaller unit kg/L reads as once an amount drops under 1 (kg -> g, L -> ml). */
const UNIT_DEMOTE_TO: Partial<Record<UnitType, UnitType>> = {
  KG: "G",
  L: "ML",
};

/**
 * How a quantity should actually be displayed: kg/L amounts under 1 read
 * as g/ml instead (0.5 kg -> 500 g) — the inverse of the g/ml -> kg/L
 * promotion at the 1000 boundary. Doesn't touch the stored quantity/unit,
 * only what's shown.
 */
export function displayUnitFor(value: number, unit: UnitType): { quantity: number; unit: UnitType } {
  const smallUnit = UNIT_DEMOTE_TO[unit];
  if (smallUnit && value > 0 && value < 1) {
    return { quantity: roundQty(value * UNIT_PROMOTE_FACTOR, smallUnit), unit: smallUnit };
  }
  return { quantity: value, unit };
}

/** "0.5", "150", "10", "3", "1" (never a trailing ".0") — no unit suffix. */
export function formatQtyValue(value: number, unit: UnitType): string {
  const fixed = value.toFixed(UNIT_PRECISION[unit]);
  return fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
}

/**
 * A pack size: what one of a countable item contains — a 200 g tube of
 * paste, a 500 ml bottle of dish wash. Kept apart from the quantity, which
 * counts packs: at the shop the number of tubes rarely changes, the size on
 * the shelf does.
 */
export type PackSize = { value: number; unit: UnitType };

/** A size is always a measure — never a count of things or a rupee amount. */
export const SIZE_UNITS: UnitType[] = ["G", "ML", "KG", "L"];

/** Pairs the two nullable columns a size is stored in back into one value. */
export function sizeOf(
  value: number | null | undefined,
  unit: UnitType | null | undefined,
): PackSize | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return null;
  if (!unit) return null;
  return { value, unit };
}

/**
 * Sizes are whatever the packet says (75 g, 200 g, 1.5 L), so unlike a
 * quantity they are never snapped onto the unit's step grid — only rounded
 * to the two decimals the column stores.
 */
export function roundSize(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * What a row actually amounts to: packs × pack size (2 × 200 g = 400 g).
 * Anything sold loose has no size and its quantity is already the measure.
 *
 * This is the figure every price comparison runs on, which is what keeps a
 * size changed at the shop honest: ₹95 for 150 g is dearer than ₹95 for
 * 200 g, even though both are "one tube for ₹95".
 */
export function totalAmount(
  quantity: number,
  unit: UnitType,
  size: PackSize | null,
): { quantity: number; unit: UnitType } {
  if (!size || unit !== "COUNT") return { quantity, unit };
  return { quantity: roundQty(quantity * size.value, size.unit), unit: size.unit };
}

/** "200 g" for a single pack, "2 × 200 g" for more, plain "2 kg" when loose. */
export function formatQtyWithSize(
  quantity: number,
  unit: UnitType,
  size: PackSize | null,
): string {
  if (!size || unit !== "COUNT") return formatQty(quantity, unit);
  const sizeText = formatQty(size.value, size.unit);
  return quantity === 1 ? sizeText : `${formatQtyValue(quantity, unit)} × ${sizeText}`;
}

/**
 * An item's name carrying the size it is sold in — "3 ரோசஸ் டீ தூள் - 500 g".
 *
 * A packet item's name says nothing about how much is in the packet, and
 * that is exactly what you are pricing at the shelf, so the size travels
 * with the name wherever the row is about one item: the shopping list and
 * the purchase sheet. Loose items measure out in their quantity and get
 * the name on its own.
 */
export function formatNameWithSize(name: string, size: PackSize | null): string {
  return size ? `${name} - ${formatQty(size.value, size.unit)}` : name;
}

/** "500 g", "1 kg", "1.5 kg", "₹10", "3" — kg/L under 1 shown as g/ml. */
export function formatQty(value: number, unit: UnitType): string {
  const display = displayUnitFor(value, unit);
  const amount = formatQtyValue(display.quantity, display.unit);
  if (display.unit === "COUNT") return amount;
  if (display.unit === "RS") return `₹${amount}`;
  return `${amount} ${UNIT_LABEL[display.unit]}`;
}

export function formatPrice(value: number): string {
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Groups unit types that can be fairly converted between each other for
 * price comparison — g and kg are both "weight" (base unit: grams), ml and
 * L are both "volume" (base unit: ml). Rs and countable items have no
 * smaller/larger unit to convert to or from.
 */
type UnitGroup = "weight" | "volume" | "count" | "currency";

const UNIT_GROUP: Record<UnitType, UnitGroup> = {
  KG: "weight",
  G: "weight",
  L: "volume",
  ML: "volume",
  RS: "currency",
  COUNT: "count",
};

/** How many of the unit's base measure (grams, ml) one unit amounts to. */
const BASE_UNIT_FACTOR: Record<UnitType, number> = {
  KG: 1000,
  G: 1,
  L: 1000,
  ML: 1,
  RS: 1,
  COUNT: 1,
};

export function unitGroup(unit: UnitType): UnitGroup {
  return UNIT_GROUP[unit];
}

/**
 * The pack sizes a rate can be quoted against, in base units (grams, ml),
 * in the order the purchase sheet cycles through them. Per kg leads because
 * it is how shelf labels are written; the smaller sizes are how the shop
 * actually quotes you when you are buying 200 g of masala.
 */
export const RATE_BASIS_ORDER = [1000, 500, 250, 100] as const;

export type RateBasis = (typeof RATE_BASIS_ORDER)[number];

export const DEFAULT_RATE_BASIS: RateBasis = 1000;

/**
 * How a basis reads next to a rate: "kg", "500 g", "L", "100 ml". Null for
 * countable and RS-priced items, which have no pack size to quote against —
 * a countable rate is "each" whatever the basis says.
 */
export function rateBasisLabel(unit: UnitType, basis: RateBasis): string | null {
  switch (unitGroup(unit)) {
    case "weight":
      return basis === 1000 ? "kg" : `${basis} g`;
    case "volume":
      return basis === 1000 ? "L" : `${basis} ml`;
    default:
      return null;
  }
}

/** Price per base unit (per gram, per ml, per item) — the fair basis for comparison. */
export function unitPriceOf(price: number, quantity: number, unit: UnitType): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0) return null;
  return price / (quantity * BASE_UNIT_FACTOR[unit]);
}

/**
 * What a shelf label works out to for a whole row, and how that label reads.
 *
 * The sticker on the shelf prices *one* — one soap, one kilo — while the list
 * counts eight of them, and doing that multiplication in your head at the
 * shelf is where a wrong price gets into the history. So the figure is typed
 * as it is read and multiplied out from the row's own quantity.
 *
 * Countable rows take the typed price per pack. Weighed rows take it as a
 * rate against `basis` — per kg by default, or per 500/250/100 g when that is
 * what the shop is quoting — and project it onto the amount on the list.
 *
 * Null when there is nothing to work out: an RS-priced row, whose "quantity"
 * is already rupees, or a quantity that is not a real amount.
 */
export function totalFromShelfPrice(
  shelfPrice: number,
  quantity: number,
  unit: UnitType,
  basis: RateBasis = DEFAULT_RATE_BASIS,
): { total: number; label: string } | null {
  if (!Number.isFinite(shelfPrice) || shelfPrice <= 0) return null;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const group = unitGroup(unit);
  if (group === "currency") return null;
  if (group === "count") return { total: roundMoney(shelfPrice * quantity), label: "each" };

  const label = rateBasisLabel(unit, basis);
  if (label === null) return null;
  // `basis` counts base units — grams for a weight, ml for a volume — which
  // is exactly the amount the typed rate is the price of.
  const total = projectPrice(
    shelfPrice,
    basis,
    group === "weight" ? "G" : "ML",
    quantity,
    unit,
  );
  return total === null ? null : { total: roundMoney(total), label: `/${label}` };
}

/** Money never carries more than paise, and never float noise. */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The per-unit price in the unit people actually quote: per kg for weights,
 * per L for volumes, "each" for countables. Returns null when there is no
 * sensible figure — a missing quantity, or an RS-priced item, where the
 * "quantity" is already rupees and a unit price of 1.00 says nothing.
 *
 * Deliberately normalised up to kg/L rather than down to g/ml by default:
 * shelf labels and shop conversation are "₹420 a kilo", never "₹0.42 a
 * gram". `basis` quotes it against a smaller pack instead — ₹420/kg is
 * ₹42.00/100 g, which is the figure you need when you are buying 200 g.
 */
export function formatUnitPrice(
  price: number,
  quantity: number,
  unit: UnitType,
  basis: RateBasis = DEFAULT_RATE_BASIS,
): string | null {
  const group = unitGroup(unit);
  if (group === "currency") return null;

  const perBase = unitPriceOf(price, quantity, unit);
  if (perBase === null) return null;

  const basisLabel = rateBasisLabel(unit, basis);
  const [amount, suffix]: [number, string] =
    basisLabel !== null ? [perBase * basis, `/${basisLabel}`] : [perBase, " each"];

  // Sub-₹100 unit prices need the paise; above that they are noise.
  const digits = amount >= 100 ? 0 : 2;
  const formatted = amount.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `₹${formatted}${suffix}`;
}

/**
 * What `price` (paid for `quantity` of `unit`) works out to at
 * `targetQuantity` of `targetUnit` — e.g. "this month's 150 g at today's
 * price would have cost ₹X at last month's 200 g". Returns null when the
 * two units aren't in the same group (nothing sensible to project, e.g.
 * comparing a weight to a count).
 */
export function projectPrice(
  price: number,
  quantity: number,
  unit: UnitType,
  targetQuantity: number,
  targetUnit: UnitType,
): number | null {
  if (unitGroup(unit) !== unitGroup(targetUnit)) return null;
  const perBase = unitPriceOf(price, quantity, unit);
  if (perBase === null) return null;
  return perBase * targetQuantity * BASE_UNIT_FACTOR[targetUnit];
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
