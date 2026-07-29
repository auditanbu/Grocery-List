/**
 * Replaces the master catalogue with prisma/data/master-data.json: upserts
 * every item/category/shop in the file, then removes anything left over
 * from before (old placeholder data, renamed/deleted spreadsheet rows).
 *
 * Items with existing purchase history can't be hard-deleted (a
 * GroceryListItem row references them) — those are deactivated instead,
 * same as toggling "Hide from search" in the Master List screen.
 *
 * Usage: npm run db:resync
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createScriptClient, importMasterData, type MasterData } from "./master-import.js";

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const prisma = createScriptClient();
  try {
    const raw = await readFile(join(here, "data", "master-data.json"), "utf8");
    const data = JSON.parse(raw) as MasterData;

    const result = await importMasterData(prisma, data);
    console.log("✔ Master data synced");
    console.log(`   categories: ${result.categories}`);
    console.log(`   shops:      ${result.shops}`);
    console.log(`   items:      ${result.created} created, ${result.updated} updated`);
    if (result.skipped.length) {
      console.log(`   skipped:    ${result.skipped.length}`);
      for (const reason of result.skipped) console.log(`     - ${reason}`);
    }

    // Matches Item's real uniqueness (nameEn, categoryId) — matching on
    // nameEn alone would spare an old item whose English name happens to
    // coincide with a new one filed under a different category. Resolve
    // each row's category by id rather than by name: a category's nameEn
    // and nameTa can differ (nameEn is a translation, row.type is the
    // Tamil spreadsheet text), so comparing name strings directly would
    // flag every item as stale the moment nameEn stops matching row.type.
    const allCategories = await prisma.category.findMany({
      select: { id: true, nameEn: true, nameTa: true },
    });
    const categoryIdByName = new Map<string, number>();
    for (const category of allCategories) {
      categoryIdByName.set(category.nameEn, category.id);
      if (category.nameTa) categoryIdByName.set(category.nameTa, category.id);
    }

    const keepPairs = new Set(
      data.items
        .map((row) => {
          const categoryId = categoryIdByName.get(row.type.trim());
          return categoryId ? `${row.groceryEn.trim()}::${categoryId}` : null;
        })
        .filter((key): key is string => key !== null),
    );
    const allItems = await prisma.item.findMany({
      select: { id: true, nameEn: true, categoryId: true },
    });
    const staleItems = allItems.filter((item) => !keepPairs.has(`${item.nameEn}::${item.categoryId}`));

    let deactivated = 0;
    let deleted = 0;
    for (const item of staleItems) {
      const listRowCount = await prisma.groceryListItem.count({ where: { itemId: item.id } });
      if (listRowCount > 0) {
        await prisma.item.update({ where: { id: item.id }, data: { isActive: false } });
        deactivated++;
      } else {
        await prisma.priceHistory.deleteMany({ where: { itemId: item.id } });
        await prisma.item.delete({ where: { id: item.id } });
        deleted++;
      }
    }
    console.log(`✔ Removed items not in the spreadsheet`);
    console.log(`   deleted:     ${deleted}`);
    console.log(`   deactivated: ${deactivated} (still referenced by a past list)`);

    const orphanCategories = await prisma.category.findMany({
      where: { items: { none: {} } },
      select: { id: true, nameEn: true },
    });
    if (orphanCategories.length) {
      await prisma.category.deleteMany({ where: { id: { in: orphanCategories.map((c) => c.id) } } });
      console.log(`✔ Removed ${orphanCategories.length} unused categories`);
    }

    const orphanShops = await prisma.shop.findMany({
      where: { items: { none: {} }, groceryItems: { none: {} }, priceHistories: { none: {} } },
      select: { id: true, name: true },
    });
    if (orphanShops.length) {
      await prisma.shop.deleteMany({ where: { id: { in: orphanShops.map((s) => s.id) } } });
      console.log(`✔ Removed ${orphanShops.length} unused shops`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
