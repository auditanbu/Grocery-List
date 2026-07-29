"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Sheet } from "@/components/Sheet";
import { Stepper } from "@/components/Stepper";
import { finalizeList, removeListItem, updateListItem } from "@/lib/actions";
import { bilingualName, useLanguage } from "@/lib/language";
import type { UnitType } from "@/lib/units";
import type { ListDetailDTO, ListItemDTO, ShopDTO } from "@/lib/types";

type DraftEditorProps = {
  list: ListDetailDTO;
};

export function DraftEditor({ list }: DraftEditorProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const [shopPickerFor, setShopPickerFor] = useState<ListItemDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Optimistic quantity/unit keep the stepper responsive while the action runs.
  const [overrides, setOverrides] = useState<Record<number, { quantity: number; unitType: UnitType }>>({});
  const stateOf = (item: ListItemDTO) =>
    overrides[item.id] ?? { quantity: item.quantity, unitType: item.unitType };

  const changeQuantity = (item: ListItemDTO, quantity: number, unitType: UnitType) => {
    setOverrides((current) => ({ ...current, [item.id]: { quantity, unitType } }));
    startTransition(async () => {
      const result = await updateListItem({ listItemId: item.id, quantity, unitType });
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  const changeShop = (item: ListItemDTO, shopId: number | null) => {
    setShopPickerFor(null);
    startTransition(async () => {
      const result = await updateListItem({ listItemId: item.id, shopId });
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  const remove = (item: ListItemDTO) => {
    startTransition(async () => {
      const result = await removeListItem(item.id);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  const finalize = () => {
    setError(null);
    startTransition(async () => {
      const result = await finalizeList(list.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const byShop = groupByShop(list.items);

  return (
    <div className="space-y-5">
      <Link
        href={`/lists/${list.id}/add`}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-ios bg-ios-blue text-[17px] font-semibold text-white transition active:scale-[0.98]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path
            d="M12 6v12M6 12h12"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
          />
        </svg>
        Add item
      </Link>

      {error ? (
        <p className="rounded-ios bg-ios-red-soft px-4 py-3 text-[14px] text-ios-red">{error}</p>
      ) : null}

      {list.items.length === 0 ? (
        <div className="ios-card p-8 text-center">
          <p className="text-[17px] font-medium">Nothing on the list yet</p>
          <p className="mt-1 text-[15px] text-ios-label-2">
            Search your master list and set the quantity and shop for each item.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {byShop.map(([shopName, items]) => (
            <section key={shopName}>
              <p className="px-1 pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-ios-label-3">
                {shopName} · {items.length}
              </p>
              <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
                {items.map((item) => {
                  const name = bilingualName(item.nameTa, item.nameEn, language);
                  return (
                  <li key={item.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-medium">{name.primary}</p>
                        <p className="truncate text-[13px] text-ios-label-2">{name.secondary}</p>
                      </div>
                      <Stepper
                        value={stateOf(item).quantity}
                        unit={stateOf(item).unitType}
                        size="compact"
                        onChange={(quantity, unitType) => changeQuantity(item, quantity, unitType)}
                        aria-label={`Quantity for ${item.nameEn}`}
                      />
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShopPickerFor(item)}
                        className="h-8 rounded-full bg-ios-surface-2 px-3 text-[13px] font-medium text-ios-label-2 ring-1 ring-inset ring-ios-separator active:scale-95"
                      >
                        {item.shopName ?? "Pick shop"}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(item)}
                        disabled={pending}
                        className="h-8 rounded-full px-3 text-[13px] font-medium text-ios-red active:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {list.items.length > 0 ? (
        <button
          type="button"
          onClick={finalize}
          disabled={pending}
          className="flex h-12 w-full items-center justify-center rounded-ios bg-ios-surface text-[17px] font-semibold text-ios-blue shadow-ios transition active:scale-[0.98] disabled:opacity-50"
        >
          Finalize list
        </button>
      ) : null}

      <ShopPickerSheet
        item={shopPickerFor}
        shops={list.shops}
        onClose={() => setShopPickerFor(null)}
        onPick={changeShop}
      />
    </div>
  );
}

function ShopPickerSheet({
  item,
  shops,
  onClose,
  onPick,
}: {
  item: ListItemDTO | null;
  shops: ShopDTO[];
  onClose: () => void;
  onPick: (item: ListItemDTO, shopId: number | null) => void;
}) {
  return (
    <Sheet
      open={item !== null}
      onClose={onClose}
      title="Shop by"
      subtitle={item ? `${item.nameEn} · ${item.nameTa}` : undefined}
    >
      {item ? (
        <ul className="divide-y divide-ios-separator overflow-hidden rounded-ios bg-ios-surface-2">
          {shops.map((shop) => (
            <li key={shop.id}>
              <button
                type="button"
                onClick={() => onPick(item, shop.id)}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left text-[16px] active:bg-ios-separator/40"
              >
                {shop.name}
                {item.shopId === shop.id ? <Check /> : null}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => onPick(item, null)}
              className="flex w-full items-center justify-between px-4 py-3.5 text-left text-[16px] text-ios-label-2 active:bg-ios-separator/40"
            >
              Not set
              {item.shopId === null ? <Check /> : null}
            </button>
          </li>
        </ul>
      ) : null}
    </Sheet>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-ios-blue" aria-hidden>
      <path
        d="M5 13l4.5 4.5L19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Groups rows by shop, keeping "Not set" last. */
export function groupByShop(items: ListItemDTO[]): [string, ListItemDTO[]][] {
  const grouped = new Map<string, ListItemDTO[]>();
  for (const item of items) {
    const key = item.shopName ?? "Not set";
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return [...grouped.entries()].sort(([a], [b]) => {
    if (a === "Not set") return 1;
    if (b === "Not set") return -1;
    return a.localeCompare(b);
  });
}
