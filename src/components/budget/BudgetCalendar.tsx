"use client";

import { useMemo } from "react";

import { daysInMonth, dateKeyOf, firstWeekdayOfMonth } from "@/lib/dates";
import { formatPrice } from "@/lib/units";
import type { OccurrenceDTO } from "@/lib/budget/types";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** Dot colour by state — green paid, red overdue, grey skipped, blue planned. */
function dotClass(state: OccurrenceDTO["state"]): string {
  switch (state) {
    case "PAID":
      return "bg-ios-green";
    case "OVERDUE":
      return "bg-ios-red";
    case "SKIPPED":
      return "bg-ios-label-3";
    default:
      return "bg-ios-blue";
  }
}

export function BudgetCalendar({
  monthKey,
  today,
  occurrences,
  selectedDay,
  onSelectDay,
}: {
  monthKey: string;
  today: string;
  occurrences: OccurrenceDTO[];
  selectedDay: string | null;
  onSelectDay: (dateKey: string) => void;
}) {
  const byDate = useMemo(() => {
    const map = new Map<string, OccurrenceDTO[]>();
    for (const occurrence of occurrences) {
      const list = map.get(occurrence.dueDate);
      if (list) list.push(occurrence);
      else map.set(occurrence.dueDate, [occurrence]);
    }
    return map;
  }, [occurrences]);

  const cells = useMemo(() => {
    const [year, month] = monthKey.split("-").map(Number);
    const lead = firstWeekdayOfMonth(monthKey);
    const total = daysInMonth(year, month);

    const result: (string | null)[] = [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: total }, (_, index) => dateKeyOf(monthKey, index + 1)),
    ];
    // Pad the final row so the grid stays rectangular.
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [monthKey]);

  return (
    <section className="ios-card p-3">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-ios-label-3"
          >
            {label}
          </div>
        ))}

        {cells.map((dateKey, index) => {
          if (dateKey === null) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const dayOccurrences = byDate.get(dateKey) ?? [];
          const isToday = dateKey === today;
          const isSelected = dateKey === selectedDay;
          const dayTotal = dayOccurrences.reduce(
            (sum, occurrence) => sum + (occurrence.paidAmount ?? occurrence.plannedAmount),
            0,
          );

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDay(dateKey)}
              aria-label={`${dateKey}, ${dayOccurrences.length} expense${dayOccurrences.length === 1 ? "" : "s"}`}
              aria-pressed={isSelected}
              className={`flex aspect-square flex-col items-center justify-start gap-0.5 rounded-[0.6rem] p-1 transition active:scale-95 ${
                isSelected ? "bg-ios-blue-soft ring-2 ring-ios-blue" : "hover:bg-ios-surface-2"
              }`}
            >
              <span
                className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-medium tabular-nums ${
                  isToday ? "bg-ios-blue font-semibold text-white" : "text-ios-label"
                }`}
              >
                {Number(dateKey.slice(8))}
              </span>

              {dayOccurrences.length > 0 ? (
                <>
                  <span className="flex items-center gap-0.5">
                    {dayOccurrences.slice(0, 3).map((occurrence) => (
                      <span
                        key={occurrence.key}
                        className={`h-1.5 w-1.5 rounded-full ${dotClass(occurrence.state)}`}
                      />
                    ))}
                    {dayOccurrences.length > 3 ? (
                      <span className="text-[9px] font-semibold leading-none text-ios-label-3">
                        +{dayOccurrences.length - 3}
                      </span>
                    ) : null}
                  </span>
                  {/* Only wide enough for an amount from the sm breakpoint up. */}
                  <span className="hidden text-[9px] leading-none tabular-nums text-ios-label-3 sm:block">
                    {formatPrice(dayTotal).replace(".00", "")}
                  </span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
