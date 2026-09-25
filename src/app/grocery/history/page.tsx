import { HistoryScreen } from "@/components/history/HistoryScreen";
import { biggestMoves, getLists, getPurchasedItems } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const [lists, items] = await Promise.all([getLists(), getPurchasedItems()]);
  // The moves are ranked from the same array the search filters, so the two
  // can never disagree about what an item last cost.
  return <HistoryScreen items={items} moves={biggestMoves(items)} lists={lists} />;
}
