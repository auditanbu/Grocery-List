"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import {
  CategoryIcon,
  FilterMenu,
  FunnelIcon,
  type FilterOption,
} from "@/components/FilterMenu";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Sheet } from "@/components/Sheet";
import { NewItemFields, newItemDraft, type NewItemDraft } from "@/components/list/NewItemFields";
import { Stepper } from "@/components/Stepper";
import {
  addListItem,
  getItemPriceHistory,
  removeListItem,
  updateListItem,
  updateMasterItemQuick,
  upsertMasterItem,
} from "@/lib/actions";
import { displayName, useLanguage } from "@/lib/language";
import {
  UNIT_TYPES,
  formatPrice,
  formatQty,
  formatUnitPrice,
  unitOptionLabel,
  type UnitType,
} from "@/lib/units";
import type {
  CategoryDTO,
  ListDetailDTO,
  MasterItemDTO,
  PriceHistoryDTO,
  ShopDTO,
} from "@/lib/types";

type AddItemsPageProps = {
  list: ListDetailDTO;
  items: MasterItemDTO[];
  shops: ShopDTO[];
  /**
   * The full category list, not the one derived from `items` — a brand-new
   * item may well belong to a category nothing is filed under yet.
   */
  categories: CategoryDTO[];
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
export function AddItemsPage({ list, items, shops, categories }: AddItemsPageProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [newDraft, setNewDraft] = useState<NewItemDraft | null>(null);
  const [saving, setSaving] = useState(false);

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

  const searchMatches = useMemo(() => {
    const trimmed = query.trim();
    const needle = trimmed.toLowerCase();
    if (!needle) return items;
    return items.filter(
      (item) =>
        item.nameEn.toLowerCase().includes(needle) ||
        item.nameTa.includes(trimmed) ||
        (item.nameTl ?? "").toLowerCase().includes(needle) ||
        item.categoryName.toLowerCase().includes(needle) ||
        (item.categoryNameTa ?? "").includes(trimmed),
    );
  }, [items, query]);

  const matchesStatus = (item: MasterItemDTO) => {
    const entry = entries[item.id];
    if (statusFilter === "unselected" && entry) return false;
    if (statusFilter === "zero" && (!entry || entry.quantity !== 0)) return false;
    return true;
  };
  const matchesCategory = (item: MasterItemDTO) =>
    categoryId === null || item.categoryId === categoryId;

  // A count next to a filter option is a promise about what picking it gives,
  // so each menu counts against every filter *except its own*. Counting the
  // whole catalogue instead meant "Zero qty" could show one item while the
  // category menu still offered six.
  const forCategoryMenu = useMemo(
    () => searchMatches.filter(matchesStatus),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchMatches, statusFilter, entries],
  );
  const forStatusMenu = useMemo(
    () => searchMatches.filter(matchesCategory),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchMatches, categoryId],
  );

  const categoryOptions = useMemo(() => {
    const seen = new Map<number, { label: string; count: number }>();
    for (const item of forCategoryMenu) {
      const label = language === "ta" ? (item.categoryNameTa ?? item.categoryName) : item.categoryName;
      const existing = seen.get(item.categoryId);
      if (existing) existing.count += 1;
      else seen.set(item.categoryId, { label, count: 1 });
    }
    return [...seen.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [forCategoryMenu, language]);

  const results = useMemo(() => {
    // Grouped by category id (stable across a language switch), labeled in
    // whichever language is currently selected.
    const grouped = new Map<number, { label: string; items: MasterItemDTO[] }>();
    for (const item of forCategoryMenu.filter(matchesCategory)) {
      const label = language === "ta" ? (item.categoryNameTa ?? item.categoryName) : item.categoryName;
      const existing = grouped.get(item.categoryId);
      if (existing) existing.items.push(item);
      else grouped.set(item.categoryId, { label, items: [item] });
    }
    return [...grouped.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forCategoryMenu, categoryId, language]);

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
  const notAddedCount = forStatusMenu.filter((item) => !entries[item.id]).length;
  const zeroCount = forStatusMenu.filter((item) => entries[item.id]?.quantity === 0).length;

  const categoryFilterOptions: FilterOption<number | null>[] = [
    { key: "all", label: "All categories", value: null, count: forCategoryMenu.length },
    ...categoryOptions.map((option) => ({
      key: String(option.id),
      label: option.label,
      value: option.id as number | null,
      count: option.count,
    })),
  ];

  const statusFilterOptions: FilterOption<StatusFilter>[] = [
    { key: "all", label: "All", value: "all", count: forStatusMenu.length },
    { key: "unselected", label: "Not added", value: "unselected", count: notAddedCount },
    { key: "zero", label: "Zero qty", value: "zero", count: zeroCount },
  ];

  /**
   * Saves to the master catalogue only — this page's whole job is adding, so
   * the new row's own "Add" button does that part. The search box is primed
   * with the name so it surfaces immediately instead of being buried in a
   * category halfway down a 500-item list.
   */
  const createItem = () => {
    if (!newDraft) return;
    setError(null);
    setSaving(true);
    startTransition(async () => {
      const saved = await upsertMasterItem({ ...newDraft, defaultQty: 1 });
      setSaving(false);
      if (!saved.ok) {
        setError(saved.error);
        return;
      }
      const name = newDraft.nameTa.trim() || newDraft.nameEn.trim();
      setNewDraft(null);
      setCategoryId(null);
      setStatusFilter("all");
      setSearchOpen(true);
      setQuery(name);
      router.refresh();
    });
  };

  return (
    <div className="space-y-5 pb-6">
      {/*
        Frozen header: the master list runs to hundreds of rows, and the
        filters are useless if you have to scroll back up to reach them.
        z-20 keeps it under AppNav (z-30) and any Sheet (z-50). The -mx-4/px-4
        pair lets it span the full width despite <main>'s gutter, and the
        env() margin/padding pair cancels the safe-area padding body applies,
        so a pinned header clears the notch in the installed PWA instead of
        sliding under it.
      */}
      <header
        className="sticky top-0 z-20 -mx-4 space-y-2 border-b border-ios-separator bg-ios-bg/90 px-4 pb-3 backdrop-blur-xl"
        style={{
          marginTop: "calc(-1 * env(safe-area-inset-top))",
          paddingTop: "calc(env(safe-area-inset-top) + 0.25rem)",
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/grocery/lists/${list.id}`}
            className="inline-flex min-w-0 items-center gap-1 text-[15px] text-ios-blue"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none" aria-hidden>
              <path
                d="M15 5l-7 7 7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="truncate">{list.name}</span>
          </Link>

          <div className="flex flex-none items-center gap-1.5">
            <button
              type="button"
              onClick={() => setNewDraft(newItemDraft(query, categories))}
              aria-label="New item"
              title="New item"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ios-blue text-white shadow-ios transition active:scale-95"
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
                <path
                  d="M12 6v12M6 12h12"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                />
              </svg>
            </button>

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

            <FilterMenu
              label="Category"
              icon={<CategoryIcon />}
              options={categoryFilterOptions}
              value={categoryId}
              defaultValue={null}
              onChange={setCategoryId}
            />

            <FilterMenu
              label="Show"
              icon={<FunnelIcon />}
              options={statusFilterOptions}
              value={statusFilter}
              defaultValue="all"
              onChange={setStatusFilter}
            />

            <LanguageToggle />
          </div>
        </div>

        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Add items</h1>
          <p className="text-[13px] text-ios-label-2">
            {items.length} in master list · {addedCount} added
          </p>
        </div>

        {searchOpen ? (
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Tamil, Tanglish or English name"
            className="h-11 w-full rounded-ios bg-ios-surface px-4 text-[17px] shadow-ios outline-none focus:ring-2 focus:ring-ios-blue"
          />
        ) : null}
      </header>

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
                  const name = displayName(item, language);
                  const expanded = expandedItemId === item.id;
                  const history = historyByItem[item.id];
                  // An RS-priced item's "quantity" is already rupees, so
                  // "for ₹2" says nothing — skip the size and the per-unit
                  // figure for those and show only where it was bought.
                  const hasLastSize =
                    item.lastPriceQuantity !== null &&
                    item.lastPriceUnitType !== null &&
                    item.lastPriceUnitType !== "RS";
                  const lastQty = hasLastSize
                    ? `for ${formatQty(item.lastPriceQuantity as number, item.lastPriceUnitType as UnitType)}`
                    : null;
                  const unitPrice =
                    hasLastSize && item.lastPrice !== null
                      ? formatUnitPrice(
                          item.lastPrice,
                          item.lastPriceQuantity as number,
                          item.lastPriceUnitType as UnitType,
                        )
                      : null;
                  // Where *that purchase* happened, not the item's default shop
                  // — the name line above already carries the default.
                  const lastContext = [lastQty, unitPrice, item.lastPriceShopName].filter(
                    (part): part is string => Boolean(part),
                  );
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
                            className="mt-0.5 block w-full text-left active:opacity-60"
                          >
                            <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[13px] font-medium text-ios-blue">
                              <span>
                                {item.lastPrice !== null
                                  ? `Last paid ${formatPrice(item.lastPrice)}`
                                  : "No price yet"}
                              </span>
                              {item.hasVariableUnit ? (
                                <span className="flex-none rounded-full bg-ios-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ios-label-2 ring-1 ring-inset ring-ios-separator">
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
                            </span>
                            {/* What that price works out to per kilo/litre, and
                                where it was bought — the two things that decide
                                whether it was a good price. */}
                            {lastContext.length > 0 ? (
                              <span className="block text-[12px] text-ios-label-3">
                                {lastContext.join(" · ")}
                              </span>
                            ) : null}
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

      <Sheet
        open={newDraft !== null}
        onClose={() => setNewDraft(null)}
        title="New item"
        subtitle="Saved to the master list. Tap Add on its row to put it on this list."
        footer={
          <button
            type="button"
            onClick={createItem}
            disabled={saving}
            className="flex h-12 w-full items-center justify-center rounded-ios bg-ios-blue text-[17px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save item"}
          </button>
        }
      >
        <div className="space-y-4 pb-3">
          {newDraft ? (
            <NewItemFields
              draft={newDraft}
              onChange={setNewDraft}
              categories={categories}
              shops={shops}
            />
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}
