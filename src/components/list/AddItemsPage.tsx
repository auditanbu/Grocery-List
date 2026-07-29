"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { LanguageToggle } from "@/components/LanguageToggle";
import { Stepper } from "@/components/Stepper";
import { addListItem, removeListItem, updateListItem } from "@/lib/actions";
import { bilingualName, useLanguage } from "@/lib/language";
import { formatPrice, type UnitType } from "@/lib/units";
import type { ListDetailDTO, MasterItemDTO } from "@/lib/types";

type AddItemsPageProps = {
  list: ListDetailDTO;
  items: MasterItemDTO[];
};

/**
 * A row's live state on this list.
 *   listItemId: null -> "Add" was tapped but nothing is saved yet; the
 *   stepper shows 0 and the row only becomes a real list row on the
 *   first +/- tap (or typed amount).
 */
type Entry = { listItemId: number | null; quantity: number; unitType: UnitType };

/**
 * Full-page item picker for a draft list. Each row carries its own
 * unit-aware stepper and last-paid price inline — tapping "Add" reveals
 * the stepper starting at 0, no separate configure step.
 */
export function AddItemsPage({ list, items }: AddItemsPageProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const trimmed = query.trim();
    const matches = needle
      ? items.filter(
          (item) =>
            item.nameEn.toLowerCase().includes(needle) ||
            item.nameTa.includes(trimmed) ||
            item.categoryName.toLowerCase().includes(needle) ||
            (item.categoryNameTa ?? "").includes(trimmed),
        )
      : items;

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
  }, [items, query, language]);

  /** Reveals the stepper at 0 — nothing is saved until the first real change. */
  const add = (item: MasterItemDTO) => {
    setError(null);
    setEntries((current) => ({
      ...current,
      [item.id]: { listItemId: null, quantity: 0, unitType: item.unitType },
    }));
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

  return (
    <div className="space-y-5 pb-6">
      <header className="space-y-3 pt-1">
        <Link
          href={`/lists/${list.id}`}
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
          <LanguageToggle />
        </div>
      </header>

      <input
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search Tamil or English name"
        className="h-12 w-full rounded-ios bg-ios-surface px-4 text-[17px] shadow-ios outline-none focus:ring-2 focus:ring-ios-blue"
      />

      {error ? (
        <p className="rounded-ios bg-ios-red-soft px-4 py-3 text-[14px] text-ios-red">{error}</p>
      ) : null}

      {results.length === 0 ? (
        <p className="ios-card p-6 text-center text-[15px] text-ios-label-2">
          Nothing matched &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="space-y-5">
          {results.map(([categoryId, group]) => (
            <section key={categoryId}>
              <p className="px-1 pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-ios-label-3">
                {group.label}
              </p>
              <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
                {group.items.map((item) => {
                  const entry = entries[item.id];
                  const name = bilingualName(item.nameTa, item.nameEn, language);
                  return (
                    <li key={item.id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[16px] font-medium">{name.primary}</p>
                          <p className="truncate text-[13px] text-ios-label-2">
                            {name.secondary}
                            {item.shopName ? ` · ${item.shopName}` : ""}
                          </p>
                          <p className="truncate text-[13px] font-medium text-ios-label-2">
                            {item.lastPrice !== null
                              ? `Last paid ${formatPrice(item.lastPrice)}`
                              : "No price yet"}
                          </p>
                        </div>

                        {entry ? (
                          <div className="flex flex-none items-center gap-1.5">
                            <Stepper
                              value={entry.quantity}
                              unit={entry.unitType}
                              size="compact"
                              onChange={(quantity, unitType) => changeQuantity(item, quantity, unitType)}
                              aria-label={`Quantity for ${item.nameEn}`}
                            />
                            <button
                              type="button"
                              onClick={() => remove(item)}
                              aria-label={`Remove ${item.nameEn}`}
                              className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-ios-label-3 transition active:bg-ios-surface-2"
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                                <path
                                  d="M6 6l12 12M18 6L6 18"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </button>
                          </div>
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
