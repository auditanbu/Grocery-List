import { MasterBrowser } from "@/components/master/MasterBrowser";
import { getCategories, getMasterItems, getShops } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function MasterPage() {
  const [items, categories, shops] = await Promise.all([
    getMasterItems({ includeInactive: true }),
    getCategories(),
    getShops(),
  ]);

  return <MasterBrowser items={items} categories={categories} shops={shops} />;
}
