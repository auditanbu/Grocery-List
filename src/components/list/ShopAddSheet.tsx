"use client";

import { useEffect, useState, useTransition } from "react";

import { Sheet } from "@/components/Sheet";
import { NewItemFields, newItemDraft, type NewItemDraft } from "@/components/list/NewItemFields";
import { addListItem, searchMasterItems, upsertMasterItem } from "@/lib/actions";
import { displayName, useLanguage } from "@/lib/language";
import { formatPrice } from "@/lib/units";
import type { CategoryDTO, MasterItemDTO, ShopDTO } from "@/lib/types";

type ShopAddSheetProps = {
  open: boolean;
  listId: number;
  /** Set when the list is closed and the user unlocked it with "Edit". */
  allowClosed?: boolean;
  /** Master-item ids already on the list, so they aren't offered twice. */
  onListItemIds: number[];
  categories: CategoryDTO[];
  shops: ShopDTO[];
  onClose: () => void;
  /** Fires after a successful add so the caller can refresh the list. */
  onAdded: () => void;
};

const SEARCH_DEBOUNCE_MS = 200;

/**
 * Adds an item to a list *while shopping* — the aisle-side counterpart to
 * the full Add items page, which only exists for drafts. Searching hits the
 * master list on the server (rather than shipping the whole catalogue to
 * the phone), and anything that genuinely isn't in the catalogue yet can be
 * created right here instead of derailing the shop.
 */
export function ShopAddSheet({
  open,
  listId,
  allowClosed,
  onListItemIds,
  categories,
  shops,
  onClose,
  onAdded,
}: ShopAddSheetProps) {
  const { language } = useLanguage();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MasterItemDTO[] | null>(null);
  const [draft, setDraft] = useState<NewItemDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Ids added during this sheet's lifetime. `onListItemIds` catches up once
  // the parent refreshes, but this keeps the row from flashing back to
  // "Add" in the meantime.
  const [justAdded, setJustAdded] = useState<number[]>([]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults(null);
    setDraft(null);
    setError(null);
    setJustAdded([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      searchMasterItems(query).then((rows) => {
        if (!cancelled) setResults(rows);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [open, query]);

  const alreadyOnList = (itemId: number) =>
    onListItemIds.includes(itemId) || justAdded.includes(itemId);

  const add = (item: MasterItemDTO) => {
    setError(null);
    setJustAdded((current) => [...current, item.id]);
    startTransition(async () => {
      // An item whose default quantity is 0 would land on the list as
      // "check availability", which makes no sense at the till — start it
      // at one step of its unit instead.
      const result = await addListItem({
        listId,
        itemId: item.id,
        quantity: item.defaultQty > 0 ? item.defaultQty : 1,
        allowClosed,
      });
      if (!result.ok) {
        setError(result.error);
        setJustAdded((current) => current.filter((id) => id !== item.id));
        return;
      }
      onAdded();
    });
  };

  const startCreate = () => {
    setError(null);
    setDraft(newItemDraft(query, categories));
  };

  const create = () => {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const saved = await upsertMasterItem({ ...draft, defaultQty: 1 });
      if (!saved.ok) {
        setError(saved.error);
        return;
      }
      const added = await addListItem({ listId, itemId: saved.data.id, quantity: 1, allowClosed });
      if (!added.ok) {
        setError(added.error);
        return;
      }
      setJustAdded((current) => [...current, saved.data.id]);
      setDraft(null);
      setQuery("");
      onAdded();
    });
  };

  if (draft) {
    return (
      <Sheet
        open={open}
        onClose={() => setDraft(null)}
        title="New item"
        subtitle="Saved to the master list, then added to this list."
        footer={
          <div className="space-y-2">
            <button
              type="button"
              onClick={create}
              disabled={pending}
              className="flex h-12 w-full items-center justify-center rounded-ios bg-ios-blue text-[17px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save and add"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="h-11 w-full text-[16px] font-medium text-ios-blue active:opacity-60"
            >
              Back to search
            </button>
          </div>
        }
      >
        <div className="space-y-4 pb-3">
          <NewItemFields
            draft={draft}
            onChange={setDraft}
            categories={categories}
            shops={shops}
          />

          {error ? <p className="text-[14px] text-ios-red">{error}</p> : null}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add to this list"
      subtitle="Picked up something that wasn't on the list?"
    >
      <div className="space-y-3 pb-3">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Tamil, Tanglish or English name"
          className="h-12 w-full rounded-ios bg-ios-surface-2 px-4 text-[17px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
        />

        {error ? (
          <p className="rounded-ios bg-ios-red-soft px-4 py-3 text-[14px] text-ios-red">{error}</p>
        ) : null}

        {results === null ? (
          <p className="px-1 py-4 text-center text-[15px] text-ios-label-2">Loading…</p>
        ) : results.length === 0 ? (
          <p className="px-1 py-4 text-center text-[15px] text-ios-label-2">
            {query.trim() ? `Nothing matched “${query.trim()}”.` : "No items in the master list yet."}
          </p>
        ) : (
          <ul className="divide-y divide-ios-separator overflow-hidden rounded-ios bg-ios-surface-2">
            {results.map((item) => {
              const name = displayName(item, language);
              const onList = alreadyOnList(item.id);
              return (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-medium">{name.primary}</span>
                    <span className="block truncate text-[13px] text-ios-label-2">
                      {name.secondary}
                      {item.shopName ? ` · ${item.shopName}` : ""}
                      {item.lastPrice !== null ? ` · last ${formatPrice(item.lastPrice)}` : ""}
                    </span>
                  </span>
                  {onList ? (
                    <span className="flex-none rounded-full bg-ios-surface px-3 py-1.5 text-[13px] font-medium text-ios-label-2 ring-1 ring-inset ring-ios-separator">
                      On list
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => add(item)}
                      disabled={pending}
                      className="h-9 flex-none rounded-full bg-ios-blue px-4 text-[14px] font-semibold text-white transition active:scale-95 disabled:opacity-50"
                    >
                      Add
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {query.trim() ? (
          <button
            type="button"
            onClick={startCreate}
            className="flex h-11 w-full items-center justify-center rounded-ios bg-ios-surface-2 text-[15px] font-medium text-ios-blue ring-1 ring-inset ring-ios-separator transition active:scale-[0.98]"
          >
            Create “{query.trim()}” as a new item
          </button>
        ) : null}
      </div>
    </Sheet>
  );
}
