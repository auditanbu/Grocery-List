"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PriceDelta } from "@/components/PriceDelta";
import { Sheet } from "@/components/Sheet";
import { Stepper } from "@/components/Stepper";
import { getItemPriceHistory, recordPurchase, undoPurchase, updateListItem } from "@/lib/actions";
import { formatPrice, formatQty, type UnitType } from "@/lib/units";
import type { ListItemDTO, PriceHistoryDTO } from "@/lib/types";

type PurchaseSheetProps = {
  item: ListItemDTO | null;
  onClose: () => void;
};

/**
 * Prompted when an item is checked off while shopping: capture what was
 * actually paid and show live how it compares with last month. Items
 * marked `hasVariableUnit` (sold in inconsistent pack sizes) also let the
 * shopper adjust the quantity/unit here — e.g. the list wants 200 g but the
 * store only has 150 g, or a 3-pack becomes a 4-pack of a different size.
 */
export function PurchaseSheet({ item, onClose }: PurchaseSheetProps) {
  const router = useRouter();
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [unitType, setUnitType] = useState<UnitType>("COUNT");
  const [history, setHistory] = useState<PriceHistoryDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setPrice(item?.purchasePrice != null ? String(item.purchasePrice) : "");
    setQuantity(item?.quantity ?? 0);
    setUnitType(item?.unitType ?? "COUNT");
    setError(null);
    setHistory(null);
    if (item) {
      getItemPriceHistory(item.itemId).then(setHistory);
    }
  }, [item]);

  if (!item) return null;

  const sizeChanged = quantity !== item.quantity || unitType !== item.unitType;
  const reference = item.purchasePrice != null ? item.previousPrice : item.lastPrice;
  const referenceQuantity = item.purchasePrice != null ? item.previousQuantity : item.lastPriceQuantity;
  const referenceUnitType = item.purchasePrice != null ? item.previousUnitType : item.lastPriceUnitType;
  const parsed = Number.parseFloat(price.replace(",", "."));
  const valid = Number.isFinite(parsed) && parsed >= 0;

  const save = () => {
    if (!valid) {
      setError("Enter the price you paid.");
      return;
    }
    startTransition(async () => {
      if (item.hasVariableUnit && sizeChanged) {
        const sizeResult = await updateListItem({ listItemId: item.id, quantity, unitType });
        if (!sizeResult.ok) {
          setError(sizeResult.error);
          return;
        }
      }
      const result = await recordPurchase({ listItemId: item.id, price: parsed });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  const undo = () => {
    startTransition(async () => {
      const result = await undoPurchase(item.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={item.nameTa}
      subtitle={`${item.nameEn} · List wants ${formatQty(item.quantity, item.unitType)}${
        item.shopName ? ` · ${item.shopName}` : ""
      }`}
      footer={
        <div className="space-y-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="flex h-12 w-full items-center justify-center rounded-ios bg-ios-blue text-[17px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? "Saving…" : item.isPurchased ? "Update price" : "Mark as bought"}
          </button>
          {item.isPurchased ? (
            <button
              type="button"
              onClick={undo}
              disabled={pending}
              className="h-11 w-full text-[16px] font-medium text-ios-red active:opacity-60"
            >
              Uncheck item
            </button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4 pb-3">
        {item.hasVariableUnit ? (
          <label className="block">
            <span className="text-[13px] font-medium text-ios-label-2">
              Quantity &amp; size bought
              {sizeChanged ? (
                <span className="ml-1.5 font-normal text-ios-blue">
                  (list wanted {formatQty(item.quantity, item.unitType)})
                </span>
              ) : null}
            </span>
            <div className="mt-1.5">
              <Stepper
                value={quantity}
                unit={unitType}
                onChange={(nextQuantity, nextUnit) => {
                  setQuantity(nextQuantity);
                  setUnitType(nextUnit);
                }}
                aria-label={`Quantity for ${item.nameEn}`}
              />
            </div>
            <span className="mt-1.5 block text-[12px] text-ios-label-3">
              Store had a different size or pack? Adjust it here — the price
              comparison accounts for the change.
            </span>
          </label>
        ) : null}

        <label className="block">
          <span className="text-[13px] font-medium text-ios-label-2">Price paid</span>
          <div className="mt-1.5 flex items-center rounded-ios bg-ios-surface-2 px-4 ring-1 ring-inset ring-ios-separator focus-within:ring-2 focus-within:ring-ios-blue">
            <span className="text-[22px] font-semibold text-ios-label-2">₹</span>
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") save();
              }}
              placeholder="0.00"
              className="h-14 w-full bg-transparent px-2 text-[22px] font-semibold tabular-nums outline-none"
            />
          </div>
        </label>

        {reference !== null ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPrice(String(reference))}
              className="h-9 rounded-full bg-ios-surface-2 px-3.5 text-[14px] font-medium text-ios-blue ring-1 ring-inset ring-ios-separator active:scale-95"
            >
              Same as last time · {formatPrice(reference)}
            </button>
            {valid ? (
              <PriceDelta
                current={parsed}
                previous={reference}
                currentQuantity={quantity}
                currentUnitType={unitType}
                previousQuantity={referenceQuantity ?? undefined}
                previousUnitType={referenceUnitType ?? undefined}
              />
            ) : null}
          </div>
        ) : (
          <p className="text-[13px] text-ios-label-2">
            First time buying this — the price becomes the baseline for next month.
          </p>
        )}

        {error ? <p className="text-[14px] text-ios-red">{error}</p> : null}

        <div className="border-t border-ios-separator pt-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-ios-label-3">
              Price history
            </p>
            <Link
              href={`/grocery/items/${item.itemId}`}
              className="text-[13px] font-medium text-ios-blue active:opacity-60"
            >
              See all
            </Link>
          </div>
          {history === null ? (
            <p className="pt-2 text-[13px] text-ios-label-2">Loading…</p>
          ) : history.length === 0 ? (
            <p className="pt-2 text-[13px] text-ios-label-2">No earlier purchases yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-ios-separator overflow-hidden rounded-ios bg-ios-surface-2">
              {history.slice(0, 3).map((entry) => (
                <li key={entry.id} className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-[14px] font-medium tabular-nums">
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
      </div>
    </Sheet>
  );
}
