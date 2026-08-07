"use client";

import { useState } from "react";
import Link from "next/link";

import { AdminLoginButton } from "@/components/AdminLoginButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAdmin } from "@/lib/admin-context";
import { dateKeyToLabel } from "@/lib/dates";
import { formatPrice } from "@/lib/units";
import type { BudgetCategoryDTO, ExpenseDTO } from "@/lib/budget/types";

import { CategoryIcon, colorClass } from "./icons";
import { ExpenseSheet } from "./ExpenseSheet";

/**
 * The recurring definitions behind the calendar. Read-only for family members;
 * only an admin sees the add button and can open the editor.
 */
export function ExpenseManager({
  expenses,
  categories,
}: {
  expenses: ExpenseDTO[];
  categories: BudgetCategoryDTO[];
}) {
  const { isAdmin } = useAdmin();
  const [editing, setEditing] = useState<ExpenseDTO | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const open = (expense: ExpenseDTO | null) => {
    if (!isAdmin) return;
    setEditing(expense);
    setSheetOpen(true);
  };

  const active = expenses.filter((expense) => expense.isActive);
  const retired = expenses.filter((expense) => !expense.isActive);

  const renderRow = (expense: ExpenseDTO) => (
    <li key={expense.id}>
      <button
        type="button"
        onClick={() => open(expense)}
        disabled={!isAdmin}
        className="ios-row w-full text-left active:opacity-60 disabled:active:opacity-100"
      >
        <span
          className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${colorClass(expense.colorKey)}`}
        >
          <CategoryIcon iconKey={expense.iconKey} className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-medium">{expense.name}</span>
          <span className="block truncate text-[13px] text-ios-label-2">
            {expense.recurrenceLabel}
            {expense.nextDueDate ? ` · next ${dateKeyToLabel(expense.nextDueDate)}` : ""}
          </span>
        </span>
        <span className="flex-none text-[16px] font-semibold tabular-nums">
          {formatPrice(expense.amount)}
        </span>
      </button>
    </li>
  );

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 pt-2">
        <div className="min-w-0">
          <Link href="/budget" className="text-[13px] font-medium text-ios-blue active:opacity-60">
            ‹ Budget
          </Link>
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">Expenses</h1>
        </div>
        <div className="flex flex-none items-center gap-2">
          <AdminLoginButton />
          <ThemeToggle />
        </div>
      </header>

      {isAdmin ? (
        <button
          type="button"
          onClick={() => open(null)}
          className="flex h-12 w-full items-center justify-center rounded-ios bg-ios-blue text-[17px] font-semibold text-white transition active:scale-[0.98]"
        >
          Add an expense
        </button>
      ) : (
        <p className="rounded-ios bg-ios-surface-2 px-3 py-2.5 text-[14px] text-ios-label-2">
          Only an admin can add or change expenses. Unlock with the PIN to edit.
        </p>
      )}

      {active.length > 0 ? (
        <section>
          <h2 className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-ios-label-2">
            Active
          </h2>
          <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
            {active.map(renderRow)}
          </ul>
        </section>
      ) : (
        <section className="ios-card p-8 text-center">
          <p className="text-[16px] font-medium">No expenses yet</p>
          <p className="mt-1 text-[14px] text-ios-label-2">
            Add rent, bills and insurance to see them on the calendar.
          </p>
        </section>
      )}

      {retired.length > 0 ? (
        <section>
          <h2 className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-ios-label-3">
            Retired
          </h2>
          <ul className="ios-card divide-y divide-ios-separator overflow-hidden opacity-60">
            {retired.map(renderRow)}
          </ul>
          {isAdmin ? (
            <p className="mt-2 px-1 text-[13px] text-ios-label-3">
              Retired expenses stop appearing on the calendar but keep their history.
            </p>
          ) : null}
        </section>
      ) : null}

      {isAdmin && expenses.length > 0 ? (
        <p className="px-1 text-[13px] text-ios-label-3">
          Tap an expense to edit it. To stop one recurring without losing its payment history,
          retire it or give it an end date rather than deleting it.
        </p>
      ) : null}

      <ExpenseSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        expense={editing}
        categories={categories}
      />
    </div>
  );
}
