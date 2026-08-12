"use client";

import { useEffect, useState, useTransition } from "react";

import { Sheet } from "@/components/Sheet";
import { addListItem, searchMasterItems, upsertMasterItem } from "@/lib/actions";
import { displayName, useLanguage } from "@/lib/language";
import { hasTamilScript } from "@/lib/tanglish";
import { UNIT_TYPES, formatPrice, unitOptionLabel, type UnitType } from "@/lib/units";
import type { CategoryDTO, MasterItemDTO, ShopDTO } from "@/lib/types";

type ShopAddSheetProps = {
  open: boolean;
  listId: number;
  /** Master-item ids already on the list, so they aren't offered twice. */
  onListItemIds: number[];
  categories: CategoryDTO[];
  shops: ShopDTO[];
  onClose: () => void;
  /** Fires after a successful add so the caller can refresh the list. */
  onAdded: () => void;
};

type CreateDraft = {
  nameTa: string;
  nameTl: string;
  nameEn: string;
  categoryId: number;
  unitType: UnitType;
  shopId: number | null;
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
  onListItemIds,
  categories,
  shops,
  onClose,
  onAdded,
}: ShopAddSheetProps) {
  const { language } = useLanguage();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MasterItemDTO[] | null>(null);
  const [draft, setDraft] = useState<CreateDraft | null>(null);
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
    const trimmed = query.trim();
    const tamil = hasTamilScript(trimmed);
    setError(null);
    setDraft({
      nameTa: tamil ? trimmed : "",
      nameTl: "",
      nameEn: tamil ? "" : trimmed,
      categoryId: categories[0]?.id ?? 0,
      unitType: "COUNT",
      shopId: null,
    });
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
      const added = await addListItem({ listId, itemId: saved.data.id, quantity: 1 });
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

  const chip = (active: boolean) =>
    `h-9 rounded-full px-3.5 text-[14px] font-medium transition active:scale-95 ${
      active
        ? "bg-ios-blue text-white"
        : "bg-ios-surface-2 text-ios-label-2 ring-1 ring-inset ring-ios-separator"
    }`;

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
          <Field label="Tamil name">
            <input
              value={draft.nameTa}
              onChange={(event) => setDraft({ ...draft, nameTa: event.target.value })}
              placeholder="துவரம் பருப்பு"
              className="h-12 w-full rounded-ios bg-ios-surface-2 px-4 text-[17px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
            />
          </Field>

          <Field label="Tanglish name">
            <input
              value={draft.nameTl}
              onChange={(event) => setDraft({ ...draft, nameTl: event.target.value })}
              placeholder="Thuvaram Paruppu"
              className="h-12 w-full rounded-ios bg-ios-surface-2 px-4 text-[17px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
            />
            <p className="pt-1.5 text-[12px] text-ios-label-3">
              Leave blank and one is worked out from the Tamil name.
            </p>
          </Field>

          <Field label="English name">
            <input
              value={draft.nameEn}
              onChange={(event) => setDraft({ ...draft, nameEn: event.target.value })}
              placeholder="Toor Dal"
              className="h-12 w-full rounded-ios bg-ios-surface-2 px-4 text-[17px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
            />
          </Field>

          <Field label="Category">
            <select
              value={draft.categoryId}
              onChange={(event) => setDraft({ ...draft, categoryId: Number(event.target.value) })}
              className="h-12 w-full rounded-ios bg-ios-surface-2 px-3 text-[17px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nameTa ? `${category.nameTa} / ` : ""}
                  {category.nameEn}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Unit type">
            <div className="flex flex-wrap gap-2">
              {UNIT_TYPES.map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => setDraft({ ...draft, unitType: unit })}
                  className={chip(draft.unitType === unit)}
                >
                  {unitOptionLabel(unit)}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Shop by">
            <div className="flex flex-wrap gap-2">
              {shops.map((shop) => (
                <button
                  key={shop.id}
                  type="button"
                  onClick={() => setDraft({ ...draft, shopId: shop.id })}
                  className={chip(draft.shopId === shop.id)}
                >
                  {shop.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDraft({ ...draft, shopId: null })}
                className={chip(draft.shopId === null)}
              >
                Not set
              </button>
            </div>
          </Field>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="pb-1.5 text-[13px] font-medium text-ios-label-2">{label}</p>
      {children}
    </div>
  );
}
