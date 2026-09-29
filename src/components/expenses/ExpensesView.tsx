"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { AdminLoginButton } from "@/components/AdminLoginButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EntrySheet } from "@/components/expenses/EntrySheet";
import { NewTripSheet } from "@/components/expenses/NewTripSheet";
import { PeopleSheet } from "@/components/expenses/PeopleSheet";
import { deleteExpense } from "@/lib/expenses/actions";
import { useAdmin } from "@/lib/admin-context";
import { formatIsoDate, monthKeyToLabel, shiftMonthKey } from "@/lib/dates";
import { formatPrice } from "@/lib/units";
import type { ExpenseDTO, ExpenseMonthDTO } from "@/lib/expenses/types";

export function ExpensesView({ month }: { month: ExpenseMonthDTO }) {
  const router = useRouter();
  const { isAdmin } = useAdmin();
  const [entrySheet, setEntrySheet] = useState<{ entry: ExpenseDTO | null } | null>(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [newTripOpen, setNewTripOpen] = useState(false);
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

      <section>
        <div className="flex items-center justify-between px-1 pb-2">
          <h2 className="text-[20px] font-semibold tracking-tight">Trips</h2>
          <button
            type="button"
            onClick={() => setNewTripOpen(true)}
            className="text-[14px] font-medium text-ios-blue active:opacity-60"
          >
            + New trip
          </button>
        </div>
        {month.openTrips.length === 0 ? (
          <p className="ios-card p-5 text-[15px] text-ios-label-2">
            No open trips. Start one to log a trip's expenses separately and split the whole
            thing equally when it's done.
          </p>
        ) : (
          <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
            {month.openTrips.map((trip) => (
              <li key={trip.id}>
                <Link href={`/expenses/trips/${trip.id}`} className="ios-row active:bg-ios-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-medium">{trip.name}</span>
                    <span className="block truncate text-[13px] text-ios-label-2">
                      {trip.participantNames.join(", ")}
                    </span>
                  </span>
                  <span className="flex-none text-right">
                    <span className="block text-[15px] font-semibold tabular-nums">
                      {formatPrice(trip.total)}
                    </span>
                    <span
                      className={`block text-[12px] ${trip.settled ? "text-ios-green" : "text-ios-label-3"}`}
                    >
                      {trip.settled ? "Settled" : "Unsettled"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

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
                            {entry.note?.trim() || entry.categoryNameEn}
                          </span>
                          <span className="block truncate text-[13px] text-ios-label-2">
                            {entry.tripName ? `${entry.tripName} · ` : ""}
                            {entry.categoryNameEn}
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

      <NewTripSheet open={newTripOpen} people={month.people} onClose={() => setNewTripOpen(false)} />
    </div>
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
