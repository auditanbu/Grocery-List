import "server-only";

import { prisma } from "./prisma";
import type {
  CategoryDTO,
  ListDetailDTO,
  ListItemDTO,
  ListSummaryDTO,
  MasterItemDTO,
  PriceHistoryDTO,
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

/**
 * Latest recorded price per item, ignoring one list (the one being shopped)
 * so an item re-priced today still compares against the previous month.
 */
async function lastPriceMap(itemIds: number[], excludeListId?: number) {
  if (itemIds.length === 0) return new Map<number, { price: number; at: Date }>();

  const rows = await prisma.priceHistory.findMany({
    where: {
      itemId: { in: itemIds },
      ...(excludeListId ? { NOT: { listId: excludeListId } } : {}),
    },
    orderBy: { purchasedAt: "desc" },
    select: { itemId: true, price: true, purchasedAt: true },
  });

  const map = new Map<number, { price: number; at: Date }>();
  for (const row of rows) {
    if (!map.has(row.itemId)) {
      map.set(row.itemId, { price: num(row.price), at: row.purchasedAt });
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
            OR: [{ nameEn: { contains: search } }, { nameTa: { contains: search } }],
          }
        : {}),
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { nameEn: "asc" }],
    take: options?.take,
    include: { category: true, shop: true },
  });

  const prices = await lastPriceMap(items.map((item) => item.id));

  return items.map((item) => ({
    id: item.id,
    nameEn: item.nameEn,
    nameTa: item.nameTa,
    unitType: item.unitType,
    defaultQty: num(item.defaultQty),
    categoryId: item.categoryId,
    categoryName: item.category.nameEn,
    categoryNameTa: item.category.nameTa,
    shopId: item.shopId,
    shopName: item.shop?.name ?? null,
    isActive: item.isActive,
    lastPrice: prices.get(item.id)?.price ?? null,
    lastPriceAt: prices.get(item.id)?.at.toISOString() ?? null,
  }));
}

export async function getLists(): Promise<ListSummaryDTO[]> {
  const lists = await prisma.groceryList.findMany({
    orderBy: { monthKey: "desc" },
    include: { items: { select: { isPurchased: true, purchasePrice: true } } },
  });

  return lists.map(toSummary);
}

function toSummary(list: {
  id: number;
  name: string;
  monthKey: string;
  status: ListSummaryDTO["status"];
  createdAt: Date;
  items: { isPurchased: boolean; purchasePrice: DecimalLike }[];
}): ListSummaryDTO {
  return {
    id: list.id,
    name: list.name,
    monthKey: list.monthKey,
    status: list.status,
    itemCount: list.items.length,
    purchasedCount: list.items.filter((item) => item.isPurchased).length,
    totalSpent: list.items.reduce((sum, item) => sum + num(item.purchasePrice), 0),
    createdAt: list.createdAt.toISOString(),
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

  const items: ListItemDTO[] = list.items.map((row) => ({
    id: row.id,
    itemId: row.itemId,
    nameEn: row.item.nameEn,
    nameTa: row.item.nameTa,
    categoryName: row.item.category.nameEn,
    unitType: row.unitType,
    quantity: num(row.quantity),
    shopId: row.shopId,
    shopName: row.shop?.name ?? null,
    isPurchased: row.isPurchased,
    purchasePrice: numOrNull(row.purchasePrice),
    previousPrice: numOrNull(row.previousPrice),
    lastPrice: prices.get(row.itemId)?.price ?? null,
  }));

  return {
    ...toSummary(list),
    items,
    shops: await getShops(),
  };
}

/** The list for the current month, if one has been started. */
export async function getListByMonth(monthKey: string) {
  const list = await prisma.groceryList.findUnique({
    where: { monthKey },
    include: { items: { select: { isPurchased: true, purchasePrice: true } } },
  });
  return list ? toSummary(list) : null;
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
    purchasedAt: row.purchasedAt.toISOString(),
    shopName: row.shop?.name ?? null,
    listName: row.list?.name ?? null,
  }));
}

/** Items whose latest two prices differ — powers the History screen. */
export async function getRecentPriceChanges(limit = 12) {
  const rows = await prisma.priceHistory.findMany({
    orderBy: { purchasedAt: "desc" },
    take: 400,
    include: { item: true },
  });

  const byItem = new Map<number, typeof rows>();
  for (const row of rows) {
    byItem.set(row.itemId, [...(byItem.get(row.itemId) ?? []), row]);
  }

  const changes = [...byItem.values()]
    .filter((entries) => entries.length >= 2)
    .map((entries) => {
      const [latest, previous] = entries;
      return {
        itemId: latest.itemId,
        nameEn: latest.item.nameEn,
        nameTa: latest.item.nameTa,
        unitType: latest.unitType,
        current: num(latest.price),
        previous: num(previous.price),
        purchasedAt: latest.purchasedAt.toISOString(),
      };
    })
    .filter((change) => change.current !== change.previous)
    .sort(
      (a, b) =>
        Math.abs(b.current - b.previous) / b.previous -
        Math.abs(a.current - a.previous) / a.previous,
    );

  return changes.slice(0, limit);
}
