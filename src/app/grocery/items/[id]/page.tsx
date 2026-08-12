import Link from "next/link";
import { notFound } from "next/navigation";

import { PriceDelta } from "@/components/PriceDelta";
import { formatDate } from "@/lib/dates";
import { getMasterItems, getPriceHistory } from "@/lib/queries";
import { formatPrice, formatQty } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function ItemHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) notFound();

  const [items, history] = await Promise.all([
    getMasterItems({ includeInactive: true }),
    getPriceHistory(itemId),
  ]);
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) notFound();

  return (
    <div className="space-y-5">
      <Link href="/grocery/master" className="inline-flex items-center gap-1 pt-1 text-[15px] text-ios-blue">
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
        Master List
      </Link>

      <header>
        <h1 className="text-[30px] font-bold leading-tight tracking-tight">{item.nameTa}</h1>
        <p className="text-[15px] text-ios-label-2">
          {item.nameTl ? `${item.nameTl} · ` : ""}
          {item.nameEn} · {item.categoryName}
          {item.shopName ? ` · ${item.shopName}` : ""}
        </p>
      </header>

      {history.length === 0 ? (
        <p className="ios-card p-6 text-center text-[15px] text-ios-label-2">
          No purchases recorded yet.
        </p>
      ) : (
        <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
          {history.map((entry, index) => {
            const previousEntry = history[index + 1] ?? null;
            return (
              <li key={entry.id} className="ios-row">
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-medium">
                    {formatPrice(entry.price)}
                    <span className="ml-2 text-[13px] font-normal text-ios-label-2">
                      for {formatQty(entry.quantity, entry.unitType)}
                    </span>
                  </span>
                  <span className="block truncate text-[13px] text-ios-label-2">
                    {entry.listName ?? formatDate(new Date(entry.purchasedAt))}
                    {entry.shopName ? ` · ${entry.shopName}` : ""}
                  </span>
                </span>
                <PriceDelta
                  current={entry.price}
                  previous={previousEntry?.price ?? null}
                  currentQuantity={entry.quantity}
                  currentUnitType={entry.unitType}
                  previousQuantity={previousEntry?.quantity}
                  previousUnitType={previousEntry?.unitType}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
