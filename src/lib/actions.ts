"use server";

import { revalidatePath } from "next/cache";

import { PrismaClientKnownRequestError } from "@/generated/prisma/internal/prismaNamespace";
import masterData from "../../prisma/data/master-data.json";
import { isAdminSession } from "./admin";
import { prisma } from "./prisma";
import { listNameFor, monthKeyOf } from "./dates";
import { normalizeQty, type UnitType } from "./units";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function revalidateList(listId: number) {
  revalidatePath("/");
  revalidatePath("/history");
  revalidatePath(`/lists/${listId}`);
  revalidatePath(`/lists/${listId}/view`);
  revalidatePath(`/lists/${listId}/shop`);
}

/**
 * Starts a monthly list. Defaults to the current month with a `MMM YYYY`
 * name. A month can hold several lists as long as their names differ —
 * submitting the exact same month + name again just reopens that list
 * instead of creating a duplicate.
 */
export async function createList(input: {
  name?: string;
  monthKey?: string;
}): Promise<ActionResult<{ id: number; existed: boolean }>> {
  const monthKey = input.monthKey?.trim() || monthKeyOf();
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return fail("Month must look like 2026-07.");

  const [year, month] = monthKey.split("-").map(Number);
  const name = input.name?.trim() || listNameFor(new Date(year, month - 1, 1));

  const existing = await prisma.groceryList.findUnique({ where: { monthKey_name: { monthKey, name } } });
  if (existing) {
    return { ok: true, data: { id: existing.id, existed: true } };
  }

  const list = await prisma.groceryList.create({ data: { name, monthKey } });
  revalidatePath("/");
  return { ok: true, data: { id: list.id, existed: false } };
}

export async function renameList(listId: number, name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Name cannot be empty.");

  const list = await prisma.groceryList.findUnique({ where: { id: listId }, select: { monthKey: true } });
  if (!list) return fail("List not found.");

  const clash = await prisma.groceryList.findFirst({
    where: { monthKey: list.monthKey, name: trimmed, NOT: { id: listId } },
    select: { id: true },
  });
  if (clash) return fail(`"${trimmed}" already exists for this month.`);

  await prisma.groceryList.update({ where: { id: listId }, data: { name: trimmed } });
  revalidateList(listId);
  return { ok: true };
}

/** Admin only — a closed list is a shared family record, not something anyone can erase. */
export async function deleteList(listId: number): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");
  await prisma.groceryList.delete({ where: { id: listId } });
  revalidatePath("/");
  revalidatePath("/history");
  return { ok: true };
}

export async function addListItem(input: {
  listId: number;
  itemId: number;
  quantity?: number;
  /** Overrides the master item's unit — used when a stepper promoted g/ml to kg/L. */
  unitType?: UnitType;
  shopId?: number | null;
}): Promise<ActionResult<{ listItemId: number }>> {
  const list = await prisma.groceryList.findUnique({ where: { id: input.listId } });
  if (!list) return fail("List not found.");
  if (list.status !== "DRAFT") return fail("Reopen the list before adding items.");

  const item = await prisma.item.findUnique({ where: { id: input.itemId } });
  if (!item) return fail("Item not found.");

  const unitType = input.unitType ?? (item.unitType as UnitType);
  const quantity = normalizeQty(input.quantity ?? Number(item.defaultQty), unitType);
  const shopId = input.shopId === undefined ? item.shopId : input.shopId;

  const existing = await prisma.groceryListItem.findFirst({
    where: { listId: input.listId, itemId: input.itemId, shopId },
  });

  if (existing) {
    // Same item + same shop already on the list: bump the quantity instead
    // of creating a duplicate row.
    const updated = await prisma.groceryListItem.update({
      where: { id: existing.id },
      data: { quantity: normalizeQty(Number(existing.quantity) + quantity, unitType) },
    });
    revalidateList(input.listId);
    return { ok: true, data: { listItemId: updated.id } };
  }

  const count = await prisma.groceryListItem.count({ where: { listId: input.listId } });
  const created = await prisma.groceryListItem.create({
    data: {
      listId: input.listId,
      itemId: input.itemId,
      quantity,
      unitType,
      shopId,
      sortOrder: count,
    },
  });

  revalidateList(input.listId);
  return { ok: true, data: { listItemId: created.id } };
}

export async function updateListItem(input: {
  listItemId: number;
  quantity?: number;
  /** Set alongside quantity when a stepper promoted g/ml to kg/L. */
  unitType?: UnitType;
  shopId?: number | null;
}): Promise<ActionResult> {
  const row = await prisma.groceryListItem.findUnique({
    where: { id: input.listItemId },
    include: { list: true },
  });
  if (!row) return fail("Item not found on this list.");
  if (row.list.status === "COMPLETED") return fail("This list is closed.");

  const unitType = input.unitType ?? (row.unitType as UnitType);
  const data: { quantity?: number; unitType?: UnitType; shopId?: number | null } = {};
  if (input.quantity !== undefined) {
    data.quantity = normalizeQty(input.quantity, unitType);
  }
  if (input.unitType !== undefined) data.unitType = input.unitType;
  if (input.shopId !== undefined) data.shopId = input.shopId;

  await prisma.groceryListItem.update({ where: { id: input.listItemId }, data });
  revalidateList(row.listId);
  return { ok: true };
}

export async function removeListItem(listItemId: number): Promise<ActionResult> {
  const row = await prisma.groceryListItem.findUnique({
    where: { id: listItemId },
    include: { list: true },
  });
  if (!row) return fail("Item not found on this list.");
  if (row.list.status === "COMPLETED") return fail("This list is closed.");

  await prisma.groceryListItem.delete({ where: { id: listItemId } });
  await prisma.priceHistory.deleteMany({ where: { listId: row.listId, itemId: row.itemId } });
  revalidateList(row.listId);
  return { ok: true };
}

export async function finalizeList(listId: number): Promise<ActionResult> {
  const count = await prisma.groceryListItem.count({ where: { listId } });
  if (count === 0) return fail("Add at least one item before finalizing.");

  await prisma.groceryList.update({
    where: { id: listId },
    data: { status: "FINALIZED", finalizedAt: new Date() },
  });
  revalidateList(listId);
  return { ok: true };
}

/**
 * Only a list still being shopped (FINALIZED) can be reopened for edits.
 * A COMPLETED list is a closed historical record — its spend and price
 * history are already final, so editing it back open is not allowed.
 */
export async function reopenList(listId: number): Promise<ActionResult> {
  const list = await prisma.groceryList.findUnique({ where: { id: listId }, select: { status: true } });
  if (!list) return fail("List not found.");
  if (list.status !== "FINALIZED") return fail("Completed lists can't be edited.");

  await prisma.groceryList.update({
    where: { id: listId },
    data: { status: "DRAFT", finalizedAt: null, completedAt: null },
  });
  revalidateList(listId);
  return { ok: true };
}

export async function completeList(listId: number): Promise<ActionResult> {
  await prisma.groceryList.update({
    where: { id: listId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  revalidateList(listId);
  return { ok: true };
}

/**
 * Checks an item off while shopping. Records what was actually paid and
 * snapshots the previous price so the up/down indicator stays stable even
 * after later months are added.
 */
export async function recordPurchase(input: {
  listItemId: number;
  price: number;
}): Promise<ActionResult<{ previousPrice: number | null }>> {
  if (!Number.isFinite(input.price) || input.price < 0) {
    return fail("Enter a valid price.");
  }
  const price = Math.round(input.price * 100) / 100;

  const row = await prisma.groceryListItem.findUnique({
    where: { id: input.listItemId },
    include: { list: true },
  });
  if (!row) return fail("Item not found on this list.");
  if (row.list.status === "DRAFT") return fail("Finalize the list before shopping.");

  const previous = await prisma.priceHistory.findFirst({
    where: { itemId: row.itemId, NOT: { listId: row.listId } },
    orderBy: { purchasedAt: "desc" },
    select: { price: true, quantity: true, unitType: true },
  });
  const previousPrice = previous ? Number(previous.price) : null;
  const previousQuantity = previous ? Number(previous.quantity) : null;
  const previousUnitType = previous?.unitType ?? null;
  const purchasedAt = new Date();

  await prisma.$transaction([
    prisma.groceryListItem.update({
      where: { id: row.id },
      data: {
        isPurchased: true,
        purchasePrice: price,
        previousPrice,
        previousQuantity,
        previousUnitType,
        purchasedAt,
      },
    }),
    // One history row per item per list — re-entering a price replaces it.
    prisma.priceHistory.deleteMany({ where: { listId: row.listId, itemId: row.itemId } }),
    prisma.priceHistory.create({
      data: {
        itemId: row.itemId,
        listId: row.listId,
        shopId: row.shopId,
        price,
        quantity: row.quantity,
        unitType: row.unitType,
        purchasedAt,
      },
    }),
  ]);

  revalidateList(row.listId);
  return { ok: true, data: { previousPrice } };
}

export async function undoPurchase(listItemId: number): Promise<ActionResult> {
  const row = await prisma.groceryListItem.findUnique({ where: { id: listItemId } });
  if (!row) return fail("Item not found on this list.");

  await prisma.$transaction([
    prisma.groceryListItem.update({
      where: { id: listItemId },
      data: {
        isPurchased: false,
        purchasePrice: null,
        previousPrice: null,
        previousQuantity: null,
        previousUnitType: null,
        purchasedAt: null,
      },
    }),
    prisma.priceHistory.deleteMany({ where: { listId: row.listId, itemId: row.itemId } }),
  ]);

  revalidateList(row.listId);
  return { ok: true };
}

export async function upsertMasterItem(input: {
  id?: number;
  nameEn: string;
  nameTa: string;
  categoryId: number;
  unitType: UnitType;
  shopId: number | null;
  defaultQty?: number;
  isActive?: boolean;
  hasVariableUnit?: boolean;
}): Promise<ActionResult<{ id: number }>> {
  const nameEn = input.nameEn.trim();
  if (!nameEn) return fail("English name is required.");
  if (!input.categoryId) return fail("Pick a category.");

  // A blank Tamil field on a brand-new item falls back to the English name
  // (better than truly empty). On an EDIT, though, that same fallback would
  // silently overwrite a real Tamil name whenever the field is left blank —
  // keep whatever's already stored instead of destroying it.
  let nameTa = input.nameTa.trim();
  if (!nameTa) {
    if (input.id) {
      const existing = await prisma.item.findUnique({ where: { id: input.id }, select: { nameTa: true } });
      nameTa = existing?.nameTa || nameEn;
    } else {
      nameTa = nameEn;
    }
  }

  const defaultQty = normalizeQty(input.defaultQty ?? 1, input.unitType);

  const clash = await prisma.item.findFirst({
    where: {
      nameEn,
      categoryId: input.categoryId,
      ...(input.id ? { NOT: { id: input.id } } : {}),
    },
    select: { id: true },
  });
  if (clash) return fail(`"${nameEn}" already exists in this category.`);

  const data = {
    nameEn,
    nameTa,
    categoryId: input.categoryId,
    unitType: input.unitType,
    shopId: input.shopId,
    defaultQty,
    isActive: input.isActive ?? true,
    hasVariableUnit: input.hasVariableUnit ?? false,
  };

  const item = input.id
    ? await prisma.item.update({ where: { id: input.id }, data })
    : await prisma.item.create({ data });

  revalidatePath("/master");
  return { ok: true, data: { id: item.id } };
}

/**
 * Lets the "last paid" panel on the Add items page tweak an item's default
 * unit and shop right there, without the full master-item form (no name/
 * category to re-validate).
 */
export async function updateMasterItemQuick(input: {
  itemId: number;
  unitType?: UnitType;
  shopId?: number | null;
}): Promise<ActionResult> {
  const data: { unitType?: UnitType; shopId?: number | null; defaultQty?: number } = {};
  if (input.unitType !== undefined) {
    const current = await prisma.item.findUnique({ where: { id: input.itemId }, select: { defaultQty: true } });
    data.unitType = input.unitType;
    data.defaultQty = normalizeQty(Number(current?.defaultQty ?? 1), input.unitType);
  }
  if (input.shopId !== undefined) data.shopId = input.shopId;

  await prisma.item.update({ where: { id: input.itemId }, data });
  revalidatePath("/master");
  return { ok: true };
}

export async function setMasterItemActive(
  itemId: number,
  isActive: boolean,
): Promise<ActionResult> {
  await prisma.item.update({ where: { id: itemId }, data: { isActive } });
  revalidatePath("/master");
  return { ok: true };
}

/**
 * Permanently removes a master item. If it's referenced by a past list
 * (Item→GroceryListItem is onDelete: Restrict), the hard delete is
 * rejected by the database — fall back to deactivating it so it at
 * least disappears from search and stays out of new lists.
 */
export async function deleteMasterItem(itemId: number): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    await prisma.item.delete({ where: { id: itemId } });
    revalidatePath("/master");
    return { ok: true, data: { deleted: true } };
  } catch (err) {
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2003") {
      await prisma.item.update({ where: { id: itemId }, data: { isActive: false } });
      revalidatePath("/master");
      return { ok: true, data: { deleted: false } };
    }
    throw err;
  }
}

/** Only removable when empty — Item→Category is onDelete: Restrict. */
export async function deleteCategory(categoryId: number): Promise<ActionResult> {
  const count = await prisma.item.count({ where: { categoryId } });
  if (count > 0) return fail("This category still has items — move or delete them first.");

  await prisma.category.delete({ where: { id: categoryId } });
  revalidatePath("/master");
  return { ok: true };
}

export async function createShop(name: string): Promise<ActionResult<{ id: number }>> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Shop name is required.");

  const existing = await prisma.shop.findUnique({ where: { name: trimmed } });
  if (existing) return { ok: true, data: { id: existing.id } };

  const count = await prisma.shop.count();
  const shop = await prisma.shop.create({ data: { name: trimmed, sortOrder: count } });
  revalidatePath("/master");
  return { ok: true, data: { id: shop.id } };
}

export async function createCategory(input: {
  nameEn: string;
  nameTa?: string;
}): Promise<ActionResult<{ id: number }>> {
  const nameEn = input.nameEn.trim();
  if (!nameEn) return fail("Category name is required.");

  const existing = await prisma.category.findUnique({ where: { nameEn } });
  if (existing) return { ok: true, data: { id: existing.id } };

  const count = await prisma.category.count();
  const category = await prisma.category.create({
    data: { nameEn, nameTa: input.nameTa?.trim() || null, sortOrder: count },
  });
  revalidatePath("/master");
  return { ok: true, data: { id: category.id } };
}

export async function updateCategory(input: {
  id: number;
  nameEn: string;
  nameTa?: string | null;
}): Promise<ActionResult> {
  const nameEn = input.nameEn.trim();
  if (!nameEn) return fail("English name is required.");
  const nameTa = input.nameTa?.trim() || null;

  const clash = await prisma.category.findFirst({
    where: { nameEn, NOT: { id: input.id } },
    select: { id: true },
  });
  if (clash) return fail(`"${nameEn}" already exists.`);

  await prisma.category.update({ where: { id: input.id }, data: { nameEn, nameTa } });
  revalidatePath("/master");
  return { ok: true };
}

type KnownTranslationRow = { grocery: string; groceryEn: string };

/**
 * "Needs Tamil" items (nameTa === nameEn) usually just weren't translated
 * when they were created — often manually, outside a spreadsheet import.
 * The original spreadsheet (bundled at build time) already has the right
 * Tamil name for anything that came from it, so try that lookup before
 * asking someone to type each one in by hand.
 */
export async function fixKnownTranslations(): Promise<
  ActionResult<{ fixed: number; remaining: number }>
> {
  if (!(await isAdminSession())) return fail("Admin only.");

  const lookup = new Map<string, string>();
  for (const row of (masterData.items as KnownTranslationRow[]) ?? []) {
    const key = row.groceryEn.trim().toLowerCase();
    if (key && !lookup.has(key)) lookup.set(key, row.grocery.trim());
  }

  const items = await prisma.item.findMany({ select: { id: true, nameEn: true, nameTa: true } });
  const broken = items.filter((item) => item.nameTa.trim().toLowerCase() === item.nameEn.trim().toLowerCase());

  let fixed = 0;
  for (const item of broken) {
    const translation = lookup.get(item.nameEn.trim().toLowerCase());
    if (!translation) continue;
    await prisma.item.update({ where: { id: item.id }, data: { nameTa: translation } });
    fixed += 1;
  }

  revalidatePath("/master");
  return { ok: true, data: { fixed, remaining: broken.length - fixed } };
}

/** Powers the search field in the "add item" sheet. */
export async function searchMasterItems(query: string) {
  const { getMasterItems } = await import("./queries");
  return getMasterItems({ search: query, take: 40 });
}

/** Powers the inline price-history preview in the purchase sheet. */
export async function getItemPriceHistory(itemId: number) {
  const { getPriceHistory } = await import("./queries");
  return getPriceHistory(itemId);
}
