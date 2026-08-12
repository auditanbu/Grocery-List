"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { CategoryFilter } from "@/components/list/CategoryFilter";
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
  items: ListItemDTO[];
  /** Master categories, for creating an item that isn't in the catalogue yet. */
  categories: CategoryDTO[];
};

export function ShoppingView({ list, items, categories }: ShoppingViewProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const [active, setActive] = useState<ListItemDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

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
      const result = await updateListItem({ listItemId: item.id, quantity, unitType });
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

  const visibleItems = useMemo(() => {
    const trimmed = query.trim();
    const needle = trimmed.toLowerCase();
    return items.filter((item) => {
      if (categoryId !== undefined && item.categoryId !== categoryId) return false;
      if (!needle) return true;
      return (
        item.nameEn.toLowerCase().includes(needle) ||
        item.nameTa.includes(trimmed) ||
        (item.nameTl ?? "").toLowerCase().includes(needle) ||
        item.categoryName.toLowerCase().includes(needle) ||
        (item.categoryNameTa ?? "").includes(trimmed) ||
        (item.shopName ?? "").toLowerCase().includes(needle)
      );
    });
  }, [items, categoryId, query]);

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
  const editable = list.status !== "COMPLETED";

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

      {editable ? (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-ios bg-ios-blue text-[17px] font-semibold text-white transition active:scale-[0.98]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
            <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
          </svg>
          Add item
        </button>
      ) : null}

      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ios-label-3"
          aria-hidden
        >
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.1" />
          <path d="M20 20l-4.3-4.3" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search this list"
          aria-label="Search this list"
          className="h-11 w-full rounded-ios bg-ios-surface pl-10 pr-10 text-[17px] shadow-ios outline-none focus:ring-2 focus:ring-ios-blue"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ios-label-3 active:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
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
          {query.trim() ? `Nothing on this list matched “${query.trim()}”.` : "No items for this shop."}
        </p>
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
                            item.isPurchased ? "text-ios-label-3 line-through" : ""
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

      <PurchaseSheet item={active} onClose={() => setActive(null)} />

      <ShopAddSheet
        open={addOpen}
        listId={list.id}
        onListItemIds={list.items.map((row) => row.itemId)}
        categories={categories}
        shops={list.shops}
        onClose={() => setAddOpen(false)}
        onAdded={() => router.refresh()}
      />
    </div>
  );
}
