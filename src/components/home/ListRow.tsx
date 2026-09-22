"use client";

import Link from "next/link";

import { formatIsoDate, monthKeyToLabel } from "@/lib/dates";
import { formatPrice } from "@/lib/units";
import type { ListSummaryDTO } from "@/lib/types";

const STATUS_STYLES: Record<ListSummaryDTO["status"], string> = {
  DRAFT: "bg-ios-surface-2 text-ios-label-2",
  FINALIZED: "bg-ios-blue-soft text-ios-blue",
  COMPLETED: "bg-ios-green-soft text-ios-green",
};

const STATUS_LABELS: Record<ListSummaryDTO["status"], string> = {
  DRAFT: "Draft",
  FINALIZED: "Ready to shop",
  COMPLETED: "Done",
};

/**
 * A "Previous lists" row — a compact link, and nothing else. Deleting a list
 * lives inside the list, in its own menu: a bin sitting on the row you tap to
 * open it is one slip away from taking a month's shopping with it.
 */
export function ListRow({ list }: { list: ListSummaryDTO }) {
  return (
    <Link href={`/grocery/lists/${list.id}`} className="ios-row active:bg-ios-surface-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-medium">{list.name}</p>
        <p className="truncate text-[13px] text-ios-label-2">
          {monthKeyToLabel(list.monthKey)} · {list.itemCount} items
          {list.totalSpent > 0 ? ` · ${formatPrice(list.totalSpent)}` : ""}
        </p>
        {/* When the shopping happened, which is what you look for on an old
            list — falling back to when it was made, so a row never lacks a date. */}
        <p className="truncate text-[12px] text-ios-label-3">
          {list.purchasedAt
            ? `Purchased ${formatIsoDate(list.purchasedAt)}`
            : `Made ${formatIsoDate(list.createdAt)}`}
        </p>
      </div>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[list.status]}`}>
        {STATUS_LABELS[list.status]}
      </span>
      <Chevron />
    </Link>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none text-ios-label-3" aria-hidden>
      <path
        d="M9 5l7 7-7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
      <path
        d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
