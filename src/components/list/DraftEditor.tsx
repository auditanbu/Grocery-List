"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Sheet } from "@/components/Sheet";
import { ShopFilter } from "@/components/list/ShopFilter";
import { Stepper } from "@/components/Stepper";
import { finalizeList, getItemPriceHistory, removeListItem, updateListItem } from "@/lib/actions";
import { displayName, displayNameLine, useLanguage } from "@/lib/language";
import { formatPrice, formatQty, type UnitType } from "@/lib/units";
import type { ListDetailDTO, ListItemDTO, PriceHistoryDTO, ShopDTO } from "@/lib/types";

type DraftEditorProps = {
  list: ListDetailDTO;
};

export function DraftEditor({ list }: DraftEditorProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const [shopPickerFor, setShopPickerFor] = useState<ListItemDTO | null>(null);
  const [shopId, setShopId] = useState<number | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [historyByItem, setHistoryByItem] = useState<Record<number, PriceHistoryDTO[] | undefined>>({});

  const toggleHistory = (item: ListItemDTO) => {
    setExpandedItemId((current) => (current === item.id ? null : item.id));
    if (!(item.itemId in historyByItem)) {
      getItemPriceHistory(item.itemId).then((history) =>
        setHistoryByItem((prev) => ({ ...prev, [item.itemId]: history })),
      );
    }
  };

  const shopOptions = useMemo(() => {
    const counts = new Map<number | null, { name: string; count: number }>();
    for (const item of list.items) {
      const key = item.shopId;
      const entry = counts.get(key) ?? { name: item.shopName ?? "Not set", count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
    return [...counts.entries()]
      .map(([id, value]) => ({ id, name: value.name, count: value.count }))
      .sort((a, b) => {
        if (a.id === null) return 1;
        if (b.id === null) return -1;
        return a.name.localeCompare(b.name);
      });
  }, [list.items]);

  const visibleItems = useMemo(
    () => (shopId === undefined ? list.items : list.items.filter((item) => item.shopId === shopId)),
    [list.items, shopId],
  );

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
    const zeroCount = list.items.filter((item) => item.quantity === 0).length;
    if (zeroCount > 0) {
      const noun = zeroCount === 1 ? "item is" : "items are";
      const proceed = window.confirm(
        `${zeroCount} ${noun} still at 0 quantity and will be removed when you finalize. Continue?`,
      );
      if (!proceed) return;
    }
    startTransition(async () => {
      const result = await finalizeList(list.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const byShop = groupByShop(visibleItems);

  return (
    <div className="space-y-5">
      <Link
        href={`/grocery/lists/${list.id}/add`}
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

      {list.items.length > 0 ? (
        <ShopFilter
          options={shopOptions}
          value={shopId}
          onChange={setShopId}
          total={list.items.length}
        />
      ) : null}

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
      ) : visibleItems.length === 0 ? (
        <p className="ios-card p-6 text-center text-[15px] text-ios-label-2">
          No items for this shop.
        </p>
      ) : (
        <div className="space-y-5">
          {byShop.map(([shopName, items]) => (
            <section key={shopName}>
              <p className="px-1 pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-ios-label-3">
                {shopName} · {items.length}
              </p>
              <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
                {items.map((item) => {
                  const name = displayName(item, language);
                  const expanded = expandedItemId === item.id;
                  const history = historyByItem[item.itemId];
                  return (
                  <li key={item.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-medium">{name.primary}</p>
                        <p className="truncate text-[13px] text-ios-label-2">{name.secondary}</p>
                        {stateOf(item).quantity === 0 ? (
                          <span className="mt-0.5 inline-flex items-center rounded-full bg-ios-orange/15 px-2 py-0.5 text-[11px] font-medium text-ios-orange">
                            Check availability
                          </span>
                        ) : null}
                      </div>
                      <Stepper
                        value={stateOf(item).quantity}
                        unit={stateOf(item).unitType}
                        size="compact"
                        minOverride={0}
                        onBelowMin={() => remove(item)}
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
                        onClick={() => toggleHistory(item)}
                        className="flex h-8 items-center gap-1 rounded-full bg-ios-surface-2 px-3 text-[13px] font-medium text-ios-blue ring-1 ring-inset ring-ios-separator active:scale-95"
                      >
                        Price history
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
                      <button
                        type="button"
                        onClick={() => remove(item)}
                        disabled={pending}
                        className="h-8 rounded-full px-3 text-[13px] font-medium text-ios-red active:opacity-60"
                      >
                        Remove
                      </button>
                    </div>

                    {expanded ? (
                      <div className="mt-2 rounded-ios bg-ios-surface-2 p-3 ring-1 ring-inset ring-ios-separator">
                        {history === undefined ? (
                          <p className="text-[13px] text-ios-label-2">Loading…</p>
                        ) : history.length === 0 ? (
                          <p className="text-[13px] text-ios-label-2">No purchases recorded yet.</p>
                        ) : (
                          <ul className="divide-y divide-ios-separator overflow-hidden rounded-ios bg-ios-surface">
                            {history.slice(0, 5).map((entry) => (
                              <li key={entry.id} className="flex items-center justify-between px-3 py-2">
                                <span className="text-[13px] font-medium tabular-nums">
                                  {formatPrice(entry.price)}
                                  <span className="ml-1.5 text-[12px] font-normal text-ios-label-2">
                                    for {formatQty(entry.quantity, entry.unitType)}
                                  </span>
                                </span>
                                <span className="text-[12px] text-ios-label-3">
                                  {entry.listName ?? entry.shopName ?? ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
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
        subtitle={shopPickerFor ? displayNameLine(shopPickerFor, language) : undefined}
        onClose={() => setShopPickerFor(null)}
        onPick={changeShop}
      />
    </div>
  );
}

function ShopPickerSheet({
  item,
  shops,
  subtitle,
  onClose,
  onPick,
}: {
  item: ListItemDTO | null;
  shops: ShopDTO[];
  subtitle?: string;
  onClose: () => void;
  onPick: (item: ListItemDTO, shopId: number | null) => void;
}) {
  return (
    <Sheet open={item !== null} onClose={onClose} title="Shop by" subtitle={subtitle}>
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
