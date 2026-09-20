"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { PriceDelta } from "@/components/PriceDelta";
import { PurchaseSheet } from "@/components/list/PurchaseSheet";
import { ShopAddSheet } from "@/components/list/ShopAddSheet";
import { Stepper } from "@/components/Stepper";
import { groupByShop } from "@/components/list/DraftEditor";
import { completeList, updateListItem } from "@/lib/actions";
import { displayName, useLanguage } from "@/lib/language";
import { formatPrice, formatQty, projectPrice, unitGroup, type UnitType } from "@/lib/units";
import type { CategoryDTO, ListDetailDTO, ListItemDTO } from "@/lib/types";

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

  const [compareItemId, setCompareItemId] = useState<number | null>(null);
  const [compareState, setCompareState] = useState<
    Record<number, { quantity: number; unitType: UnitType }>
  >({});

  // Optimistic quantity/unit, so the stepper stays responsive while the
  // action runs — same approach as the draft editor's stepper.
  const [overrides, setOverrides] = useState<Record<number, { quantity: number; unitType: UnitType }>>(
    {},
  );
  const stateOf = (item: ListItemDTO) =>
    overrides[item.id] ?? { quantity: item.quantity, unitType: item.unitType };

  // Retire an override as soon as the server value agrees with it. Left in
  // place it would shadow later changes made elsewhere — most visibly a
  // variable-unit item resized from the purchase sheet and then unchecked.
  useEffect(() => {
    setOverrides((current) => {
      let changed = false;
      const next = { ...current };
      for (const row of list.items) {
        const override = next[row.id];
        if (override && override.quantity === row.quantity && override.unitType === row.unitType) {
          delete next[row.id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [list.items]);

  const changeQuantity = (item: ListItemDTO, quantity: number, unitType: UnitType) => {
    setError(null);
    setOverrides((current) => ({ ...current, [item.id]: { quantity, unitType } }));
    // Keep the "compare at this quantity" panel in step with the row it
    // belongs to, unless it's already been dialled to something else.
    setCompareState((current) =>
      item.id in current ? current : { ...current, [item.id]: { quantity, unitType } },
    );
    startTransition(async () => {
      const result = await updateListItem({
        listItemId: item.id,
        quantity,
        unitType,
        // Only ever true once the header "Edit" button unlocked a closed list.
        allowClosed: list.status === "COMPLETED",
      });
      if (!result.ok) {
        setError(result.error);
        setOverrides((current) => {
          const next = { ...current };
          delete next[item.id];
          return next;
        });
      }
      router.refresh();
    });
  };

  const toggleCompare = (item: ListItemDTO, event: React.MouseEvent) => {
    event.stopPropagation();
    setCompareItemId((current) => (current === item.id ? null : item.id));
    setCompareState((prev) => (item.id in prev ? prev : { ...prev, [item.id]: stateOf(item) }));
  };

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
                const comparing = compareItemId === item.id;
                const current = stateOf(item);
                const compare = compareState[item.id] ?? current;
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
                // Quantity is editable right up until the item is checked
                // off; after that it's a record of what was actually bought
                // and belongs to the purchase sheet, which re-prices it.
                const canEditQuantity = editable && !item.isPurchased;
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
                            item.isPurchased ? "text-ios-label-3" : ""
                          }`}
                        >
                          {name.primary}
                        </span>
                        <span className="block truncate text-[13px] text-ios-label-2">
                          {name.secondary}
                          {/* The stepper alongside already states the
                              quantity — only spell it out when there isn't one. */}
                          {canEditQuantity ? "" : ` · ${formatQty(item.quantity, item.unitType)}`}
                        </span>
                        {item.isPurchased ? (
                          <span className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-[14px] font-semibold tabular-nums">
                              {formatPrice(item.purchasePrice ?? 0)}
                            </span>
                            {/* Where it was actually bought — the row's own
                                record, since the shop heading disappears once
                                a category filter is on. */}
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
                        ) : !editable ? (
                          <span className="mt-1 block text-[13px] text-ios-label-3">
                            Not bought
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

                    {canEditQuantity ? (
                      <Stepper
                        value={current.quantity}
                        unit={current.unitType}
                        size="compact"
                        onChange={(quantity, unitType) => changeQuantity(item, quantity, unitType)}
                        aria-label={`Quantity for ${item.nameEn}`}
                      />
                    ) : null}
                  </div>

                  {!item.isPurchased && item.lastPrice !== null ? (
                    <div className="-mt-1 px-4 pb-3">
                      <button
                        type="button"
                        onClick={(event) => toggleCompare(item, event)}
                        className={`h-8 rounded-full px-3 text-[13px] font-medium transition active:scale-95 ${
                          comparing
                            ? "bg-ios-blue text-white"
                            : "bg-ios-surface-2 text-ios-blue ring-1 ring-inset ring-ios-separator"
                        }`}
                      >
                        Compare
                      </button>
                    </div>
                  ) : null}

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

      <PurchaseSheet
        item={active}
        editable={editable}
        allowClosed={list.status === "COMPLETED"}
        onClose={() => setActive(null)}
      />

    </div>
  );
}
