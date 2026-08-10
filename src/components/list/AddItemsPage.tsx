"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { LanguageToggle } from "@/components/LanguageToggle";
import { Stepper } from "@/components/Stepper";
import {
  addListItem,
  getItemPriceHistory,
  removeListItem,
  updateListItem,
  updateMasterItemQuick,
} from "@/lib/actions";
import { bilingualName, useLanguage } from "@/lib/language";
import { UNIT_TYPES, formatPrice, formatQty, unitOptionLabel, type UnitType } from "@/lib/units";
import type { ListDetailDTO, MasterItemDTO, PriceHistoryDTO, ShopDTO } from "@/lib/types";

type AddItemsPageProps = {
  list: ListDetailDTO;
  items: MasterItemDTO[];
  shops: ShopDTO[];
};

/**
 * A row's live state on this list.
 *   listItemId: null -> "Add" was tapped (or "-" walked the quantity back
 *   down to 0) but nothing is saved; the stepper shows 0 and the row only
 *   becomes a real list row on the first +/- tap past zero.
 */
type Entry = { listItemId: number | null; quantity: number; unitType: UnitType };

type StatusFilter = "all" | "unselected" | "zero";

/**
 * Full-page item picker for a draft list. Each row carries its own
 * unit-aware stepper and last-paid price inline — tapping "Add" reveals
 * the stepper starting at 0, no separate configure step.
 */
export function AddItemsPage({ list, items, shops }: AddItemsPageProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [historyByItem, setHistoryByItem] = useState<Record<number, PriceHistoryDTO[] | undefined>>({});

  const toggleExpanded = (item: MasterItemDTO) => {
    setExpandedItemId((current) => (current === item.id ? null : item.id));
    if (!(item.id in historyByItem)) {
      getItemPriceHistory(item.id).then((history) =>
        setHistoryByItem((prev) => ({ ...prev, [item.id]: history })),
      );
    }
  };

  const setItemUnitType = (item: MasterItemDTO, unitType: UnitType) => {
    startTransition(async () => {
      await updateMasterItemQuick({ itemId: item.id, unitType });
      router.refresh();
    });
  };

  const setItemShop = (item: MasterItemDTO, shopId: number | null) => {
    startTransition(async () => {
      await updateMasterItemQuick({ itemId: item.id, shopId });
      router.refresh();
    });
  };

  const initialEntries = useMemo(() => {
    const map: Record<number, Entry> = {};
    for (const row of list.items) {
      if (!(row.itemId in map)) {
        map[row.itemId] = { listItemId: row.id, quantity: row.quantity, unitType: row.unitType };
      }
    }
    return map;
  }, [list.items]);

  const [entries, setEntries] = useState<Record<number, Entry>>(initialEntries);
  // Mirrors `entries` so async callbacks can read the latest value instead
  // of the one captured when they started (matters for rapid +/- taps).
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  // Guards against a second "create" firing while the first is still in
  // flight — held taps can fire several quantity changes before the row
  // that creates it has come back with a listItemId.
  const creating = useRef<Set<number>>(new Set());

  const categoryOptions = useMemo(() => {
    const seen = new Map<number, { label: string; count: number }>();
    for (const item of items) {
      const label = language === "ta" ? (item.categoryNameTa ?? item.categoryName) : item.categoryName;
      const existing = seen.get(item.categoryId);
      if (existing) existing.count += 1;
      else seen.set(item.categoryId, { label, count: 1 });
    }
    return [...seen.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [items, language]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const trimmed = query.trim();
    const matches = items.filter((item) => {
      if (categoryId !== null && item.categoryId !== categoryId) return false;

      const entry = entries[item.id];
      if (statusFilter === "unselected" && entry) return false;
      if (statusFilter === "zero" && (!entry || entry.quantity !== 0)) return false;

      if (!needle) return true;
      return (
        item.nameEn.toLowerCase().includes(needle) ||
        item.nameTa.includes(trimmed) ||
        item.categoryName.toLowerCase().includes(needle) ||
        (item.categoryNameTa ?? "").includes(trimmed)
      );
    });

    // Grouped by category id (stable across a language switch), labeled in
    // whichever language is currently selected.
    const grouped = new Map<number, { label: string; items: MasterItemDTO[] }>();
    for (const item of matches) {
      const label = language === "ta" ? (item.categoryNameTa ?? item.categoryName) : item.categoryName;
      const existing = grouped.get(item.categoryId);
      if (existing) existing.items.push(item);
      else grouped.set(item.categoryId, { label, items: [item] });
    }
    return [...grouped.entries()];
  }, [items, query, language, categoryId, statusFilter, entries]);

  /**
   * Persists a real row at quantity 0 right away — "on the list, check
   * availability" is a deliberate state, not just revealing the stepper.
   */
  const add = (item: MasterItemDTO) => {
    setError(null);
    const unitType = item.unitType;
    setEntries((current) => ({
      ...current,
      [item.id]: { listItemId: null, quantity: 0, unitType },
    }));

    if (creating.current.has(item.id)) return; // a create is already in flight
    creating.current.add(item.id);
    startTransition(async () => {
      const result = await addListItem({ listId: list.id, itemId: item.id, quantity: 0, unitType });
      creating.current.delete(item.id);
      if (!result.ok) {
        setError(result.error);
        setEntries((current) => {
          const next = { ...current };
          delete next[item.id];
          return next;
        });
        return;
      }
      // Pick up whatever the user has dialed in since this call started.
      const latest = entriesRef.current[item.id] ?? { quantity: 0, unitType };
      setEntries((current) => ({
        ...current,
        [item.id]: { listItemId: result.data.listItemId, quantity: latest.quantity, unitType: latest.unitType },
      }));
      if (latest.quantity !== 0 || latest.unitType !== unitType) {
        await updateListItem({
          listItemId: result.data.listItemId,
          quantity: latest.quantity,
          unitType: latest.unitType,
        });
      }
      router.refresh();
    });
  };

  const changeQuantity = (item: MasterItemDTO, quantity: number, unitType: UnitType) => {
    const entry = entries[item.id];
    if (!entry) return;

    setEntries((current) => ({ ...current, [item.id]: { ...entry, quantity, unitType } }));

    if (entry.listItemId === null) {
      if (creating.current.has(item.id)) return; // a create is already in flight
      creating.current.add(item.id);
      startTransition(async () => {
        const result = await addListItem({ listId: list.id, itemId: item.id, quantity, unitType });
        creating.current.delete(item.id);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        // Pick up whatever the user has dialed in since this call started.
        const latest = entriesRef.current[item.id] ?? { quantity, unitType };
        setEntries((current) => ({
          ...current,
          [item.id]: { listItemId: result.data.listItemId, quantity: latest.quantity, unitType: latest.unitType },
        }));
        if (latest.quantity !== quantity || latest.unitType !== unitType) {
          await updateListItem({
            listItemId: result.data.listItemId,
            quantity: latest.quantity,
            unitType: latest.unitType,
          });
        }
        router.refresh();
      });
      return;
    }

    startTransition(async () => {
      const result = await updateListItem({ listItemId: entry.listItemId as number, quantity, unitType });
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  const remove = (item: MasterItemDTO) => {
    const entry = entries[item.id];
    if (!entry) return;
    setEntries((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    if (entry.listItemId === null) return; // never persisted — nothing to delete server-side

    startTransition(async () => {
      const result = await removeListItem(entry.listItemId as number);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  const addedCount = Object.values(entries).filter((entry) => entry.listItemId !== null).length;

  const statusChip = (active: boolean) =>
    `h-9 flex-none rounded-full px-4 text-[14px] font-medium transition active:scale-95 ${
      active
        ? "bg-ios-blue text-white"
        : "bg-ios-surface text-ios-label-2 ring-1 ring-inset ring-ios-separator"
    }`;

  return (
    <div className="space-y-5 pb-6">
      <header className="space-y-3 pt-1">
        <Link
          href={`/grocery/lists/${list.id}`}
          className="inline-flex items-center gap-1 text-[15px] text-ios-blue"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path
              d="M15 5l-7 7 7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {list.name}
        </Link>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-[30px] font-bold leading-tight tracking-tight">Add items</h1>
            <p className="text-[13px] text-ios-label-2">
              {items.length} in master list · {addedCount} added
            </p>
          </div>
          <div className="flex flex-none items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearchOpen((open) => {
                  if (open) setQuery("");
                  return !open;
                });
              }}
              aria-label={searchOpen ? "Close search" : "Search"}
              title={searchOpen ? "Close search" : "Search"}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ios-surface text-ios-blue shadow-ios transition active:scale-95"
            >
              {searchOpen ? (
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
                  <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.1" />
                  <path d="M20 20l-4.3-4.3" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
                </svg>
              )}
            </button>
            <LanguageToggle />
          </div>
        </div>
      </header>

      {searchOpen ? (
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Tamil or English name"
          className="h-12 w-full rounded-ios bg-ios-surface px-4 text-[17px] shadow-ios outline-none focus:ring-2 focus:ring-ios-blue"
        />
      ) : null}

      <div className="-mx-4 overflow-x-auto px-4 pb-1">
        <div className="flex w-max gap-2">
          <button
            type="button"
            onClick={() => setCategoryId(null)}
            className={statusChip(categoryId === null)}
          >
            All categories
          </button>
          {categoryOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setCategoryId(option.id)}
              className={statusChip(categoryId === option.id)}
            >
              {option.label}
              <span className="ml-1.5 tabular-nums opacity-70">{option.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={statusChip(statusFilter === "all")}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("unselected")}
          className={statusChip(statusFilter === "unselected")}
        >
          Not added
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("zero")}
          className={statusChip(statusFilter === "zero")}
        >
          Zero qty
        </button>
      </div>

      {error ? (
        <p className="rounded-ios bg-ios-red-soft px-4 py-3 text-[14px] text-ios-red">{error}</p>
      ) : null}

      {results.length === 0 ? (
        <p className="ios-card p-6 text-center text-[15px] text-ios-label-2">
          {query ? `Nothing matched “${query}”.` : "Nothing matches these filters."}
        </p>
      ) : (
        <div className="space-y-5">
          {results.map(([groupCategoryId, group]) => (
            <section key={groupCategoryId}>
              <p className="px-1 pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-ios-label-3">
                {group.label}
              </p>
              <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
                {group.items.map((item) => {
                  const entry = entries[item.id];
                  const name = bilingualName(item.nameTa, item.nameEn, language);
                  const expanded = expandedItemId === item.id;
                  const history = historyByItem[item.id];
                  return (
                    <li key={item.id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[16px] font-medium">{name.primary}</p>
                          <p className="truncate text-[13px] text-ios-label-2">
                            {name.secondary}
                            {item.shopName ? ` · ${item.shopName}` : ""}
                          </p>
                          {entry?.quantity === 0 ? (
                            <span className="mt-0.5 inline-flex items-center rounded-full bg-ios-orange/15 px-2 py-0.5 text-[11px] font-medium text-ios-orange">
                              Check availability
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => toggleExpanded(item)}
                            className="mt-0.5 inline-flex items-center gap-1 truncate text-[13px] font-medium text-ios-blue active:opacity-60"
                          >
                            {item.lastPrice !== null
                              ? `Last paid ${formatPrice(item.lastPrice)}`
                              : "No price yet"}
                            {item.hasVariableUnit ? (
                              <span className="rounded-full bg-ios-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ios-label-2 ring-1 ring-inset ring-ios-separator">
                                Variable
                              </span>
                            ) : null}
                            <svg
                              viewBox="0 0 24 24"
                              className={`h-3 w-3 flex-none transition-transform ${expanded ? "rotate-180" : ""}`}
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
                        </div>

                        {entry ? (
                          <Stepper
                            value={entry.quantity}
                            unit={entry.unitType}
                            size="compact"
                            minOverride={0}
                            onBelowMin={() => remove(item)}
                            onChange={(quantity, unitType) => changeQuantity(item, quantity, unitType)}
                            aria-label={`Quantity for ${item.nameEn}`}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => add(item)}
                            className="h-9 flex-none rounded-full bg-ios-blue px-4 text-[14px] font-semibold text-white transition active:scale-95"
                          >
                            Add
                          </button>
                        )}
                      </div>

                      {expanded ? (
                        <div className="mt-3 space-y-3 rounded-ios bg-ios-surface-2 p-3 ring-1 ring-inset ring-ios-separator">
                          <div>
                            <p className="pb-1.5 text-[12px] font-medium text-ios-label-2">Unit type</p>
                            <div className="flex flex-wrap gap-1.5">
                              {UNIT_TYPES.map((unit) => (
                                <button
                                  key={unit}
                                  type="button"
                                  onClick={() => setItemUnitType(item, unit)}
                                  className={`h-8 rounded-full px-3 text-[13px] font-medium transition active:scale-95 ${
                                    item.unitType === unit
                                      ? "bg-ios-blue text-white"
                                      : "bg-ios-surface text-ios-label-2 ring-1 ring-inset ring-ios-separator"
                                  }`}
                                >
                                  {unitOptionLabel(unit)}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="pb-1.5 text-[12px] font-medium text-ios-label-2">Shop by (From)</p>
                            <div className="flex flex-wrap gap-1.5">
                              {shops.map((shop) => (
                                <button
                                  key={shop.id}
                                  type="button"
                                  onClick={() => setItemShop(item, shop.id)}
                                  className={`h-8 rounded-full px-3 text-[13px] font-medium transition active:scale-95 ${
                                    item.shopId === shop.id
                                      ? "bg-ios-blue text-white"
                                      : "bg-ios-surface text-ios-label-2 ring-1 ring-inset ring-ios-separator"
                                  }`}
                                >
                                  {shop.name}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => setItemShop(item, null)}
                                className={`h-8 rounded-full px-3 text-[13px] font-medium transition active:scale-95 ${
                                  item.shopId === null
                                    ? "bg-ios-blue text-white"
                                    : "bg-ios-surface text-ios-label-2 ring-1 ring-inset ring-ios-separator"
                                }`}
                              >
                                Not set
                              </button>
                            </div>
                          </div>

                          <div>
                            <p className="pb-1.5 text-[12px] font-medium text-ios-label-2">Price history</p>
                            {history === undefined ? (
                              <p className="text-[13px] text-ios-label-2">Loading…</p>
                            ) : history.length === 0 ? (
                              <p className="text-[13px] text-ios-label-2">No purchases recorded yet.</p>
                            ) : (
                              <ul className="divide-y divide-ios-separator overflow-hidden rounded-ios bg-ios-surface">
                                {history.slice(0, 5).map((entryRow) => (
                                  <li
                                    key={entryRow.id}
                                    className="flex items-center justify-between px-3 py-2"
                                  >
                                    <span className="text-[13px] font-medium tabular-nums">
                                      {formatPrice(entryRow.price)}
                                      <span className="ml-1.5 text-[12px] font-normal text-ios-label-2">
                                        for {formatQty(entryRow.quantity, entryRow.unitType)}
                                      </span>
                                    </span>
                                    <span className="text-[12px] text-ios-label-3">
                                      {entryRow.listName ?? entryRow.shopName ?? ""}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
