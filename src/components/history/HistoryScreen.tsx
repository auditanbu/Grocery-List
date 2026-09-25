"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PriceMoves } from "@/components/history/PriceMoves";
import { ListSearchBar } from "@/components/list/ListSearchBar";
import { monthKeyToLabel } from "@/lib/dates";
import { matchesName } from "@/lib/language";
import { formatPrice, formatQty } from "@/lib/units";
import type { ListSummaryDTO, PriceMoveDTO } from "@/lib/types";

type HistoryScreenProps = {
  /** Every item with a price on record — what the search reaches. */
  items: PriceMoveDTO[];
  /** The steepest movers among them, worked out on the server. */
  moves: PriceMoveDTO[];
  lists: ListSummaryDTO[];
};

/**
 * The History tab.
 *
 * Its two standing sections answer "what changed" and "what did each month
 * cost". The search answers the third question, the one they cannot: what
 * did I last pay for *this*. That reaches every item ever bought, not just
 * the dozen that moved, so while there is something typed the results take
 * the screen — a list of matches under two lists that do not match is a
 * screen you have to hunt through.
 */
export function HistoryScreen({ items, moves, lists }: HistoryScreenProps) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!needle) return [];
    return items
      .filter(
        (item) => matchesName(item, needle) || item.categoryName.toLowerCase().includes(needle),
      )
      .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
  }, [items, needle]);

  const completed = lists.filter((list) => list.totalSpent > 0);
  const totalSpent = completed.reduce((sum, list) => sum + list.totalSpent, 0);

  return (
    // Bottom padding clears the pinned search bar, as on the list screen.
    <div className="space-y-6 pb-16">
      <header className="pt-2">
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">History</h1>
        <p className="text-[15px] text-ios-label-2">
          {completed.length} month{completed.length === 1 ? "" : "s"} recorded ·{" "}
          {formatPrice(totalSpent)} total
        </p>
      </header>

      {needle ? (
        <section>
          <h2 className="px-1 pb-2 text-[20px] font-semibold tracking-tight">
            Matching items
            {results.length > 0 ? (
              <span className="font-medium text-ios-label-3"> · {results.length}</span>
            ) : null}
          </h2>
          {results.length === 0 ? (
            <p className="ios-card p-5 text-[15px] text-ios-label-2">
              Nothing matched &ldquo;{query.trim()}&rdquo;. Only items you have bought at least
              once are in here.
            </p>
          ) : (
            <PriceMoves changes={results} />
          )}
        </section>
      ) : (
        <>
          <section>
            <h2 className="px-1 pb-2 text-[20px] font-semibold tracking-tight">
              Biggest price moves
            </h2>
            {moves.length === 0 ? (
              <p className="ios-card p-5 text-[15px] text-ios-label-2">
                Once you have bought an item in two different months, the change shows up here.
              </p>
            ) : (
              <PriceMoves changes={moves} />
            )}
          </section>

          <section>
            <h2 className="px-1 pb-2 text-[20px] font-semibold tracking-tight">Monthly spend</h2>
            {lists.length === 0 ? (
              <p className="ios-card p-5 text-[15px] text-ios-label-2">No lists yet.</p>
            ) : (
              <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
                {lists.map((list) => (
                  <li key={list.id}>
                    <Link
                      href={`/grocery/lists/${list.id}`}
                      className="ios-row active:bg-ios-surface-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-medium">{list.name}</span>
                        <span className="block text-[13px] text-ios-label-2">
                          {monthKeyToLabel(list.monthKey)} · {list.purchasedCount}/{list.itemCount}{" "}
                          bought
                        </span>
                      </span>
                      <span className="text-[15px] font-semibold tabular-nums">
                        {list.totalSpent > 0 ? formatPrice(list.totalSpent) : "—"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="px-1 text-[13px] text-ios-label-3">
            Quantities are recorded with each purchase, e.g. {formatQty(0.5, "KG")} or{" "}
            {formatQty(150, "G")}.
          </p>
        </>
      )}

      <ListSearchBar value={query} onChange={setQuery} placeholder="Search purchased items" />
    </div>
  );
}
