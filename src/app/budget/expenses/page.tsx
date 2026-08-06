import { ExpenseManager } from "@/components/budget/ExpenseManager";
import { getBudgetCategories, getBudgetExpenses } from "@/lib/budget/queries";

export const dynamic = "force-dynamic";

export default async function BudgetExpensesPage() {
  const [expenses, categories] = await Promise.all([getBudgetExpenses(), getBudgetCategories()]);

  return <ExpenseManager expenses={expenses} categories={categories} />;
}
