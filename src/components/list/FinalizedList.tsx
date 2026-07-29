"use client";

import { ExportPdfButton } from "@/components/list/ExportPdfButton";
import { groupByShop } from "@/components/list/DraftEditor";
import { bilingualName, useLanguage } from "@/lib/language";
import { formatQty } from "@/lib/units";
import type { ListDetailDTO, ListItemDTO } from "@/lib/types";

type FinalizedListProps = {
  list: ListDetailDTO;
  items: ListItemDTO[];
  shopName: string | null;
};

/** Read-only print view of a finalized list, filtered to the selected shop. */
export function FinalizedList({ list, items, shopName }: FinalizedListProps) {
  const { language } = useLanguage();
  const groups = shopName ? [[shopName, items] as [string, ListItemDTO[]]] : groupByShop(items);
  let serial = 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] text-ios-label-2">
          {items.length} item{items.length === 1 ? "" : "s"}
          {shopName ? ` at ${shopName}` : " across all shops"}
        </p>
        {list.status !== "COMPLETED" ? (
          <ExportPdfButton
            listName={list.name}
            shopName={shopName}
            items={items}
            groupByShop={!shopName}
            language={language}
          />
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="ios-card p-6 text-center text-[15px] text-ios-label-2">
          No items for this shop.
        </p>
      ) : (
        groups.map(([group, groupItems]) => (
          <section key={group}>
            <p className="px-1 pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-ios-label-3">
              {group} · {groupItems.length}
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
        ))
      )}
    </div>
  );
}
