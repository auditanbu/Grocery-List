"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PriceDelta } from "@/components/PriceDelta";
import { Sheet } from "@/components/Sheet";
import { recordPurchase, undoPurchase } from "@/lib/actions";
import { formatPrice, formatQty } from "@/lib/units";
import type { ListItemDTO } from "@/lib/types";

type PurchaseSheetProps = {
  item: ListItemDTO | null;
  onClose: () => void;
};

/**
 * Prompted when an item is checked off while shopping: capture what was
 * actually paid and show live how it compares with last month.
 */
export function PurchaseSheet({ item, onClose }: PurchaseSheetProps) {
  const router = useRouter();
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setPrice(item?.purchasePrice != null ? String(item.purchasePrice) : "");
    setError(null);
  }, [item]);

  if (!item) return null;

  const reference = item.purchasePrice != null ? item.previousPrice : item.lastPrice;
  const parsed = Number.parseFloat(price.replace(",", "."));
  const valid = Number.isFinite(parsed) && parsed >= 0;

  const save = () => {
    if (!valid) {
      setError("Enter the price you paid.");
      return;
    }
    startTransition(async () => {
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
      subtitle={`${item.nameEn} · ${formatQty(item.quantity, item.unitType)}${
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
            {valid ? <PriceDelta current={parsed} previous={reference} /> : null}
          </div>
        ) : (
          <p className="text-[13px] text-ios-label-2">
            First time buying this — the price becomes the baseline for next month.
          </p>
        )}

        {error ? <p className="text-[14px] text-ios-red">{error}</p> : null}
      </div>
    </Sheet>
  );
}
