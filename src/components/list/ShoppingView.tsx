"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { CategoryFilter } from "@/components/list/CategoryFilter";
import { PriceDelta } from "@/components/PriceDelta";
import { PurchaseSheet } from "@/components/list/PurchaseSheet";
import { Stepper } from "@/components/Stepper";
import { groupByShop } from "@/components/list/DraftEditor";
import { completeList } from "@/lib/actions";
import { bilingualName, useLanguage } from "@/lib/language";
import { formatPrice, formatQty, projectPrice, unitGroup, type UnitType } from "@/lib/units";
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
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);

  const [compareItemId, setCompareItemId] = useState<number | null>(null);
  const [compareState, setCompareState] = useState<
    Record<number, { quantity: number; unitType: UnitType }>
  >({});

  const toggleCompare = (item: ListItemDTO, event: React.MouseEvent) => {
    event.stopPropagation();
    setCompareItemId((current) => (current === item.id ? null : item.id));
    setCompareState((prev) =>
      item.id in prev ? prev : { ...prev, [item.id]: { quantity: item.quantity, unitType: item.unitType } },
    );
  };

  const categoryOptions = useMemo(() => {
    const counts = new Map<number, { name: string; count: number }>();
    for (const item of items) {
      const name = language === "ta" ? (item.categoryNameTa ?? item.categoryName) : item.categoryName;
      const entry = counts.get(item.categoryId) ?? { name, count: 0 };
      entry.count += 1;
      counts.set(item.categoryId, entry);
    }
    return [...counts.entries()]
      .map(([id, value]) => ({ id, name: value.name, count: value.count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, language]);

  const visibleItems = useMemo(
    () => (categoryId === undefined ? items : items.filter((item) => item.categoryId === categoryId)),
    [items, categoryId],
  );

  // Checked-off items sink to the bottom of their shop's section so the
  // remaining to-buy items stay at the top while shopping.
  const groupedByShop = useMemo(() => {
    return groupByShop(visibleItems).map(
      ([shopName, shopItems]) =>
        [shopName, [...shopItems].sort((a, b) => Number(a.isPurchased) - Number(b.isPurchased))] as const,
    );
  }, [visibleItems]);

  const purchased = visibleItems.filter((item) => item.isPurchased);
  const spent = purchased.reduce((sum, item) => sum + (item.purchasePrice ?? 0), 0);
  // "Finish shopping" completes the whole list, so it must reflect the
  // list's true completion — not just what the shop/category filters show.
  const allDone = list.items.length > 0 && list.items.every((item) => item.isPurchased);

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
            <span className="text-ios-label-3"> / {visibleItems.length}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[13px] text-ios-label-2">Spent</p>
          <p className="text-[22px] font-semibold tabular-nums">{formatPrice(spent)}</p>
        </div>
      </div>

      <CategoryFilter
        options={categoryOptions}
        value={categoryId}
        onChange={setCategoryId}
        total={items.length}
      />

      {error ? (
        <p className="rounded-ios bg-ios-red-soft px-4 py-3 text-[14px] text-ios-red">{error}</p>
      ) : null}

      {visibleItems.length === 0 ? (
        <p className="ios-card p-6 text-center text-[15px] text-ios-label-2">
          No items for this shop.
        </p>
      ) : (
        groupedByShop.map(([shopName, shopItems]) => (
          <section key={shopName}>
            <p className="px-1 pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-ios-label-3">
              {shopName} · {shopItems.filter((item) => item.isPurchased).length}/{shopItems.length}
            </p>
            <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
              {shopItems.map((item) => {
                const name = bilingualName(item.nameTa, item.nameEn, language);
                const comparing = compareItemId === item.id;
                const compare = compareState[item.id] ?? { quantity: item.quantity, unitType: item.unitType };
                const canProject =
                  item.lastPrice !== null && item.lastPriceQuantity !== null && item.lastPriceUnitType !== null;
                const sameGroup = canProject && unitGroup(item.lastPriceUnitType as UnitType) === unitGroup(compare.unitType);
                const projected =
                  canProject && sameGroup
                    ? projectPrice(
                        item.lastPrice as number,
                        item.lastPriceQuantity as number,
                        item.lastPriceUnitType as UnitType,
                        compare.quantity,
                        compare.unitType,
                      )
                    : null;
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
                              currentQuantity={item.quantity}
                              currentUnitType={item.unitType}
                              previousQuantity={item.previousQuantity ?? undefined}
                              previousUnitType={item.previousUnitType ?? undefined}
                            />
                          </span>
                        ) : item.lastPrice !== null ? (
                          <span className="block truncate text-[13px] text-ios-label-3">
                            Last {formatPrice(item.lastPrice)}
                            {item.lastPriceQuantity !== null && item.lastPriceUnitType !== null
                              ? ` for ${formatQty(item.lastPriceQuantity, item.lastPriceUnitType)}`
                              : ""}
                            {item.shopName ? ` · ${item.shopName}` : ""}
                          </span>
                        ) : null}
                      </span>
                    </button>

                    {!item.isPurchased && item.lastPrice !== null ? (
                      <button
                        type="button"
                        onClick={(event) => toggleCompare(item, event)}
                        className={`h-8 flex-none rounded-full px-3 text-[13px] font-medium transition active:scale-95 ${
                          comparing
                            ? "bg-ios-blue text-white"
                            : "bg-ios-surface-2 text-ios-blue ring-1 ring-inset ring-ios-separator"
                        }`}
                      >
                        Compare
                      </button>
                    ) : null}
                  </div>

                  {comparing ? (
                    <div className="mx-4 mb-3 rounded-ios bg-ios-surface-2 p-3 ring-1 ring-inset ring-ios-separator">
                      <p className="pb-1.5 text-[12px] font-medium text-ios-label-2">
                        Compare at this quantity
                      </p>
                      <Stepper
                        value={compare.quantity}
                        unit={compare.unitType}
                        size="compact"
                        onChange={(quantity, unitType) =>
                          setCompareState((prev) => ({ ...prev, [item.id]: { quantity, unitType } }))
                        }
                        aria-label={`Compare quantity for ${item.nameEn}`}
                      />
                      <p className="mt-2 text-[14px] font-semibold tabular-nums">
                        {projected !== null ? (
                          <>
                            ≈ {formatPrice(projected)}
                            <span className="ml-1.5 text-[12px] font-normal text-ios-label-2">
                              based on last price
                            </span>
                          </>
                        ) : (
                          <span className="text-[13px] font-normal text-ios-label-2">
                            Different pack size — can&apos;t compare
                          </span>
                        )}
                      </p>
                    </div>
                  ) : null}
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
