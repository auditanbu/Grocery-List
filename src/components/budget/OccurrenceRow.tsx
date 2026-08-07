"use client";

import { dateKeyToShortLabel } from "@/lib/dates";
import { formatPrice } from "@/lib/units";
import type { OccurrenceDTO } from "@/lib/budget/types";

import { CategoryIcon, colorClass } from "./icons";

export function StatePill({ state }: { state: OccurrenceDTO["state"] }) {
  const styles: Record<OccurrenceDTO["state"], string> = {
    PAID: "bg-ios-green-soft text-ios-green",
    OVERDUE: "bg-ios-red-soft text-ios-red",
    DUE_TODAY: "bg-ios-orange/15 text-ios-orange",
    PLANNED: "bg-ios-surface-2 text-ios-label-2",
    SKIPPED: "bg-ios-surface-2 text-ios-label-3",
  };
  const labels: Record<OccurrenceDTO["state"], string> = {
    PAID: "Paid",
    OVERDUE: "Overdue",
    DUE_TODAY: "Due today",
    PLANNED: "Planned",
    SKIPPED: "Skipped",
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[state]}`}>
      {labels[state]}
    </span>
  );
}

/** One expense occurrence, used by both the list view and the day sheet. */
export function OccurrenceRow({
  occurrence,
  onOpen,
  showDate = true,
}: {
  occurrence: OccurrenceDTO;
  onOpen: (occurrence: OccurrenceDTO) => void;
  showDate?: boolean;
}) {
  const paid = occurrence.paidAmount;
  const differs = paid !== null && Math.abs(paid - occurrence.plannedAmount) >= 0.01;

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(occurrence)}
        className="ios-row w-full text-left active:opacity-60"
      >
        <span
          className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${colorClass(occurrence.colorKey)}`}
        >
          <CategoryIcon iconKey={occurrence.iconKey} className="h-4.5 w-4.5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-medium">{occurrence.name}</span>
          <span className="block truncate text-[13px] text-ios-label-2">
            {showDate ? `${dateKeyToShortLabel(occurrence.dueDate)} · ` : ""}
            {occurrence.categoryName}
            {occurrence.detached ? " · moved" : ""}
          </span>
        </span>

        <span className="flex flex-none flex-col items-end gap-0.5">
          <span className="text-[16px] font-semibold tabular-nums">
            {formatPrice(paid ?? occurrence.plannedAmount)}
          </span>
          {differs ? (
            <span className="text-[11px] tabular-nums text-ios-label-3 line-through">
              {formatPrice(occurrence.plannedAmount)}
            </span>
          ) : (
            <StatePill state={occurrence.state} />
          )}
        </span>
      </button>
    </li>
  );
}
