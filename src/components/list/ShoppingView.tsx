"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { PriceDelta } from "@/components/PriceDelta";
import { PurchaseSheet } from "@/components/list/PurchaseSheet";
import { groupByShop } from "@/components/list/DraftEditor";
import { completeList } from "@/lib/actions";
import { displayName, useLanguage } from "@/lib/language";
import { formatPrice, formatQty } from "@/lib/units";
import type { ListDetailDTO, ListItemDTO } from "@/lib/types";

type ShoppingViewProps = {
  list: ListDetailDTO;
  /** Already narrowed by ListScreen's filter icons and the search bar. */
  items: ListItemDTO[];
  /** False on a completed list until the header "Edit" button unlocks it. */
  editable: boolean;
  /** Worded upstream — only ListScreen knows all three filter dimensions. */
  emptyMessage: string;
};

export function ShoppingView({ list, items, editable, emptyMessage }: ShoppingViewProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const [active, setActive] = useState<ListItemDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Checked-off items sink to the bottom of their shop's section so the
  // remaining to-buy items stay at the top while shopping.
  const groupedByShop = useMemo(() => {
    return groupByShop(items).map(
      ([shopName, shopItems]) =>
        [shopName, [...shopItems].sort((a, b) => Number(a.isPurchased) - Number(b.isPurchased))] as const,
    );
  }, [items]);

  const purchased = items.filter((item) => item.isPurchased);
  const spent = purchased.reduce((sum, item) => sum + (item.purchasePrice ?? 0), 0);
  // "Finish shopping" completes the whole list, so it must reflect the
  // list's true completion — not just what the shop/category filters show.
  const allDone = list.items.length > 0 && list.items.every((item) => item.isPurchased);
  // Based on the list's own status, not `editable`: unlocking a finished list
  // to fix a price should not strip the record you came to look at.
  const isCompleted = list.status === "COMPLETED";

  const complete = () => {
    startTransition(async () => {
      const result = await completeList(list.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-ios bg-ios-red-soft px-4 py-3 text-[14px] text-ios-red">{error}</p>
      ) : null}

      {items.length === 0 ? (
        <p className="ios-card p-6 text-center text-[15px] text-ios-label-2">{emptyMessage}</p>
      ) : (
        groupedByShop.map(([shopName, shopItems]) => (
          <section key={shopName}>
            <p className="px-1 pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-ios-label-3">
              {shopName} · {shopItems.filter((item) => item.isPurchased).length}/{shopItems.length}
            </p>
            <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
              {shopItems.map((item) => {
                const name = displayName(item, language);
                return (
                <li key={item.id}>
                  <div className="flex w-full items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setActive(item)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left transition active:opacity-70"
                    >
                      {/* Large tap target, per iOS touch guidance. */}
                      <span
                        aria-hidden
                        className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 transition ${
                          item.isPurchased
                            ? "border-ios-green bg-ios-green text-white"
                            : "border-ios-separator"
                        }`}
                      >
                        {item.isPurchased ? (
                          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                            <path
                              d="M5 13l4.5 4.5L19 7"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </span>

                      <span className="min-w-0 flex-1">
                        {/* One name only — the second language belongs in the
                            toggle, not stacked under every row. */}
                        <span
                          className={`block truncate text-[16px] font-medium ${
                            item.isPurchased ? "text-ios-label-3" : ""
                          }`}
                        >
                          {name.primary}
                        </span>
                        {/* A finished list is a record, so it keeps what was
                            paid and where. While shopping, that lives in the
                            purchase sheet instead of crowding the row. */}
                        {isCompleted && item.isPurchased ? (
                          <span className="mt-0.5 flex flex-wrap items-center gap-2">
                            <span className="text-[14px] font-semibold tabular-nums">
                              {formatPrice(item.purchasePrice ?? 0)}
                            </span>
                            <span className="text-[13px] text-ios-label-2">
                              at {item.shopName ?? "Not set"}
                            </span>
                            <PriceDelta
                              current={item.purchasePrice ?? 0}
                              previous={item.previousPrice}
                              currentQuantity={item.quantity}
                              currentUnitType={item.unitType}
                              previousQuantity={item.previousQuantity ?? undefined}
                              previousUnitType={item.previousUnitType ?? undefined}
                            />
                          </span>
                        ) : isCompleted ? (
                          <span className="mt-0.5 block text-[13px] text-ios-label-3">
                            Not bought
                          </span>
                        ) : null}
                      </span>
                    </button>

                    <span
                      className={`flex-none text-[16px] font-semibold tabular-nums ${
                        item.isPurchased ? "text-ios-label-3" : ""
                      }`}
                    >
                      {formatQty(item.quantity, item.unitType)}
                    </span>
                  </div>

                </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {allDone && list.status !== "COMPLETED" ? (
        <button
          type="button"
          onClick={complete}
          disabled={pending}
          className="flex h-12 w-full items-center justify-center rounded-ios bg-ios-green text-[17px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          Finish shopping
        </button>
      ) : null}

      <PurchaseSheet
        item={active}
        editable={editable}
        allowClosed={list.status === "COMPLETED"}
        onClose={() => setActive(null)}
      />

    </div>
  );
}
