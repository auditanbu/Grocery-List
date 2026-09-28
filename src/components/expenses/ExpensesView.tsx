"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { AdminLoginButton } from "@/components/AdminLoginButton";
import { Sheet } from "@/components/Sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EntrySheet } from "@/components/expenses/EntrySheet";
import { PeopleSheet } from "@/components/expenses/PeopleSheet";
import { deleteExpense, settleUp, setCategoryBudget } from "@/lib/expenses/actions";
import { useAdmin } from "@/lib/admin-context";
import { formatIsoDate, monthKeyToLabel, shiftMonthKey } from "@/lib/dates";
import { useLanguage } from "@/lib/language";
import { formatPrice } from "@/lib/units";
import type { ExpenseDTO, ExpenseMonthDTO, TransferDTO } from "@/lib/expenses/types";

/** Categories carry both names; which one leads follows the app-wide toggle. */
function useCategoryName() {
  const { language } = useLanguage();
  return (nameEn: string, nameTa: string | null) =>
    language === "ta" ? (nameTa ?? nameEn) : nameEn;
}

export function ExpensesView({ month }: { month: ExpenseMonthDTO }) {
  const router = useRouter();
  const { isAdmin } = useAdmin();
  const categoryName = useCategoryName();
  const [entrySheet, setEntrySheet] = useState<{ entry: ExpenseDTO | null } | null>(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [settling, setSettling] = useState<TransferDTO | null>(null);
  const [budgetFor, setBudgetFor] = useState<{ id: number; name: string; budget: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Days, newest first — a ledger reads as "what happened on the 28th", not
  // as one undifferentiated column of rows.
  const days = useMemo(() => {
    const grouped = new Map<string, ExpenseDTO[]>();
    for (const entry of month.entries) {
      const day = entry.spentAt.slice(0, 10);
      grouped.set(day, [...(grouped.get(day) ?? []), entry]);
    }
    return [...grouped.entries()];
  }, [month.entries]);

  const spendCategories = month.categoryTotals.filter((total) => total.kind === "EXPENSE");

  const remove = (entry: ExpenseDTO) => {
    if (!window.confirm(`Delete ${formatPrice(entry.amount)} from this month? This can't be undone.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteExpense(entry.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEntrySheet(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6 pb-4">
      <header className="flex items-end justify-between gap-3 pt-2">
        <div className="min-w-0">
          <p className="text-[13px] font-medium uppercase tracking-wide text-ios-label-2">
            {monthKeyToLabel(month.monthKey)}
          </p>
          <h1 className="truncate text-[34px] font-bold leading-tight tracking-tight">Expenses</h1>
        </div>
        <div className="flex flex-none items-center gap-2">
          <button
            type="button"
            onClick={() => setPeopleOpen(true)}
            aria-label="People and categories"
            title="People and categories"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ios-surface text-ios-blue shadow-ios active:scale-95"
          >
            <PeopleIcon />
          </button>
          <button
            type="button"
            onClick={() => setEntrySheet({ entry: null })}
            aria-label="Add an entry"
            title="Add an entry"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ios-blue text-white shadow-ios active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
            </svg>
          </button>
          <AdminLoginButton />
          <ThemeToggle />
        </div>
      </header>

      <div className="flex items-center justify-between px-1">
        <Link
          href={`/expenses?month=${shiftMonthKey(month.monthKey, -1)}`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ios-surface text-ios-blue shadow-ios active:scale-95"
          aria-label="Previous month"
        >
          <Chevron direction="left" />
        </Link>
        <p className="text-[15px] font-medium text-ios-label-2">{monthKeyToLabel(month.monthKey)}</p>
        <Link
          href={`/expenses?month=${shiftMonthKey(month.monthKey, 1)}`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ios-surface text-ios-blue shadow-ios active:scale-95"
          aria-label="Next month"
        >
          <Chevron direction="right" />
        </Link>
      </div>

      {error ? (
        <p className="rounded-ios bg-ios-red-soft px-4 py-3 text-[14px] text-ios-red">{error}</p>
      ) : null}

      <section className="ios-card p-5">
        <p className="text-[13px] text-ios-label-2">Spent this month</p>
        <p className="text-[32px] font-bold leading-none tabular-nums tracking-tight">
          {formatPrice(month.spent)}
        </p>
        {month.income > 0 ? (
          <p className="mt-2 text-[13px] text-ios-label-2">
            <span className="font-semibold tabular-nums text-ios-green">
              {formatPrice(month.income)}
            </span>{" "}
            in · net{" "}
            <span className="font-semibold tabular-nums">
              {formatPrice(month.income - month.spent)}
            </span>
          </p>
        ) : null}
        <p className="mt-2 text-[12px] text-ios-label-3">
          Groceries and petrol are tracked in their own modules and are not counted here.
        </p>
      </section>

      {/* Balances are all-time: a September debt is still a debt in October.
          Nothing shows until something is actually split. */}
      {month.balances.length > 0 ? (
        <section>
          <h2 className="px-1 pb-2 text-[20px] font-semibold tracking-tight">Balances</h2>
          <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
            {month.balances.map((balance) => (
              <li key={balance.personId} className="ios-row">
                <span className="min-w-0 flex-1 truncate text-[16px] font-medium">
                  {balance.personName}
                </span>
                <span
                  className={`flex-none text-[15px] font-semibold tabular-nums ${
                    balance.net > 0 ? "text-ios-green" : "text-ios-red"
                  }`}
                >
                  {balance.net > 0
                    ? `is owed ${formatPrice(balance.net)}`
                    : `owes ${formatPrice(Math.abs(balance.net))}`}
                </span>
              </li>
            ))}
          </ul>

          {month.transfers.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {month.transfers.map((transfer) => (
                <li
                  key={`${transfer.fromPersonId}-${transfer.toPersonId}`}
                  className="ios-card flex items-center gap-3 px-4 py-3"
                >
                  <span className="min-w-0 flex-1 text-[15px]">
                    {transfer.fromName} → {transfer.toName}{" "}
                    <span className="font-semibold tabular-nums">{formatPrice(transfer.amount)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSettling(transfer)}
                    className="h-9 flex-none rounded-full bg-ios-blue px-4 text-[14px] font-semibold text-white active:scale-95"
                  >
                    Settle up
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {spendCategories.length > 0 ? (
        <section>
          <h2 className="px-1 pb-2 text-[20px] font-semibold tracking-tight">Categories</h2>
          <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
            {spendCategories.map((total) => {
              const over = total.budget !== null && total.total > total.budget;
              const percent =
                total.budget && total.budget > 0
                  ? Math.min(100, Math.round((total.total / total.budget) * 100))
                  : 0;
              return (
                <li key={total.categoryId}>
                  <button
                    type="button"
                    onClick={() =>
                      isAdmin
                        ? setBudgetFor({
                            id: total.categoryId,
                            name: categoryName(total.nameEn, total.nameTa),
                            budget: total.budget,
                          })
                        : undefined
                    }
                    disabled={!isAdmin}
                    className="ios-row w-full text-left active:bg-ios-surface-2 disabled:active:bg-transparent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[16px] font-medium">
                          {categoryName(total.nameEn, total.nameTa)}
                        </span>
                        <span
                          className={`flex-none text-[15px] font-semibold tabular-nums ${
                            over ? "text-ios-red" : ""
                          }`}
                        >
                          {formatPrice(total.total)}
                        </span>
                      </span>
                      {total.budget !== null ? (
                        <>
                          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-ios-surface-2">
                            <span
                              className={`block h-full rounded-full ${over ? "bg-ios-red" : "bg-ios-blue"}`}
                              style={{ width: `${over ? 100 : percent}%` }}
                            />
                          </span>
                          <span
                            className={`mt-1 block text-[12px] ${over ? "text-ios-red" : "text-ios-label-3"}`}
                          >
                            {over
                              ? `${formatPrice(total.total - total.budget)} over ${formatPrice(total.budget)}`
                              : `of ${formatPrice(total.budget)}`}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {isAdmin ? (
            <p className="px-1 pt-1.5 text-[12px] text-ios-label-3">Tap a category to set its monthly limit.</p>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 className="px-1 pb-2 text-[20px] font-semibold tracking-tight">Entries</h2>
        {days.length === 0 ? (
          <p className="ios-card p-6 text-center text-[15px] text-ios-label-2">
            Nothing recorded for {monthKeyToLabel(month.monthKey)} yet.
          </p>
        ) : (
          <div className="space-y-4">
            {days.map(([day, entries]) => (
              <div key={day}>
                <p className="px-1 pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-ios-label-3">
                  {formatIsoDate(`${day}T12:00:00.000Z`)}
                </p>
                <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
                  {entries.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => setEntrySheet({ entry })}
                        className="ios-row w-full text-left active:bg-ios-surface-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[16px] font-medium">
                            {entry.note?.trim() || categoryName(entry.categoryNameEn, entry.categoryNameTa)}
                          </span>
                          <span className="block truncate text-[13px] text-ios-label-2">
                            {categoryName(entry.categoryNameEn, entry.categoryNameTa)}
                            {entry.paidByName ? ` · ${entry.paidByName} paid` : ""}
                            {entry.methodName ? ` · ${entry.methodName}` : ""}
                          </span>
                        </span>
                        {entry.shares.length > 0 ? (
                          <span className="flex-none rounded-full bg-ios-surface-2 px-2 py-0.5 text-[11px] font-medium text-ios-label-2 ring-1 ring-inset ring-ios-separator">
                            split {entry.shares.length}
                          </span>
                        ) : null}
                        <span
                          className={`flex-none text-[15px] font-semibold tabular-nums ${
                            entry.kind === "INCOME" ? "text-ios-green" : ""
                          }`}
                        >
                          {entry.kind === "INCOME" ? "+" : ""}
                          {formatPrice(entry.amount)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {month.settlements.length > 0 ? (
        <section>
          <h2 className="px-1 pb-2 text-[20px] font-semibold tracking-tight">Settled this month</h2>
          <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
            {month.settlements.map((settlement) => (
              <li key={settlement.id} className="ios-row">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">
                    {settlement.fromName} paid {settlement.toName}
                  </span>
                  <span className="block text-[12px] text-ios-label-3">
                    {formatIsoDate(settlement.settledAt)}
                    {settlement.note ? ` · ${settlement.note}` : ""}
                  </span>
                </span>
                <span className="flex-none text-[15px] font-semibold tabular-nums">
                  {formatPrice(settlement.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {entrySheet ? (
        <EntrySheet
          entry={entrySheet.entry}
          month={month}
          onClose={() => setEntrySheet(null)}
          onDelete={isAdmin && entrySheet.entry ? () => remove(entrySheet.entry as ExpenseDTO) : undefined}
        />
      ) : null}

      <PeopleSheet open={peopleOpen} month={month} onClose={() => setPeopleOpen(false)} />

      <SettleSheet
        transfer={settling}
        pending={pending}
        onClose={() => setSettling(null)}
        onSettle={(amount) => {
          const transfer = settling;
          if (!transfer) return;
          startTransition(async () => {
            const result = await settleUp({
              fromPersonId: transfer.fromPersonId,
              toPersonId: transfer.toPersonId,
              amount,
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setSettling(null);
            router.refresh();
          });
        }}
      />

      <BudgetSheet
        category={budgetFor}
        pending={pending}
        onClose={() => setBudgetFor(null)}
        onSave={(amount) => {
          const category = budgetFor;
          if (!category) return;
          startTransition(async () => {
            const result = await setCategoryBudget(category.id, amount);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setBudgetFor(null);
            router.refresh();
          });
        }}
      />
    </div>
  );
}

function SettleSheet({
  transfer,
  pending,
  onClose,
  onSettle,
}: {
  transfer: TransferDTO | null;
  pending: boolean;
  onClose: () => void;
  onSettle: (amount: number) => void;
}) {
  const [amount, setAmount] = useState("");
  const value = Number.parseFloat(amount || String(transfer?.amount ?? 0));

  return (
    <Sheet
      open={transfer !== null}
      onClose={onClose}
      title="Settle up"
      subtitle={transfer ? `${transfer.fromName} pays ${transfer.toName}` : undefined}
      footer={
        <button
          type="button"
          disabled={pending || !Number.isFinite(value) || value <= 0}
          onClick={() => onSettle(value)}
          className="flex h-12 w-full items-center justify-center rounded-ios bg-ios-blue text-[17px] font-semibold text-white active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Record payment"}
        </button>
      }
    >
      <div className="space-y-3 pb-3">
        <div className="flex items-center rounded-ios bg-ios-surface-2 px-3 ring-1 ring-inset ring-ios-separator focus-within:ring-2 focus-within:ring-ios-blue">
          <span className="text-[20px] font-semibold text-ios-label-2">₹</span>
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={transfer ? String(transfer.amount) : "0.00"}
            aria-label="Amount settled"
            className="h-12 w-full bg-transparent px-2 text-[20px] font-semibold tabular-nums outline-none"
          />
        </div>
        <p className="text-[12px] text-ios-label-3">
          Part of a debt can be paid off — the balance keeps whatever is left.
        </p>
      </div>
    </Sheet>
  );
}

function BudgetSheet({
  category,
  pending,
  onClose,
  onSave,
}: {
  category: { id: number; name: string; budget: number | null } | null;
  pending: boolean;
  onClose: () => void;
  onSave: (amount: number | null) => void;
}) {
  const [amount, setAmount] = useState("");
  const value = Number.parseFloat(amount);

  return (
    <Sheet
      open={category !== null}
      onClose={onClose}
      title="Monthly limit"
      subtitle={category?.name}
      footer={
        <div className="space-y-2">
          <button
            type="button"
            disabled={pending || !Number.isFinite(value) || value <= 0}
            onClick={() => onSave(value)}
            className="flex h-12 w-full items-center justify-center rounded-ios bg-ios-blue text-[17px] font-semibold text-white active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? "Saving…" : "Set limit"}
          </button>
          {category?.budget !== null && category !== null ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onSave(null)}
              className="h-11 w-full text-[16px] font-medium text-ios-red active:opacity-60"
            >
              Remove the limit
            </button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-3 pb-3">
        <div className="flex items-center rounded-ios bg-ios-surface-2 px-3 ring-1 ring-inset ring-ios-separator focus-within:ring-2 focus-within:ring-ios-blue">
          <span className="text-[20px] font-semibold text-ios-label-2">₹</span>
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={category?.budget !== null && category ? String(category.budget) : "0.00"}
            aria-label="Monthly limit"
            className="h-12 w-full bg-transparent px-2 text-[20px] font-semibold tabular-nums outline-none"
          />
        </div>
        <p className="text-[12px] text-ios-label-3">
          One limit that applies every month, not a figure to re-enter each time.
        </p>
      </div>
    </Sheet>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
      <path
        d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19.5v-1a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v1M16 10.5a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8zM15.5 14.2h.7a3.3 3.3 0 0 1 3.3 3.3v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
