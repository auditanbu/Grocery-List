"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { AdminLoginButton } from "@/components/AdminLoginButton";
import { Sheet } from "@/components/Sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EntrySheet } from "@/components/expenses/EntrySheet";
import {
  deleteExpense,
  deleteTrip,
  settleTrip,
  setTripClosed,
  updateTrip,
} from "@/lib/expenses/actions";
import { useAdmin } from "@/lib/admin-context";
import { formatIsoDate } from "@/lib/dates";
import { formatPrice } from "@/lib/units";
import type {
  ExpenseDTO,
  ExpenseMonthDTO,
  TransferDTO,
  TripDetailDTO,
} from "@/lib/expenses/types";

/**
 * One trip's own page: its expenses, its total, and its balance — settled
 * as a unit, independent of the household's ongoing balance. What "split
 * the trip equally at the end" looks like once it is open.
 */
export function TripView({ trip }: { trip: TripDetailDTO }) {
  const router = useRouter();
  const { isAdmin } = useAdmin();
  const [entrySheet, setEntrySheet] = useState<{ open: boolean; entry: ExpenseDTO | null }>({
    open: false,
    entry: null,
  });
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settling, setSettling] = useState<TransferDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const days = useMemo(() => {
    const grouped = new Map<string, ExpenseDTO[]>();
    for (const entry of trip.entries) {
      const day = entry.spentAt.slice(0, 10);
      grouped.set(day, [...(grouped.get(day) ?? []), entry]);
    }
    return [...grouped.entries()];
  }, [trip.entries]);

  // What this trip cost, broken down by what it was for — the total on its
  // own answers "how much", not "on what".
  const categoryTotals = useMemo(() => {
    const totals = new Map<number, { nameEn: string; total: number }>();
    for (const entry of trip.entries) {
      const current = totals.get(entry.categoryId);
      totals.set(entry.categoryId, {
        nameEn: entry.categoryNameEn,
        total: (current?.total ?? 0) + entry.amount,
      });
    }
    return [...totals.entries()]
      .map(([categoryId, { nameEn, total }]) => ({ categoryId, nameEn, total }))
      .sort((a, b) => b.total - a.total);
  }, [trip.entries]);

  // What EntrySheet needs, shaped as the one-trip ExpenseMonthDTO it expects
  // — the trip page's "Add expense" opens the same sheet already in this
  // trip's context, rather than a second form.
  const monthShim: ExpenseMonthDTO = {
    monthKey: "",
    spent: 0,
    income: 0,
    entries: [],
    categoryTotals: [],
    settlements: [],
    balances: [],
    transfers: [],
    categories: trip.categories,
    people: trip.people,
    methods: trip.methods,
    openTrips: [
      {
        id: trip.id,
        name: trip.name,
        closedAt: trip.closedAt,
        participantIds: trip.participants.map((person) => person.id),
        participantNames: trip.participants.map((person) => person.name),
        total: trip.total,
        settled: trip.balances.length === 0,
      },
    ],
  };

  const remove = (entry: ExpenseDTO) => {
    if (!window.confirm(`Delete ${formatPrice(entry.amount)} from this trip? This can't be undone.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteExpense(entry.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEntrySheet({ open: false, entry: null });
      router.refresh();
    });
  };

  const toggleClosed = () => {
    startTransition(async () => {
      await setTripClosed(trip.id, trip.closedAt === null);
      router.refresh();
    });
  };

  const removeTrip = () => {
    if (
      !window.confirm(
        `Delete "${trip.name}"? All ${trip.entries.length} of its expenses go with it. This can't be undone.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteTrip(trip.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/expenses");
    });
  };

  return (
    <div className="space-y-6 pb-4">
      <Link href="/expenses" className="inline-flex items-center gap-1 pt-1 text-[15px] text-ios-blue">
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path
            d="M15 5l-7 7 7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Expenses
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[30px] font-bold leading-tight tracking-tight">{trip.name}</h1>
          <p className="truncate text-[15px] text-ios-label-2">
            {trip.participants.map((person) => person.name).join(", ")}
            {trip.closedAt ? " · Closed" : ""}
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Trip options"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ios-surface text-ios-blue shadow-ios active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
              <path
                d="M4 7h16M4 12h16M4 17h16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      {error ? (
        <p className="rounded-ios bg-ios-red-soft px-4 py-3 text-[14px] text-ios-red">{error}</p>
      ) : null}

      <section className="ios-card p-5">
        <p className="text-[13px] text-ios-label-2">Total spent on this trip</p>
        <p className="text-[32px] font-bold leading-none tabular-nums tracking-tight">
          {formatPrice(trip.total)}
        </p>
        <p className="mt-2 text-[12px] text-ios-label-3">
          Every expense here defaults to an equal split across everyone on the trip.
        </p>
      </section>

      {categoryTotals.length > 0 ? (
        <section>
          <h2 className="px-1 pb-2 text-[20px] font-semibold tracking-tight">By category</h2>
          <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
            {categoryTotals.map((total) => (
              <li key={total.categoryId} className="ios-row">
                <span className="min-w-0 flex-1 truncate text-[16px] font-medium">{total.nameEn}</span>
                <span className="flex-none text-[15px] font-semibold tabular-nums">
                  {formatPrice(total.total)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="px-1 pb-2 text-[20px] font-semibold tracking-tight">Balance</h2>
        {trip.balances.length === 0 ? (
          <p className="ios-card p-5 text-[15px] text-ios-label-2">
            {trip.entries.length === 0
              ? "Add an expense to get started."
              : "Fully settled — nobody owes anybody on this trip."}
          </p>
        ) : (
          <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
            {trip.balances.flatMap((balance) => {
              if (balance.net > 0) {
                return (
                  <li key={balance.personId} className="ios-row">
                    <span className="min-w-0 flex-1 truncate text-[16px] font-medium">
                      {balance.personName}
                    </span>
                    <span className="flex-none text-[15px] font-semibold tabular-nums text-ios-green">
                      is owed {formatPrice(balance.net)}
                    </span>
                  </li>
                );
              }

              // Each debt this person still owes — usually just one, but the
              // debt-minimising split can leave someone owing two different
              // people, so a settle icon goes with each one.
              const debts = trip.transfers.filter((transfer) => transfer.fromPersonId === balance.personId);
              if (debts.length === 0) {
                return (
                  <li key={balance.personId} className="ios-row">
                    <span className="min-w-0 flex-1 truncate text-[16px] font-medium">
                      {balance.personName}
                    </span>
                    <span className="flex-none text-[15px] font-semibold tabular-nums text-ios-red">
                      owes {formatPrice(Math.abs(balance.net))}
                    </span>
                  </li>
                );
              }

              return debts.map((transfer) => (
                <li key={`${balance.personId}-${transfer.toPersonId}`} className="ios-row">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSettling(transfer)}
                      aria-label={`Settle up: ${transfer.fromName} pays ${transfer.toName}`}
                      title="Settle up"
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-ios-blue text-white active:scale-95"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
                        <path
                          d="M5 12.5l4.5 4.5L19 7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <span className="min-w-0 truncate text-[16px] font-medium">
                      {transfer.fromName} owes {transfer.toName}
                    </span>
                  </span>
                  <span className="flex-none text-[15px] font-semibold tabular-nums text-ios-red">
                    {formatPrice(transfer.amount)}
                  </span>
                </li>
              ));
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="px-1 pb-2 text-[20px] font-semibold tracking-tight">Expenses</h2>
        {trip.closedAt === null ? (
          <button
            type="button"
            onClick={() => setEntrySheet({ open: true, entry: null })}
            className="mb-3 h-11 w-full rounded-ios bg-ios-blue text-[15px] font-semibold text-white active:scale-[0.99]"
          >
            + Add expense
          </button>
        ) : null}
        {days.length === 0 ? (
          <p className="ios-card p-6 text-center text-[15px] text-ios-label-2">
            Nothing logged for this trip yet.
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
                        onClick={() => setEntrySheet({ open: true, entry })}
                        className="ios-row w-full text-left active:bg-ios-surface-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[16px] font-medium">
                            {entry.note?.trim() || entry.categoryNameEn}
                          </span>
                          <span className="block truncate text-[13px] text-ios-label-2">
                            {entry.categoryNameEn}
                            {entry.paidByName ? ` · ${entry.paidByName} paid` : ""}
                          </span>
                        </span>
                        {entry.shares.length > 0 && entry.shares.length !== trip.participants.length ? (
                          <span className="flex-none rounded-full bg-ios-surface-2 px-2 py-0.5 text-[11px] font-medium text-ios-label-2 ring-1 ring-inset ring-ios-separator">
                            split {entry.shares.length}
                          </span>
                        ) : null}
                        <span className="flex-none text-[15px] font-semibold tabular-nums">
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

      {trip.settlements.length > 0 ? (
        <section>
          <h2 className="px-1 pb-2 text-[20px] font-semibold tracking-tight">Settled</h2>
          <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
            {trip.settlements.map((settlement) => (
              <li key={settlement.id} className="ios-row">
                <span className="min-w-0 flex-1 truncate text-[15px]">
                  {settlement.fromName} paid {settlement.toName}
                </span>
                <span className="flex-none text-[15px] font-semibold tabular-nums">
                  {formatPrice(settlement.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {entrySheet.open ? (
        <EntrySheet
          entry={entrySheet.entry}
          month={monthShim}
          defaultTripId={entrySheet.entry ? undefined : trip.id}
          onClose={() => setEntrySheet({ open: false, entry: null })}
          onDelete={isAdmin && entrySheet.entry ? () => remove(entrySheet.entry as ExpenseDTO) : undefined}
        />
      ) : null}

      <TripMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        isAdmin={isAdmin}
        closed={trip.closedAt !== null}
        pending={pending}
        onEdit={() => {
          setMenuOpen(false);
          setEditOpen(true);
        }}
        onToggleClosed={() => {
          setMenuOpen(false);
          toggleClosed();
        }}
        onDelete={removeTrip}
      />

      <EditTripSheet open={editOpen} trip={trip} onClose={() => setEditOpen(false)} />

      <SettleTripSheet
        tripId={trip.id}
        transfer={settling}
        pending={pending}
        onClose={() => setSettling(null)}
        onSettle={(amount) => {
          const transfer = settling;
          if (!transfer) return;
          startTransition(async () => {
            const result = await settleTrip({
              tripId: trip.id,
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
    </div>
  );
}

/**
 * Everything about the trip itself, rather than its expenses: editing it,
 * closing or deleting it, plus the app-wide dark mode and admin controls —
 * one burger button instead of a header full of icons.
 */
function TripMenuSheet({
  open,
  onClose,
  isAdmin,
  closed,
  pending,
  onEdit,
  onToggleClosed,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  closed: boolean;
  pending: boolean;
  onEdit: () => void;
  onToggleClosed: () => void;
  onDelete: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Trip options">
      <div className="space-y-4 pb-3">
        <ul className="divide-y divide-ios-separator overflow-hidden rounded-ios bg-ios-surface-2">
          <li>
            <button
              type="button"
              onClick={onEdit}
              className="flex h-12 w-full items-center px-4 text-left text-[15px] font-medium text-ios-blue active:bg-ios-surface"
            >
              Edit trip
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={onToggleClosed}
              disabled={pending}
              className="flex h-12 w-full items-center px-4 text-left text-[15px] font-medium text-ios-blue active:bg-ios-surface disabled:opacity-50"
            >
              {closed ? "Reopen trip" : "Close trip"}
            </button>
          </li>
          {isAdmin ? (
            <li>
              <button
                type="button"
                onClick={onDelete}
                disabled={pending}
                className="flex h-12 w-full items-center px-4 text-left text-[15px] font-medium text-ios-red active:bg-ios-surface disabled:opacity-50"
              >
                Delete trip
              </button>
            </li>
          ) : null}
        </ul>

        <ul className="divide-y divide-ios-separator overflow-hidden rounded-ios bg-ios-surface-2">
          <li className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-[15px] font-medium">Dark mode</span>
            <ThemeToggle />
          </li>
          <li className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-[15px] font-medium">Admin</span>
            <AdminLoginButton />
          </li>
        </ul>
      </div>
    </Sheet>
  );
}

function EditTripSheet({
  open,
  trip,
  onClose,
}: {
  open: boolean;
  trip: TripDetailDTO;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(trip.name);
  const [participantIds, setParticipantIds] = useState<number[]>(
    trip.participants.map((person) => person.id),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const result = await updateTrip({ id: trip.id, name, participantIds });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Edit trip"
      footer={
        <button
          type="button"
          onClick={save}
          disabled={pending || !name.trim() || participantIds.length === 0}
          className="flex h-12 w-full items-center justify-center rounded-ios bg-ios-blue text-[17px] font-semibold text-white active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      }
    >
      <div className="space-y-4 pb-3">
        {error ? <p className="text-[14px] text-ios-red">{error}</p> : null}
        <div>
          <span className="block pb-1.5 text-[13px] font-medium text-ios-label-2">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Trip name"
            className="h-12 w-full rounded-ios bg-ios-surface-2 px-4 text-[16px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
          />
        </div>
        <div>
          <span className="block pb-1.5 text-[13px] font-medium text-ios-label-2">Who&apos;s on it</span>
          <div className="flex flex-wrap gap-2">
            {trip.people.map((person) => {
              const active = participantIds.includes(person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() =>
                    setParticipantIds((current) =>
                      current.includes(person.id)
                        ? current.filter((id) => id !== person.id)
                        : [...current, person.id],
                    )
                  }
                  className={`h-9 rounded-full px-3.5 text-[14px] font-medium transition active:scale-95 ${
                    active
                      ? "bg-ios-blue text-white"
                      : "bg-ios-surface-2 text-ios-label-2 ring-1 ring-inset ring-ios-separator"
                  }`}
                >
                  {person.name}
                </button>
              );
            })}
          </div>
          <p className="pt-1.5 text-[12px] text-ios-label-3">
            Removing someone who already has a share on this trip is refused — fix that expense first.
          </p>
        </div>
      </div>
    </Sheet>
  );
}

function SettleTripSheet({
  tripId,
  transfer,
  pending,
  onClose,
  onSettle,
}: {
  tripId: number;
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
      subtitle={transfer ? `${transfer.fromName} pays ${transfer.toName}, for this trip` : undefined}
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
      </div>
    </Sheet>
  );
}
