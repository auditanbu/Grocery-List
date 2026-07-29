"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PriceDelta } from "@/components/PriceDelta";
import { PurchaseSheet } from "@/components/list/PurchaseSheet";
import { groupByShop } from "@/components/list/DraftEditor";
import { completeList } from "@/lib/actions";
import { bilingualName, useLanguage } from "@/lib/language";
import { formatPrice, formatQty } from "@/lib/units";
import type { ListDetailDTO, ListItemDTO } from "@/lib/types";

type ShoppingViewProps = {
  list: ListDetailDTO;
  items: ListItemDTO[];
};

export function ShoppingView({ list, items }: ShoppingViewProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const [active, setActive] = useState<ListItemDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const purchased = items.filter((item) => item.isPurchased);
  const spent = purchased.reduce((sum, item) => sum + (item.purchasePrice ?? 0), 0);
  const allDone = items.length > 0 && purchased.length === items.length;

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
      <div className="ios-card flex items-center justify-between p-4">
        <div>
          <p className="text-[13px] text-ios-label-2">Bought</p>
          <p className="text-[22px] font-semibold tabular-nums">
            {purchased.length}
            <span className="text-ios-label-3"> / {items.length}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[13px] text-ios-label-2">Spent</p>
          <p className="text-[22px] font-semibold tabular-nums">{formatPrice(spent)}</p>
        </div>
      </div>

      {error ? (
        <p className="rounded-ios bg-red-50 px-4 py-3 text-[14px] text-ios-red">{error}</p>
      ) : null}

      {items.length === 0 ? (
        <p className="ios-card p-6 text-center text-[15px] text-ios-label-2">
          No items for this shop.
        </p>
      ) : (
        groupByShop(items).map(([shopName, shopItems]) => (
          <section key={shopName}>
            <p className="px-1 pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-ios-label-3">
              {shopName} · {shopItems.filter((item) => item.isPurchased).length}/{shopItems.length}
            </p>
            <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
              {shopItems.map((item) => {
                const name = bilingualName(item.nameTa, item.nameEn, language);
                return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setActive(item)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-ios-surface-2"
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
                      <span
                        className={`block truncate text-[16px] font-medium ${
                          item.isPurchased ? "text-ios-label-3 line-through" : ""
                        }`}
                      >
                        {name.primary}
                      </span>
                      <span className="block truncate text-[13px] text-ios-label-2">
                        {name.secondary} · {formatQty(item.quantity, item.unitType)}
                      </span>
                      {item.isPurchased ? (
                        <span className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-semibold tabular-nums">
                            {formatPrice(item.purchasePrice ?? 0)}
                          </span>
                          <PriceDelta
                            current={item.purchasePrice ?? 0}
                            previous={item.previousPrice}
                          />
                        </span>
                      ) : item.lastPrice !== null ? (
                        <span className="text-[13px] text-ios-label-3">
                          Last time {formatPrice(item.lastPrice)}
                        </span>
                      ) : null}
                    </span>
                  </button>
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

      <PurchaseSheet item={active} onClose={() => setActive(null)} />
    </div>
  );
}
