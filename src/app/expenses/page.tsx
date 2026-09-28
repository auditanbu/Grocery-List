import { ExpensesView } from "@/components/expenses/ExpensesView";
import { monthKeyOf } from "@/lib/dates";
import { getExpenseMonth } from "@/lib/expenses/queries";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const monthKey = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : monthKeyOf();
  const month = await getExpenseMonth(monthKey);

  return <ExpensesView month={month} />;
}
