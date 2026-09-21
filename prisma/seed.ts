/**
 * Seeds master data from prisma/data/master-data.json.
 *
 * Usage:
 *   npm run db:seed              — master data only
 *   SEED_DEMO=1 npm run db:seed  — master data + a completed previous-month
 *                                  list, so price comparison has something to
 *                                  compare against on the first run, plus a
 *                                  half-shopped list for the current month so
 *                                  every screen has something on it (what
 *                                  scripts/preview.sh screenshots).
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createScriptClient, importMasterData, type MasterData } from "./master-import.js";
import { monthKeyOf, listNameFor } from "../src/lib/dates.js";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * A stable slice of the catalogue to build demo lists from. Chosen by
 * position rather than by name: the master list is re-imported from the
 * spreadsheet whenever it changes, and hard-coded English names silently
 * stop matching when it does.
 */
async function pickDemoItems(prisma: ReturnType<typeof createScriptClient>, count: number) {
  return prisma.item.findMany({
    where: { isActive: true },
    orderBy: [{ categoryId: "asc" }, { id: "asc" }],
    take: count,
  });
}

/** Plausible rupee price for one unit of an item, stable across runs. */
function demoPrice(unitType: string, index: number): number {
  const base: Record<string, number> = { KG: 120, G: 60, L: 130, ML: 70, RS: 20, COUNT: 45 };
  return (base[unitType] ?? 50) + index * 7;
}

function demoQty(unitType: string): number {
  return unitType === "G" || unitType === "ML" ? 100 : 1;
}

const DEMO_ITEM_COUNT = 10;

async function seedDemoHistory(prisma: ReturnType<typeof createScriptClient>) {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthKey = monthKeyOf(lastMonth);

  const existing = await prisma.groceryList.findFirst({ where: { monthKey } });
  if (existing) {
    console.log(`   demo: list "${existing.name}" already exists, skipping`);
    return;
  }

  const items = await pickDemoItems(prisma, DEMO_ITEM_COUNT);

  const list = await prisma.groceryList.create({
    data: {
      name: listNameFor(lastMonth),
      monthKey,
      status: "COMPLETED",
      finalizedAt: lastMonth,
      completedAt: lastMonth,
    },
  });

  for (const [index, item] of items.entries()) {
    const price = demoPrice(item.unitType, index);
    const quantity = demoQty(item.unitType);

    await prisma.groceryListItem.create({
      data: {
        listId: list.id,
        itemId: item.id,
        quantity,
        unitType: item.unitType,
        shopId: item.shopId,
        isPurchased: true,
        purchasePrice: price,
        purchasedAt: lastMonth,
        sortOrder: index,
      },
    });

    await prisma.priceHistory.create({
      data: {
        itemId: item.id,
        listId: list.id,
        shopId: item.shopId,
        price,
        quantity,
        unitType: item.unitType,
        purchasedAt: lastMonth,
      },
    });
  }

  console.log(`   demo: created "${list.name}" with ${items.length} purchased items`);
}

/**
 * A half-shopped list for the current month, so the list, shopping and
 * purchase screens all have something on them the moment the app comes up.
 */
async function seedDemoCurrentMonth(prisma: ReturnType<typeof createScriptClient>) {
  const now = new Date();
  const monthKey = monthKeyOf(now);

  const existing = await prisma.groceryList.findFirst({ where: { monthKey } });
  if (existing) {
    console.log(`   demo: list "${existing.name}" already exists, skipping`);
    return;
  }

  const items = await pickDemoItems(prisma, DEMO_ITEM_COUNT);

  const list = await prisma.groceryList.create({
    data: { name: listNameFor(now), monthKey, status: "FINALIZED", finalizedAt: now },
  });

  // The first three are already in the trolley — dearer, cheaper, unchanged —
  // so the price comparison indicators have something to show. The rest stay
  // unbought, which is what the screen looks like halfway down an aisle.
  const delta = [13, -9, 0];

  for (const [index, item] of items.entries()) {
    const quantity = demoQty(item.unitType);
    const previous = await prisma.priceHistory.findFirst({
      where: { itemId: item.id },
      orderBy: { purchasedAt: "desc" },
    });
    const purchasePrice =
      index < delta.length ? demoPrice(item.unitType, index) + delta[index] : undefined;

    await prisma.groceryListItem.create({
      data: {
        listId: list.id,
        itemId: item.id,
        quantity,
        unitType: item.unitType,
        shopId: item.shopId,
        previousPrice: previous?.price,
        previousQuantity: previous?.quantity,
        previousUnitType: previous?.unitType,
        sortOrder: index,
        ...(purchasePrice === undefined
          ? {}
          : { isPurchased: true, purchasePrice, purchasedAt: now }),
      },
    });

    if (purchasePrice !== undefined) {
      await prisma.priceHistory.create({
        data: {
          itemId: item.id,
          listId: list.id,
          shopId: item.shopId,
          price: purchasePrice,
          quantity,
          unitType: item.unitType,
          purchasedAt: now,
        },
      });
    }
  }

  console.log(
    `   demo: created "${list.name}" with ${items.length} items, ${delta.length} already bought`,
  );
}

async function main() {
  const prisma = createScriptClient();
  try {
    const raw = await readFile(join(here, "data", "master-data.json"), "utf8");
    const data = JSON.parse(raw) as MasterData;

    const result = await importMasterData(prisma, data);
    console.log("✔ Master data seeded");
    console.log(`   categories: ${result.categories}`);
    console.log(`   shops:      ${result.shops}`);
    console.log(`   items:      ${result.created} created, ${result.updated} updated`);
    if (result.skipped.length) {
      console.log(`   skipped:    ${result.skipped.length}`);
      for (const reason of result.skipped) console.log(`     - ${reason}`);
    }

    if (process.env.SEED_DEMO === "1") {
      await seedDemoHistory(prisma);
      await seedDemoCurrentMonth(prisma);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
