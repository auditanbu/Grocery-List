"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminLoginButton } from "@/components/AdminLoginButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EntrySheet } from "@/components/expenses/EntrySheet";
import { NewTripSheet } from "@/components/expenses/NewTripSheet";
import { PeopleSheet } from "@/components/expenses/PeopleSheet";
import { formatPrice } from "@/lib/units";
import type { ExpenseMonthDTO } from "@/lib/expenses/types";

/**
 * The Trips list, and nothing else — the day-to-day ledger, this month's
 * total, and settlements all belong to a trip's own page now, so this one
 * doesn't duplicate them in a second shape.
 */
export function ExpensesView({ month }: { month: ExpenseMonthDTO }) {
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [newTripOpen, setNewTripOpen] = useState(false);
  // Shut by default — a closed trip is done with, so it shouldn't compete
  // with the open ones for space every time this page loads.
  const [closedTripsOpen, setClosedTripsOpen] = useState(false);

  return (
    <div className="space-y-6 pb-4">
      <header className="flex items-end justify-between gap-3 pt-2">
        <h1 className="truncate text-[34px] font-bold leading-tight tracking-tight">Expenses</h1>
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
            onClick={() => setAddEntryOpen(true)}
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

      {month.closedTrips.length > 0 ? (
        <section>
          <button
            type="button"
            onClick={() => setClosedTripsOpen((open) => !open)}
            aria-expanded={closedTripsOpen}
            className="flex w-full items-center justify-between gap-3 px-1 pb-2"
          >
            <h2 className="text-[20px] font-semibold tracking-tight">Closed trips</h2>
            <svg
              viewBox="0 0 24 24"
              className={`h-4 w-4 flex-none text-ios-label-3 transition-transform ${
                closedTripsOpen ? "rotate-180" : ""
              }`}
              aria-hidden
            >
              <path
                d="M6 9l6 6 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {closedTripsOpen ? (
            <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
              {month.closedTrips.map((trip) => (
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
          ) : null}
        </section>
      ) : null}

      {addEntryOpen ? (
        <EntrySheet entry={null} month={month} onClose={() => setAddEntryOpen(false)} />
      ) : null}

      <PeopleSheet open={peopleOpen} month={month} onClose={() => setPeopleOpen(false)} />

      <NewTripSheet open={newTripOpen} people={month.people} onClose={() => setNewTripOpen(false)} />
    </div>
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
