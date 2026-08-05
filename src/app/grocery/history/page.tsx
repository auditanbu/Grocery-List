import Link from "next/link";

import { PriceDelta } from "@/components/PriceDelta";
import { monthKeyToLabel } from "@/lib/dates";
import { getLists, getRecentPriceChanges } from "@/lib/queries";
import { formatPrice, formatQty } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const [lists, changes] = await Promise.all([getLists(), getRecentPriceChanges()]);
  const completed = lists.filter((list) => list.totalSpent > 0);
  const totalSpent = completed.reduce((sum, list) => sum + list.totalSpent, 0);

  return (
    <div className="space-y-6">
      <header className="pt-2">
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">History</h1>
        <p className="text-[15px] text-ios-label-2">
          {completed.length} month{completed.length === 1 ? "" : "s"} recorded ·{" "}
          {formatPrice(totalSpent)} total
        </p>
      </header>

      <section>
        <h2 className="px-1 pb-2 text-[20px] font-semibold tracking-tight">Biggest price moves</h2>
        {changes.length === 0 ? (
          <p className="ios-card p-5 text-[15px] text-ios-label-2">
            Once you have bought an item in two different months, the change shows up here.
          </p>
        ) : (
          <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
            {changes.map((change) => (
              <li key={change.itemId}>
                <Link href={`/grocery/items/${change.itemId}`} className="ios-row active:bg-ios-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-medium">{change.nameTa}</span>
                    <span className="block truncate text-[13px] text-ios-label-2">
                      {change.nameEn} · {formatPrice(change.current)}
                    </span>
                  </span>
                  <PriceDelta current={change.current} previous={change.previous} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="px-1 pb-2 text-[20px] font-semibold tracking-tight">Monthly spend</h2>
        {lists.length === 0 ? (
          <p className="ios-card p-5 text-[15px] text-ios-label-2">No lists yet.</p>
        ) : (
          <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
            {lists.map((list) => (
              <li key={list.id}>
                <Link href={`/grocery/lists/${list.id}`} className="ios-row active:bg-ios-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-medium">{list.name}</span>
                    <span className="block text-[13px] text-ios-label-2">
                      {monthKeyToLabel(list.monthKey)} · {list.purchasedCount}/{list.itemCount}{" "}
                      bought
                    </span>
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums">
                    {list.totalSpent > 0 ? formatPrice(list.totalSpent) : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="px-1 text-[13px] text-ios-label-3">
        Quantities are recorded with each purchase, e.g.{" "}
        {formatQty(0.5, "KG")} or {formatQty(150, "G")}.
      </p>
    </div>
  );
}
