"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Sheet } from "@/components/Sheet";
import { Stepper } from "@/components/Stepper";
import { addListItem } from "@/lib/actions";
import { formatPrice, normalizeQty } from "@/lib/units";
import type { MasterItemDTO, ShopDTO } from "@/lib/types";

type AddItemSheetProps = {
  open: boolean;
  onClose: () => void;
  listId: number;
  items: MasterItemDTO[];
  shops: ShopDTO[];
};

/**
 * Two-step sheet: search the master list, then set quantity and shop
 * before adding the item to the draft.
 */
export function AddItemSheet({ open, onClose, listId, items, shops }: AddItemSheetProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MasterItemDTO | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [shopId, setShopId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? items.filter(
          (item) =>
            item.nameEn.toLowerCase().includes(needle) ||
            item.nameTa.includes(query.trim()) ||
            item.categoryName.toLowerCase().includes(needle),
        )
      : items;

    const grouped = new Map<string, MasterItemDTO[]>();
    for (const item of matches) {
      grouped.set(item.categoryName, [...(grouped.get(item.categoryName) ?? []), item]);
    }
    return [...grouped.entries()];
  }, [items, query]);

  const reset = () => {
    setSelected(null);
    setQuery("");
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const pick = (item: MasterItemDTO) => {
    setSelected(item);
    setQuantity(normalizeQty(item.defaultQty || 1, item.unitType));
    setShopId(item.shopId);
    setError(null);
  };

  const add = () => {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await addListItem({ listId, itemId: selected.id, quantity, shopId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSelected(null);
      setQuery("");
      router.refresh();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={selected ? selected.nameEn : "Add item"}
      subtitle={
        selected
          ? selected.nameTa
          : `${items.length} items in your master list`
      }
      footer={
        selected ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="h-12 flex-none rounded-ios px-5 text-[17px] font-medium text-ios-blue active:opacity-60"
            >
              Back
            </button>
            <button
              type="button"
              onClick={add}
              disabled={pending}
              className="flex h-12 flex-1 items-center justify-center rounded-ios bg-ios-blue text-[17px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
            >
              {pending ? "Adding…" : "Add to list"}
            </button>
          </div>
        ) : null
      }
    >
      {selected ? (
        <div className="space-y-5 pb-3">
          <div className="rounded-ios bg-ios-surface-2 p-4">
            <p className="text-[13px] font-medium text-ios-label-2">Quantity</p>
            <div className="mt-3 flex justify-center">
              <Stepper
                value={quantity}
                unit={selected.unitType}
                onChange={setQuantity}
                aria-label={`Quantity for ${selected.nameEn}`}
              />
            </div>
          </div>

          <div>
            <p className="px-1 pb-2 text-[13px] font-medium text-ios-label-2">Shop by</p>
            <div className="flex flex-wrap gap-2">
              {shops.map((shop) => (
                <button
                  key={shop.id}
                  type="button"
                  onClick={() => setShopId(shop.id)}
                  className={`h-10 rounded-full px-4 text-[15px] font-medium transition active:scale-95 ${
                    shopId === shop.id
                      ? "bg-ios-blue text-white"
                      : "bg-ios-surface-2 text-ios-label-2 ring-1 ring-inset ring-ios-separator"
                  }`}
                >
                  {shop.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShopId(null)}
                className={`h-10 rounded-full px-4 text-[15px] font-medium transition active:scale-95 ${
                  shopId === null
                    ? "bg-ios-blue text-white"
                    : "bg-ios-surface-2 text-ios-label-2 ring-1 ring-inset ring-ios-separator"
                }`}
              >
                Not set
              </button>
            </div>
          </div>

          {selected.lastPrice !== null ? (
            <p className="text-[13px] text-ios-label-2">
              Last paid {formatPrice(selected.lastPrice)}
            </p>
          ) : null}

          {error ? <p className="text-[14px] text-ios-red">{error}</p> : null}
        </div>
      ) : (
        <div className="pb-3">
          <div className="sticky top-0 z-10 -mx-1 bg-ios-surface px-1 pb-3">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Tamil or English name"
              className="h-11 w-full rounded-ios bg-ios-surface-2 px-4 text-[17px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
            />
          </div>

          {results.length === 0 ? (
            <p className="py-8 text-center text-[15px] text-ios-label-2">
              Nothing matched “{query}”. Add it from the Master List tab.
            </p>
          ) : (
            <div className="space-y-5">
              {results.map(([category, categoryItems]) => (
                <div key={category}>
                  <p className="px-1 pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-ios-label-3">
                    {category}
                  </p>
                  <ul className="overflow-hidden rounded-ios bg-ios-surface-2 divide-y divide-ios-separator">
                    {categoryItems.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => pick(item)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-ios-separator/40"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[16px] font-medium">
                              {item.nameTa}
                            </span>
                            <span className="block truncate text-[13px] text-ios-label-2">
                              {item.nameEn}
                              {item.shopName ? ` · ${item.shopName}` : ""}
                            </span>
                          </span>
                          <span className="text-[22px] leading-none text-ios-blue">+</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
