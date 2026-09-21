/**
 * Deciding which price-history rows look like testing leftovers — kept free
 * of the database so the judgement can be exercised on made-up rows.
 *
 * Used by prisma/audit-prices.ts; see that file for what each reason means.
 */
import { unitGroup, unitPriceOf, type UnitType } from "../src/lib/units.js";

/** How far off the median a price must be before it is worth your attention. */
export const OUTLIER_FACTOR = 4;
/** Prices for one item closer together than this were not two shopping trips. */
export const RAPID_WINDOW_MINUTES = 10;
/** Mirrors DEMO_ITEM_COUNT in seed.ts. */
export const DEMO_ITEM_COUNT = 10;
const TEST_NAME = /\b(test|testing|demo|sample|dummy|trial|temp|tmp|check)\b/i;

export type Reason = "orphan" | "demo" | "test-list" | "outlier" | "conflict" | "rapid";

export type Row = {
  id: number;
  itemId: number;
  price: number;
  quantity: number;
  unitType: UnitType;
  purchasedAt: Date;
  itemName: string;
  shopName: string | null;
  listName: string | null;
  /** Per base unit (gram, ml, piece) — the only fair way to compare sizes. */
  unitPrice: number | null;
};

/** The seeder's price ladder, reproduced so its rows can be recognised. */
function demoPrices(unitType: string): Set<number> {
  const base: Record<string, number> = {
    KG: 120,
    G: 60,
    L: 130,
    ML: 70,
    RS: 20,
    COUNT: 45,
  };
  const start = base[unitType] ?? 50;
  const prices = new Set<number>();
  for (let index = 0; index < DEMO_ITEM_COUNT; index += 1) {
    const price = start + index * 7;
    prices.add(price);
    // The current-month demo list nudges the first three by these deltas.
    if (index < 3) for (const delta of [13, -9, 0]) prices.add(price + delta);
  }
  return prices;
}

function demoQty(unitType: string): number {
  return unitType === "G" || unitType === "ML" ? 100 : 1;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** How many times apart two prices are, whichever way round they came. */
function ratio(a: number, b: number): number {
  if (a <= 0 || b <= 0) return Infinity;
  return a > b ? a / b : b / a;
}

/**
 * The whole judgement, kept apart from the database so it can be exercised
 * on made-up rows: every row in, every row that looks like a leftover out.
 */
export function findSuspectRows(
  rows: Row[],
  demoItemIds: Set<number>,
): (Row & { reasons: Reason[] })[] {
  const reasons = new Map<number, Set<Reason>>();
  const flag = (id: number, reason: Reason) => {
    const set = reasons.get(id) ?? new Set<Reason>();
    set.add(reason);
    reasons.set(id, set);
  };

  for (const row of rows) {
    if (row.listName === null) flag(row.id, "orphan");
    if (row.listName && TEST_NAME.test(row.listName)) flag(row.id, "test-list");
    if (
      demoItemIds.has(row.itemId) &&
      row.quantity === demoQty(row.unitType) &&
      demoPrices(row.unitType).has(row.price)
    ) {
      flag(row.id, "demo");
    }
  }

  // Per item: compare like with like (g against kg, ml against L) and let
  // the item's own history say what a normal price for it looks like.
  const byItem = new Map<number, Row[]>();
  for (const row of rows) {
    byItem.set(row.itemId, [...(byItem.get(row.itemId) ?? []), row]);
  }

  for (const itemRows of byItem.values()) {
    const groups = new Map<string, Row[]>();
    for (const row of itemRows) {
      if (row.unitPrice === null || row.unitType === "RS") continue;
      const key = unitGroup(row.unitType);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    for (const group of groups.values()) {
      if (group.length === 2) {
        const [first, second] = group;
        if (ratio(first.unitPrice!, second.unitPrice!) >= OUTLIER_FACTOR) {
          flag(first.id, "conflict");
          flag(second.id, "conflict");
        }
        continue;
      }
      if (group.length < 3) continue;
      for (const row of group) {
        const others = group
          .filter((other) => other.id !== row.id)
          .map((other) => other.unitPrice!);
        if (ratio(row.unitPrice!, median(others)) >= OUTLIER_FACTOR) flag(row.id, "outlier");
      }
    }

    // Two prices for one item minutes apart. recordPurchase() keeps only one
    // row per item per list, so this can only be two different lists — and
    // nobody shops the same item onto two lists in the same ten minutes.
    const sorted = [...itemRows].sort((a, b) => a.purchasedAt.getTime() - b.purchasedAt.getTime());
    for (let index = 1; index < sorted.length; index += 1) {
      const earlier = sorted[index - 1];
      const later = sorted[index];
      const gap = later.purchasedAt.getTime() - earlier.purchasedAt.getTime();
      if (gap > RAPID_WINDOW_MINUTES * 60_000) continue;
      // One list name on both means a bulk import or the seeder wrote them
      // together, which says nothing about either row on its own.
      if (earlier.listName !== null && earlier.listName === later.listName) continue;
      flag(earlier.id, "rapid");
      flag(later.id, "rapid");
    }
  }

  return rows
    .filter((row) => reasons.has(row.id))
    .map((row) => ({ ...row, reasons: [...reasons.get(row.id)!] }));
}
