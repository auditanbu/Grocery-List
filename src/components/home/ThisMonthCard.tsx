"use client";

import Link from "next/link";

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
 * One of this month's lists — the home page can now hold several. Tapping it
 * opens the list; deleting one lives inside, in the list's own menu.
 */
export function ThisMonthCard({ list }: { list: ListSummaryDTO }) {
  const percent = list.itemCount === 0 ? 0 : Math.round((list.purchasedCount / list.itemCount) * 100);

  return (
    <div className="ios-card relative overflow-hidden">
      <Link href={`/grocery/lists/${list.id}`} className="block active:opacity-70">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-[20px] font-semibold tracking-tight">{list.name}</p>
            <span
              className={`flex-none rounded-full px-2.5 py-1 text-[12px] font-semibold ${STATUS_STYLES[list.status]}`}
            >
              {STATUS_LABELS[list.status]}
            </span>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[13px] text-ios-label-2">
              <span>
                {list.purchasedCount} of {list.itemCount} bought
              </span>
              <span className="tabular-nums">
                {list.totalSpent > 0 ? formatPrice(list.totalSpent) : `${percent}%`}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-ios-surface-2">
              <div
                className="h-full rounded-full bg-ios-blue transition-[width] duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
