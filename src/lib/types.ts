import type { ListStatus } from "@/generated/prisma/enums";
import type { UnitType } from "./units";

export type { ListStatus };

/**
 * Prisma returns Decimal instances, which cannot cross the server/client
 * boundary. Every query in `queries.ts` maps rows onto these plain shapes.
 */

export type ShopDTO = {
  id: number;
  name: string;
};

export type CategoryDTO = {
  id: number;
  nameEn: string;
  nameTa: string | null;
};

export type MasterItemDTO = {
  id: number;
  nameEn: string;
  nameTa: string;
  unitType: UnitType;
  defaultQty: number;
  categoryId: number;
  categoryName: string;
  categoryNameTa: string | null;
  shopId: number | null;
  shopName: string | null;
  isActive: boolean;
  /** Most recent price paid, across all past lists. */
  lastPrice: number | null;
  lastPriceAt: string | null;
};

export type ListItemDTO = {
  id: number;
  itemId: number;
  nameEn: string;
  nameTa: string;
  categoryId: number;
  categoryName: string;
  categoryNameTa: string | null;
  unitType: UnitType;
  quantity: number;
  shopId: number | null;
  shopName: string | null;
  isPurchased: boolean;
  purchasePrice: number | null;
  /** Snapshot taken when the item was checked off. */
  previousPrice: number | null;
  /** Latest price from any earlier list — shown before the item is bought. */
  lastPrice: number | null;
};

export type ListSummaryDTO = {
  id: number;
  name: string;
  monthKey: string;
  status: ListStatus;
  itemCount: number;
  purchasedCount: number;
  totalSpent: number;
  createdAt: string;
};

export type ListDetailDTO = ListSummaryDTO & {
  items: ListItemDTO[];
  shops: ShopDTO[];
};

export type PriceHistoryDTO = {
  id: number;
  price: number;
  quantity: number;
  unitType: UnitType;
  purchasedAt: string;
  shopName: string | null;
  listName: string | null;
};
