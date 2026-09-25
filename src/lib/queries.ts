import "server-only";

import { prisma } from "./prisma";
import { projectPrice, sizeOf, totalAmount, type UnitType } from "./units";
import type {
  CategoryDTO,
  CopySourceDTO,
  ListDetailDTO,
  ListItemDTO,
  ListSummaryDTO,
  MasterItemDTO,
  PriceHistoryDTO,
  PriceMoveDTO,
  ShopDTO,
} from "./types";

type DecimalLike = { toNumber(): number } | number | null | undefined;

function num(value: DecimalLike): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

function numOrNull(value: DecimalLike): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : value.toNumber();
}

type LastPriceEntry = {
  price: number;
  at: Date;
  quantity: number;
  unitType: UnitType;
  sizeValue: number | null;
  sizeUnit: UnitType | null;
  shopName: string | null;
};

/**
 * Latest recorded price per item, ignoring one list (the one being shopped)
 * so an item re-priced today still compares against the previous month.
 */
async function lastPriceMap(itemIds: number[], excludeListId?: number) {
  if (itemIds.length === 0) return new Map<number, LastPriceEntry>();

  const rows = await prisma.priceHistory.findMany({
    where: {
      itemId: { in: itemIds },
      ...(excludeListId ? { NOT: { listId: excludeListId } } : {}),
    },
    orderBy: { purchasedAt: "desc" },
    select: {
      itemId: true,
      price: true,
      purchasedAt: true,
      quantity: true,
      unitType: true,
      sizeValue: true,
      sizeUnit: true,
      shop: { select: { name: true } },
    },
  });

  const map = new Map<number, LastPriceEntry>();
  for (const row of rows) {
    if (!map.has(row.itemId)) {
      map.set(row.itemId, {
        price: num(row.price),
        at: row.purchasedAt,
        quantity: num(row.quantity),
        unitType: row.unitType,
        sizeValue: numOrNull(row.sizeValue),
        sizeUnit: row.sizeUnit,
        shopName: row.shop?.name ?? null,
      });
    }
  }
  return map;
}

export async function getShops(): Promise<ShopDTO[]> {
  const shops = await prisma.shop.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  return shops;
}

export async function getCategories(): Promise<CategoryDTO[]> {
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    select: { id: true, nameEn: true, nameTa: true },
  });
}

export async function getMasterItems(options?: {
  search?: string;
  categoryId?: number;
  shopId?: number;
  includeInactive?: boolean;
  take?: number;
}): Promise<MasterItemDTO[]> {
  const search = options?.search?.trim();

  const items = await prisma.item.findMany({
    where: {
      ...(options?.includeInactive ? {} : { isActive: true }),
      ...(options?.categoryId ? { categoryId: options.categoryId } : {}),
      ...(options?.shopId ? { shopId: options.shopId } : {}),
      // MySQL's default collation (utf8mb4_unicode_ci) is already
      // case-insensitive, so `contains` needs no explicit mode here
      // (unlike Postgres).
      ...(search
        ? {
            OR: [
              { nameEn: { contains: search } },
              { nameTa: { contains: search } },
              { nameTl: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { nameEn: "asc" }],
    take: options?.take,
    include: { category: true, shop: true },
  });

  const prices = await lastPriceMap(items.map((item) => item.id));

  return items.map((item) => {
    const last = prices.get(item.id);
    return {
    id: item.id,
    nameEn: item.nameEn,
    nameTa: item.nameTa,
    nameTl: item.nameTl,
    unitType: item.unitType,
    defaultQty: num(item.defaultQty),
    categoryId: item.categoryId,
    categoryName: item.category.nameEn,
    categoryNameTa: item.category.nameTa,
    shopId: item.shopId,
    shopName: item.shop?.name ?? null,
    isActive: item.isActive,
    sizeValue: numOrNull(item.sizeValue),
    sizeUnit: item.sizeUnit,
    lastPrice: last?.price ?? null,
    lastPriceAt: last?.at.toISOString() ?? null,
    lastPriceQuantity: last?.quantity ?? null,
    lastPriceUnitType: last?.unitType ?? null,
    lastPriceSizeValue: last?.sizeValue ?? null,
    lastPriceSizeUnit: last?.sizeUnit ?? null,
    lastPriceShopName: last?.shopName ?? null,
    };
  });
}

export async function getLists(): Promise<ListSummaryDTO[]> {
  const lists = await prisma.groceryList.findMany({
    orderBy: { monthKey: "desc" },
    include: { items: { select: { isPurchased: true, purchasePrice: true, purchasedAt: true } } },
  });

  return lists.map(toSummary);
}

function toSummary(list: {
  id: number;
  name: string;
  monthKey: string;
  status: ListSummaryDTO["status"];
  createdAt: Date;
  completedAt: Date | null;
  items: { isPurchased: boolean; purchasePrice: DecimalLike; purchasedAt: Date | null }[];
}): ListSummaryDTO {
  // The shopping date is whenever the last thing was actually bought. A list
  // marked complete without any purchase still has completedAt to fall back on.
  const lastPurchase = list.items.reduce<Date | null>(
    (latest, item) =>
      item.purchasedAt && (!latest || item.purchasedAt > latest) ? item.purchasedAt : latest,
    null,
  );

  return {
    id: list.id,
    name: list.name,
    monthKey: list.monthKey,
    status: list.status,
    itemCount: list.items.length,
    purchasedCount: list.items.filter((item) => item.isPurchased).length,
    totalSpent: list.items.reduce((sum, item) => sum + num(item.purchasePrice), 0),
    createdAt: list.createdAt.toISOString(),
    purchasedAt: (lastPurchase ?? list.completedAt)?.toISOString() ?? null,
  };
}

/**
 * A row is worth carrying into next month only if it still means something:
 * quantity 0 is the "check availability" marker the finalize step drops, and a
 * de-activated master item shouldn't come back to life through a copy.
 */
export const COPYABLE_ITEM = { quantity: { gt: 0 }, item: { isActive: true } } as const;

/**
 * The list a draft can be seeded from — the newest list of an *earlier* month
 * that still has copyable rows. monthKey is compared as a string, which is the
 * whole reason it is stored as "YYYY-MM".
 */
export async function getCopySource(monthKey: string): Promise<CopySourceDTO | null> {
  const source = await prisma.groceryList.findFirst({
    where: { monthKey: { lt: monthKey }, items: { some: COPYABLE_ITEM } },
    orderBy: [{ monthKey: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { items: { where: COPYABLE_ITEM } } } },
  });

  if (!source) return null;

  return {
    id: source.id,
    name: source.name,
    monthKey: source.monthKey,
    itemCount: source._count.items,
  };
}

export async function getList(id: number): Promise<ListDetailDTO | null> {
  const list = await prisma.groceryList.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: { item: { include: { category: true } }, shop: true },
      },
    },
  });

  if (!list) return null;

  const prices = await lastPriceMap(
    list.items.map((row) => row.itemId),
    list.id,
  );

  const items: ListItemDTO[] = list.items.map((row) => {
    const last = prices.get(row.itemId);
    return {
      id: row.id,
      itemId: row.itemId,
      nameEn: row.item.nameEn,
      nameTa: row.item.nameTa,
      nameTl: row.item.nameTl,
      categoryId: row.item.categoryId,
      categoryName: row.item.category.nameEn,
      categoryNameTa: row.item.category.nameTa,
      unitType: row.unitType,
      quantity: num(row.quantity),
      sizeValue: numOrNull(row.sizeValue),
      sizeUnit: row.sizeUnit,
      shopId: row.shopId,
      shopName: row.shop?.name ?? null,
      isPurchased: row.isPurchased,
      purchasePrice: numOrNull(row.purchasePrice),
      previousPrice: numOrNull(row.previousPrice),
      previousQuantity: numOrNull(row.previousQuantity),
      previousUnitType: row.previousUnitType,
      previousSizeValue: numOrNull(row.previousSizeValue),
      previousSizeUnit: row.previousSizeUnit,
      lastPrice: last?.price ?? null,
      lastPriceQuantity: last ? last.quantity : null,
      lastPriceUnitType: last ? last.unitType : null,
      lastPriceSizeValue: last ? last.sizeValue : null,
      lastPriceSizeUnit: last ? last.sizeUnit : null,
    };
  });

  return {
    ...toSummary(list),
    items,
    shops: await getShops(),
    // Only a draft can be seeded, so don't pay for the lookup otherwise.
    copySource: list.status === "DRAFT" ? await getCopySource(list.monthKey) : null,
  };
}

export async function getPriceHistory(itemId: number): Promise<PriceHistoryDTO[]> {
  const rows = await prisma.priceHistory.findMany({
    where: { itemId },
    orderBy: { purchasedAt: "desc" },
    take: 24,
    include: { shop: true, list: true },
  });

  return rows.map((row) => ({
    id: row.id,
    price: num(row.price),
    quantity: num(row.quantity),
    unitType: row.unitType,
    sizeValue: numOrNull(row.sizeValue),
    sizeUnit: row.sizeUnit,
    purchasedAt: row.purchasedAt.toISOString(),
    shopName: row.shop?.name ?? null,
    listName: row.list?.name ?? null,
  }));
}

/**
 * Every item with a price on record, newest purchase first — the History
 * screen's whole subject, both the moves it ranks and the items its search
 * reaches.
 *
 * Each item carries its latest purchase and the one before it, already
 * totalled (packs × pack size, as everywhere else). An item bought only
 * once has no `previous` and nothing to compare, which is not a reason to
 * leave it out: what you last paid for it is exactly what you came to look
 * up.
 *
 * Reads the whole table rather than a recent window, because an item that
 * has not been bought for a year is precisely the one you cannot remember
 * the price of. This is one household's shopping — the same order of
 * magnitude as the master catalogue the Master List already ships whole to
 * the browser to be searched.
 */
export async function getPurchasedItems(): Promise<PriceMoveDTO[]> {
  const rows = await prisma.priceHistory.findMany({
    orderBy: { purchasedAt: "desc" },
    select: {
      itemId: true,
      price: true,
      quantity: true,
      unitType: true,
      sizeValue: true,
      sizeUnit: true,
      purchasedAt: true,
      item: {
        select: {
          nameEn: true,
          nameTa: true,
          nameTl: true,
          category: { select: { nameEn: true } },
        },
      },
    },
  });

  const byItem = new Map<number, typeof rows>();
  for (const row of rows) {
    byItem.set(row.itemId, [...(byItem.get(row.itemId) ?? []), row]);
  }

  const amountOf = (row: (typeof rows)[number]) =>
    totalAmount(num(row.quantity), row.unitType, sizeOf(numOrNull(row.sizeValue), row.sizeUnit));

  return [...byItem.values()].map((entries) => {
    const [latest, previous] = entries;
    const current = amountOf(latest);
    const earlier = previous ? amountOf(previous) : null;
    return {
      itemId: latest.itemId,
      nameEn: latest.item.nameEn,
      nameTa: latest.item.nameTa,
      nameTl: latest.item.nameTl,
      categoryName: latest.item.category.nameEn,
      unitType: latest.unitType,
      current: num(latest.price),
      previous: previous ? num(previous.price) : null,
      purchasedAt: latest.purchasedAt.toISOString(),
      // The latest purchase as it was actually made — packs and pack size
      // kept apart, so a row can read "₹690.00 for 2 × 500 g" rather than
      // quoting a price with no amount against it.
      currentRawQuantity: num(latest.quantity),
      currentSizeValue: numOrNull(latest.sizeValue),
      currentSizeUnit: latest.sizeUnit,
      currentQuantity: current.quantity,
      currentUnitType: current.unit,
      previousQuantity: earlier?.quantity ?? null,
      previousUnitType: earlier?.unit ?? null,
      // What the latest price works out to at the earlier amount — the
      // figure the badge shows and the moves list is ranked on. Null when
      // there is nothing to compare, or when the two are not comparable (a
      // weight against a count), which is not a price move anyone can read.
      comparable:
        earlier === null
          ? null
          : projectPrice(
              num(latest.price),
              current.quantity,
              current.unit,
              earlier.quantity,
              earlier.unit,
            ),
    };
  });
}

/**
 * "Biggest price moves": the items whose latest two prices actually differ,
 * steepest first.
 *
 * Ranked on what was bought, never on the raw rupees: ₹690 for two 500 g
 * packets against ₹340 for one is ₹5 dearer a packet, not ₹350 — and
 * ranking on the raw figure floated exactly those rows, where only the
 * amount changed, to the top.
 *
 * Pure, and given the same array the search is handed, so the two cannot
 * drift apart.
 */
export function biggestMoves(items: PriceMoveDTO[], limit = 12): PriceMoveDTO[] {
  return items
    .filter(
      (item) =>
        item.previous !== null &&
        item.previous > 0 &&
        item.comparable !== null &&
        Math.round(Math.abs(item.comparable - item.previous) * 100) >= 1,
    )
    .sort(
      (a, b) =>
        Math.abs((b.comparable as number) - (b.previous as number)) / (b.previous as number) -
        Math.abs((a.comparable as number) - (a.previous as number)) / (a.previous as number),
    )
    .slice(0, limit);
}
