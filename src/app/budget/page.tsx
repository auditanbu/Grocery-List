import { BudgetView } from "@/components/budget/BudgetView";
import { monthKeyOf } from "@/lib/dates";
import { getBudgetOverview } from "@/lib/budget/queries";

export const dynamic = "force-dynamic";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const monthKey = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : monthKeyOf();
  const overview = await getBudgetOverview(monthKey);

  return <BudgetView overview={overview} />;
}
