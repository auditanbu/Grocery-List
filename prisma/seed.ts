/**
 * Seeds master data from prisma/data/master-data.json.
 *
 * Usage:
 *   npm run db:seed              — master data only
 *   SEED_DEMO=1 npm run db:seed  — master data + a completed previous-month
 *                                  list, so price comparison has something to
 *                                  compare against on the first run.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createScriptClient, importMasterData, type MasterData } from "./master-import.js";
import { monthKeyOf, listNameFor } from "../src/lib/dates.js";

const here = dirname(fileURLToPath(import.meta.url));

async function seedDemoHistory(prisma: ReturnType<typeof createScriptClient>) {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthKey = monthKeyOf(lastMonth);

  const existing = await prisma.groceryList.findFirst({ where: { monthKey } });
  if (existing) {
    console.log(`   demo: list "${existing.name}" already exists, skipping`);
    return;
  }

  const items = await prisma.item.findMany({
    where: {
      nameEn: {
        in: [
          "Toor Dal",
          "Raw Rice",
          "Sunflower Oil",
          "Sugar",
          "Onion",
          "Tomato",
          "Milk",
          "Tea Powder",
          "Detergent Powder",
          "Cashew Nuts",
        ],
      },
    },
  });

  // Rough per-unit prices for the demo month, keyed by English name.
  const demoPrices: Record<string, number> = {
    "Toor Dal": 165,
    "Raw Rice": 62,
    "Sunflower Oil": 148,
    Sugar: 46,
    Onion: 38,
    Tomato: 30,
    Milk: 54,
    "Tea Powder": 145,
    "Detergent Powder": 210,
    "Cashew Nuts": 380,
  };

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
    const price = demoPrices[item.nameEn] ?? 100;
    const quantity = item.unitType === "G" || item.unitType === "ML" ? 100 : 1;

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
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
