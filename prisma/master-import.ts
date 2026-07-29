import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { parseUnitType } from "../src/lib/units.js";

/** One spreadsheet row from "Grocery database.xlsx". */
export type MasterRow = {
  /** "Grocery" — Tamil name */
  grocery: string;
  /** "Grocery.1" — English name */
  groceryEn: string;
  /** "Type" — category, matched against Category.nameEn or nameTa */
  type: string;
  /** "Qty Type" — kg | g | L | ml | Rs | blank */
  qtyType: string;
  /** "From" — shop name */
  from: string;
};

export type MasterData = {
  shops?: string[];
  categories?: { nameTa?: string | null; nameEn: string }[];
  items: MasterRow[];
};

export function createScriptClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and point it at your MySQL database.",
    );
  }
  return new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });
}

/**
 * Idempotent import: safe to re-run whenever the spreadsheet changes.
 * Categories and shops referenced by an item are created on demand, so a
 * raw CSV export with no explicit category list still works.
 */
export async function importMasterData(prisma: PrismaClient, data: MasterData) {
  const categoryIds = new Map<string, number>();
  const shopIds = new Map<string, number>();

  const declaredCategories = data.categories ?? [];
  // An item's "type" is matched against a declared category by nameEn OR
  // nameTa — declared categories here use Tamil "type" text as nameTa with
  // a translated nameEn, so matching nameEn alone would treat every row as
  // undeclared and spawn duplicate Tamil-named categories.
  const derivedCategories = [...new Set(data.items.map((i) => i.type.trim()).filter(Boolean))]
    .filter((name) => !declaredCategories.some((c) => c.nameEn === name || c.nameTa === name))
    .map((name) => ({ nameEn: name, nameTa: null }));

  const categories = [...declaredCategories, ...derivedCategories];
  for (const [index, category] of categories.entries()) {
    const record = await prisma.category.upsert({
      where: { nameEn: category.nameEn },
      update: { nameTa: category.nameTa ?? undefined, sortOrder: index },
      create: {
        nameEn: category.nameEn,
        nameTa: category.nameTa ?? null,
        sortOrder: index,
      },
    });
    categoryIds.set(category.nameEn, record.id);
    if (category.nameTa) categoryIds.set(category.nameTa, record.id);
  }

  const shopNames = [
    ...new Set([...(data.shops ?? []), ...data.items.map((i) => i.from.trim())].filter(Boolean)),
  ];
  for (const [index, name] of shopNames.entries()) {
    const record = await prisma.shop.upsert({
      where: { name },
      update: { sortOrder: index },
      create: { name, sortOrder: index },
    });
    shopIds.set(name, record.id);
  }

  let created = 0;
  let updated = 0;
  const skipped: string[] = [];

  for (const row of data.items) {
    const nameEn = row.groceryEn?.trim();
    const nameTa = row.grocery?.trim();
    const categoryId = categoryIds.get(row.type?.trim() ?? "");

    if (!nameEn || !categoryId) {
      skipped.push(`${nameTa || nameEn || "(unnamed)"} — missing English name or category`);
      continue;
    }

    const unitType = parseUnitType(row.qtyType);
    const shopId = shopIds.get(row.from?.trim() ?? "") ?? null;
    const existing = await prisma.item.findUnique({
      where: { nameEn_categoryId: { nameEn, categoryId } },
      select: { id: true },
    });

    await prisma.item.upsert({
      where: { nameEn_categoryId: { nameEn, categoryId } },
      // Reactivates an item that was previously deactivated (e.g. by
      // resync.ts, when it dropped out of the spreadsheet) and has since
      // come back — the spreadsheet is the source of truth for what's
      // current.
      update: { nameTa: nameTa || nameEn, unitType, shopId, isActive: true },
      create: {
        nameEn,
        nameTa: nameTa || nameEn,
        unitType,
        categoryId,
        shopId,
        defaultQty: unitType === "G" || unitType === "ML" ? 100 : 1,
      },
    });

    if (existing) updated++;
    else created++;
  }

  return {
    categories: categories.length,
    shops: shopNames.length,
    created,
    updated,
    skipped,
  };
}
