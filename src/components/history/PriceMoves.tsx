"use client";

import Link from "next/link";
import { useState } from "react";

import { PriceDelta } from "@/components/PriceDelta";
import { getItemPriceHistory } from "@/lib/actions";
import { formatPrice, formatQtyWithSize, sizeOf } from "@/lib/units";
import type { PriceHistoryDTO, PriceMoveDTO } from "@/lib/types";

/** How much of an item's history the row shows before handing over to its page. */
const INLINE_ENTRIES = 3;

/**
 * "Biggest price moves", where a row opens in place rather than navigating.
 *
 * Seeing why something moved takes the last few prices, which is a glance,
 * not a destination — leaving the screen to read three lines lost the list
 * you were scanning. So a tap unfolds the row; *Show all* still goes to the
 * item's own page for the full record.
 *
 * One at a time: two open rows push the rest off-screen, and the point of
 * the list is comparing what moved against what else did.
 */
export function PriceMoves({ changes }: { changes: PriceMoveDTO[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [historyByItem, setHistoryByItem] = useState<
    Record<number, PriceHistoryDTO[] | undefined>
  >({});

  const toggle = (itemId: number) => {
    setExpandedId((current) => (current === itemId ? null : itemId));
    // Fetched once per item and kept: re-opening a row should not blink.
    if (!(itemId in historyByItem)) {
      getItemPriceHistory(itemId).then((history) =>
        setHistoryByItem((previous) => ({ ...previous, [itemId]: history })),
      );
    }
  };

  return (
    <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
      {changes.map((change) => {
        const expanded = expandedId === change.itemId;
        const history = historyByItem[change.itemId];
        return (
          <li key={change.itemId}>
            <button
              type="button"
              onClick={() => toggle(change.itemId)}
              aria-expanded={expanded}
              className="ios-row w-full text-left active:bg-ios-surface-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-medium">{change.nameTa}</span>
                {/* Wraps rather than truncates: the amount is the half of
                    this line that makes the price mean anything, and it is
                    the half that falls off the end. */}
                <span className="block text-[13px] text-ios-label-2">
                  {change.nameEn} · {formatPrice(change.current)} for{" "}
                  {formatQtyWithSize(
                    change.currentRawQuantity,
                    change.unitType,
                    sizeOf(change.currentSizeValue, change.currentSizeUnit),
                  )}
                </span>
              </span>
              <PriceDelta
                current={change.current}
                previous={change.previous}
                currentQuantity={change.currentQuantity}
                currentUnitType={change.currentUnitType}
                previousQuantity={change.previousQuantity ?? undefined}
                previousUnitType={change.previousUnitType ?? undefined}
              />
              <svg
                viewBox="0 0 24 24"
                className={`ml-1 h-4 w-4 flex-none text-ios-label-3 transition-transform ${
                  expanded ? "rotate-180" : ""
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

            {expanded ? (
              <div className="bg-ios-surface-2 px-4 py-3">
                {history === undefined ? (
                  <p className="text-[13px] text-ios-label-2">Loading…</p>
                ) : history.length === 0 ? (
                  <p className="text-[13px] text-ios-label-2">No purchases recorded yet.</p>
                ) : (
                  <>
                    <ul className="divide-y divide-ios-separator overflow-hidden rounded-ios bg-ios-surface">
                      {history.slice(0, INLINE_ENTRIES).map((entry) => (
                        <li
                          key={entry.id}
                          className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                        >
                          <span className="text-[14px] font-medium tabular-nums">
                            {formatPrice(entry.price)}
                            <span className="ml-1.5 text-[12px] font-normal text-ios-label-2">
                              for{" "}
                              {formatQtyWithSize(
                                entry.quantity,
                                entry.unitType,
                                sizeOf(entry.sizeValue, entry.sizeUnit),
                              )}
                            </span>
                          </span>
                          {/* Shop first — where you bought it is what makes an
                              old price worth comparing; the list only dates it. */}
                          <span className="min-w-0 text-right text-[12px] text-ios-label-3">
                            <span className="block truncate">
                              {entry.shopName ?? "Shop not set"}
                            </span>
                            {entry.listName ? (
                              <span className="block truncate text-ios-label-3/70">
                                {entry.listName}
                              </span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/grocery/items/${change.itemId}`}
                      className="mt-2 flex h-9 items-center justify-center rounded-full bg-ios-surface px-3.5 text-[14px] font-medium text-ios-blue ring-1 ring-inset ring-ios-separator active:scale-95"
                    >
                      Show all
                    </Link>
                  </>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
