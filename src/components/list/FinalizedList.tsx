"use client";

import { groupByShop } from "@/components/list/DraftEditor";
import { bilingualName, useLanguage } from "@/lib/language";
import { formatPrice, formatQty, projectPrice, unitGroup } from "@/lib/units";
import type { ListItemDTO } from "@/lib/types";

/**
 * What this item would cost at today's list quantity/unit, based on the
 * last price paid — projected the same way the shopping price comparison
 * is, so a pack-size change doesn't skew the shop's estimated total.
 */
function estimatedCost(item: ListItemDTO): number {
  if (item.lastPrice === null) return 0;
  if (item.lastPriceQuantity === null || item.lastPriceUnitType === null) return item.lastPrice;
  if (unitGroup(item.lastPriceUnitType) !== unitGroup(item.unitType)) return item.lastPrice;
  const projected = projectPrice(
    item.lastPrice,
    item.lastPriceQuantity,
    item.lastPriceUnitType,
    item.quantity,
    item.unitType,
  );
  return projected ?? item.lastPrice;
}

type FinalizedListProps = {
  items: ListItemDTO[];
  shopName: string | null;
};

/** Read-only print view of a finalized list, filtered to the selected shop. */
export function FinalizedList({ items, shopName }: FinalizedListProps) {
  const { language } = useLanguage();
  const groups = shopName ? [[shopName, items] as [string, ListItemDTO[]]] : groupByShop(items);
  let serial = 0;

  return (
    <div className="space-y-5">
      <p className="px-1 text-[15px] text-ios-label-2">
        {items.length} item{items.length === 1 ? "" : "s"}
        {shopName ? ` at ${shopName}` : " across all shops"}
      </p>

      {items.length === 0 ? (
        <p className="ios-card p-6 text-center text-[15px] text-ios-label-2">
          No items for this shop.
        </p>
      ) : (
        groups.map(([group, groupItems]) => {
          const groupTotal = groupItems.reduce((sum, item) => sum + estimatedCost(item), 0);
          return (
          <section key={group}>
            <p className="flex items-baseline justify-between px-1 pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-ios-label-3">
              <span>
                {group} · {groupItems.length}
              </span>
              {groupTotal > 0 ? (
                <span className="normal-case tabular-nums text-ios-label-2">
                  {formatPrice(groupTotal)}
                </span>
              ) : null}
            </p>
            <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
              {groupItems.map((item) => {
                serial += 1;
                const name = bilingualName(item.nameTa, item.nameEn, language);
                return (
                  <li key={item.id} className="ios-row">
                    <span className="w-6 flex-none text-[14px] tabular-nums text-ios-label-3">
                      {serial}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-medium">{name.primary}</span>
                      <span className="block truncate text-[13px] text-ios-label-2">
                        {name.secondary}
                      </span>
                    </span>
                    <span className="flex-none text-[15px] font-semibold tabular-nums">
                      {formatQty(item.quantity, item.unitType)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
          );
        })
      )}
    </div>
  );
}
