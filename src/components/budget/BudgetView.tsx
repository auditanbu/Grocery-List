"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { AdminLoginButton } from "@/components/AdminLoginButton";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Sheet } from "@/components/Sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAdmin } from "@/lib/admin-context";
import { dateKeyToLabel, monthKeyToLabel, shiftMonthKey } from "@/lib/dates";
import { formatPrice } from "@/lib/units";
import type { BudgetOverviewDTO, OccurrenceDTO } from "@/lib/budget/types";

import { BudgetCalendar } from "./BudgetCalendar";
import { BudgetList } from "./BudgetList";
import { OccurrenceRow } from "./OccurrenceRow";
import { OccurrenceSheet } from "./OccurrenceSheet";
import { RemindersSheet } from "./RemindersSheet";

type Mode = "calendar" | "list";

export function BudgetView({ overview }: { overview: BudgetOverviewDTO }) {
  const { isAdmin } = useAdmin();
  // Both views render from data already in memory, so switching needs no
  // server round-trip. The *month* stays in the URL so push deep links work.
  const [mode, setMode] = useState<Mode>("calendar");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selected, setSelected] = useState<OccurrenceDTO | null>(null);
  const [remindersOpen, setRemindersOpen] = useState(false);

  const dayOccurrences = useMemo(
    () =>
      selectedDay === null
        ? []
        : overview.monthOccurrences.filter((occurrence) => occurrence.dueDate === selectedDay),
    [overview.monthOccurrences, selectedDay],
  );

  const outstanding = overview.plannedTotal - overview.paidTotal;
  const percent =
    overview.plannedTotal > 0
      ? Math.min(100, Math.round((overview.paidTotal / overview.plannedTotal) * 100))
      : 0;

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 pt-2">
        <div className="min-w-0">
          <p className="text-[13px] font-medium uppercase tracking-wide text-ios-label-2">
            Household
          </p>
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">Budget</h1>
        </div>
        <div className="flex flex-none items-center gap-2">
          <button
            type="button"
            onClick={() => setRemindersOpen(true)}
            aria-label="Reminders"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ios-surface text-ios-blue shadow-ios active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
              <path
                d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 3.2.8 5 1.5 6h-14c.7-1 1.5-2.8 1.5-6zM10 18.5a2 2 0 0 0 4 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {isAdmin ? (
            <Link
              href="/budget/expenses"
              aria-label="Manage expenses"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-ios-surface text-ios-blue shadow-ios active:scale-95"
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
                <path
                  d="M4 6.5h16M4 12h16M4 17.5h10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </Link>
          ) : null}
          <AdminLoginButton />
          <ThemeToggle />
        </div>
      </header>

      <div className="flex items-center justify-between px-1">
        <Link
          href={`/budget?month=${shiftMonthKey(overview.monthKey, -1)}`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ios-surface text-ios-blue shadow-ios active:scale-95"
          aria-label="Previous month"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <p className="text-[15px] font-medium text-ios-label-2">
          {monthKeyToLabel(overview.monthKey)}
        </p>
        <Link
          href={`/budget?month=${shiftMonthKey(overview.monthKey, 1)}`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ios-surface text-ios-blue shadow-ios active:scale-95"
          aria-label="Next month"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {/*
        The in-app alert is the reliable half of "notify us on expense dates":
        it works on every device regardless of push support or cron setup.
      */}
      {overview.overdue.length > 0 ? (
        <button
          type="button"
          onClick={() => setMode("list")}
          className="ios-card flex w-full items-center gap-3 bg-ios-red-soft p-4 text-left active:opacity-70"
        >
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ios-red/15 text-ios-red">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path d="M12 7.5v5.5M12 16.2v.3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-ios-red">
              {overview.overdue.length} overdue
            </span>
            <span className="block truncate text-[13px] text-ios-red/80">
              {formatPrice(overview.overdue.reduce((sum, o) => sum + o.plannedAmount, 0))} ·{" "}
              {overview.overdue.map((o) => o.name).join(", ")}
            </span>
          </span>
        </button>
      ) : null}

      {overview.dueSoon.length > 0 ? (
        <div className="ios-card bg-ios-orange/10 p-4">
          <p className="text-[15px] font-semibold text-ios-orange">Due in the next 7 days</p>
          <ul className="mt-1 space-y-0.5">
            {overview.dueSoon.map((occurrence) => (
              <li key={occurrence.key} className="text-[13px] text-ios-label-2">
                {occurrence.name} · {formatPrice(occurrence.plannedAmount)} ·{" "}
                {occurrence.state === "DUE_TODAY" ? "today" : dateKeyToLabel(occurrence.dueDate)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="ios-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] text-ios-label-2">
              Paid of {formatPrice(overview.plannedTotal)} planned
            </p>
            <p className="text-[28px] font-bold tabular-nums tracking-tight">
              {formatPrice(overview.paidTotal)}
            </p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-ios-surface-2">
          <div
            className="h-full rounded-full bg-ios-green transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-[14px] font-medium text-ios-label-2">
          {outstanding > 0.01
            ? `${formatPrice(outstanding)} still to pay`
            : overview.plannedTotal > 0
              ? "Everything paid this month"
              : "Nothing scheduled this month"}
        </p>
      </section>

      <SegmentedControl<Mode>
        options={[
          { value: "calendar", label: "Calendar" },
          { value: "list", label: "List", badge: overview.monthOccurrences.length },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === "calendar" ? (
        <BudgetCalendar
          monthKey={overview.monthKey}
          today={overview.today}
          occurrences={overview.monthOccurrences}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
        />
      ) : (
        <BudgetList occurrences={overview.monthOccurrences} onOpen={setSelected} />
      )}

      {overview.expenses.length === 0 ? (
        <section className="ios-card p-8 text-center">
          <p className="text-[16px] font-medium">No expenses yet</p>
          <p className="mt-1 text-[14px] text-ios-label-2">
            {isAdmin
              ? "Add rent, bills and insurance to see them on the calendar."
              : "An admin can add the household's bills here."}
          </p>
          {isAdmin ? (
            <Link
              href="/budget/expenses"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-ios bg-ios-blue px-5 text-[15px] font-semibold text-white active:scale-[0.98]"
            >
              Add an expense
            </Link>
          ) : null}
        </section>
      ) : null}

      <Sheet
        open={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? dateKeyToLabel(selectedDay) : ""}
        subtitle={
          dayOccurrences.length === 0
            ? "Nothing due"
            : `${dayOccurrences.length} expense${dayOccurrences.length === 1 ? "" : "s"} · ${formatPrice(
                dayOccurrences.reduce((sum, o) => sum + (o.paidAmount ?? o.plannedAmount), 0),
              )}`
        }
      >
        {dayOccurrences.length === 0 ? (
          <p className="py-4 text-center text-[15px] text-ios-label-2">
            Nothing is due on this date.
          </p>
        ) : (
          <ul className="divide-y divide-ios-separator">
            {dayOccurrences.map((occurrence) => (
              <OccurrenceRow
                key={occurrence.key}
                occurrence={occurrence}
                showDate={false}
                onOpen={(picked) => {
                  setSelectedDay(null);
                  setSelected(picked);
                }}
              />
            ))}
          </ul>
        )}
      </Sheet>

      <OccurrenceSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        occurrence={selected}
        today={overview.today}
      />

      <RemindersSheet
        open={remindersOpen}
        onClose={() => setRemindersOpen(false)}
        pushConfigured={overview.pushConfigured}
        vapidPublicKey={overview.vapidPublicKey}
      />
    </div>
  );
}
