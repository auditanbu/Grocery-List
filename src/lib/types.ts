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
  /** Tamil name in Latin script ("Kadalai Paruppu"); null when not supplied yet. */
  nameTl: string | null;
  unitType: UnitType;
  defaultQty: number;
  categoryId: number;
  categoryName: string;
  categoryNameTa: string | null;
  shopId: number | null;
  shopName: string | null;
  isActive: boolean;
  /** Sold in inconsistent pack sizes — allows quantity/unit edits while shopping. */
  hasVariableUnit: boolean;
  /** Most recent price paid, across all past lists. */
  lastPrice: number | null;
  lastPriceAt: string | null;
};

export type ListItemDTO = {
  id: number;
  itemId: number;
  nameEn: string;
  nameTa: string;
  /** Tamil name in Latin script ("Kadalai Paruppu"); null when not supplied yet. */
  nameTl: string | null;
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
  /** Quantity/unit that previousPrice was paid for, for a fair comparison. */
  previousQuantity: number | null;
  previousUnitType: UnitType | null;
  /** Latest price from any earlier list — shown before the item is bought. */
  lastPrice: number | null;
  /** Quantity/unit that lastPrice was paid for, for a fair comparison. */
  lastPriceQuantity: number | null;
  lastPriceUnitType: UnitType | null;
  /** Sold in inconsistent pack sizes — allows quantity/unit edits while shopping. */
  hasVariableUnit: boolean;
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

/** The list a draft can be seeded from — the newest list of an earlier month. */
export type CopySourceDTO = {
  id: number;
  name: string;
  monthKey: string;
  /** Rows worth copying (quantity > 0, master item still active). */
  itemCount: number;
};

export type ListDetailDTO = ListSummaryDTO & {
  items: ListItemDTO[];
  shops: ShopDTO[];
  /** Only populated for DRAFT lists; null when there is nothing to copy. */
  copySource: CopySourceDTO | null;
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
