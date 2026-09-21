"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PriceDelta } from "@/components/PriceDelta";
import { Sheet } from "@/components/Sheet";
import { Stepper } from "@/components/Stepper";
import { getItemPriceHistory, recordPurchase, undoPurchase, updateListItem } from "@/lib/actions";
import { displayName, useLanguage } from "@/lib/language";
import {
  formatPrice,
  formatQty,
  formatUnitPrice,
  projectPrice,
  unitGroup,
  type UnitType,
} from "@/lib/units";
import type { ListItemDTO, PriceHistoryDTO } from "@/lib/types";

type PurchaseSheetProps = {
  item: ListItemDTO | null;
  /** False on a closed list — the quantity is then a historical record. */
  editable?: boolean;
  /** True when the list is closed but the user unlocked it with "Edit". */
  allowClosed?: boolean;
  onClose: () => void;
};

/**
 * Prompted when an item is checked off while shopping: capture what was
 * actually paid and show live how it compares with last month.
 *
 * The quantity can be corrected here too, behind a small edit button —
 * what you meant to buy and what you walked out with often differ (the
 * store had 150 g not 200 g; you grabbed two). Items marked
 * `hasVariableUnit` (sold in inconsistent pack sizes) open with the editor
 * already showing, since those are expected to need it.
 */
export function PurchaseSheet({ item, editable = true, allowClosed, onClose }: PurchaseSheetProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [unitType, setUnitType] = useState<UnitType>("COUNT");
  const [history, setHistory] = useState<PriceHistoryDTO[] | null>(null);
  const [editingQuantity, setEditingQuantity] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setPrice(item?.purchasePrice != null ? String(item.purchasePrice) : "");
    setQuantity(item?.quantity ?? 0);
    setUnitType(item?.unitType ?? "COUNT");
    setEditingQuantity(item?.hasVariableUnit ?? false);
    setComparing(false);
    setError(null);
    setHistory(null);
    if (item) {
      getItemPriceHistory(item.itemId).then(setHistory);
    }
  }, [item]);

  if (!item) return null;

  const name = displayName(item, language);
  const sizeChanged = quantity !== item.quantity || unitType !== item.unitType;
  const reference = item.purchasePrice != null ? item.previousPrice : item.lastPrice;
  const referenceQuantity = item.purchasePrice != null ? item.previousQuantity : item.lastPriceQuantity;
  const referenceUnitType = item.purchasePrice != null ? item.previousUnitType : item.lastPriceUnitType;
  const parsed = Number.parseFloat(price.replace(",", "."));
  const valid = Number.isFinite(parsed) && parsed >= 0;

  const canCompare =
    reference !== null && referenceQuantity !== null && referenceUnitType !== null;
  const projected =
    canCompare && unitGroup(referenceUnitType as UnitType) === unitGroup(unitType)
      ? projectPrice(
          reference as number,
          referenceQuantity as number,
          referenceUnitType as UnitType,
          quantity,
          unitType,
        )
      : null;

  // Per-kg / per-L / per-piece, the figure that survives a change of pack
  // size: ₹212 for 4 kg and ₹212 for 8 kg are the same rupees and a very
  // different deal. Recomputed as the price is typed. Null for RS-priced
  // items (their "quantity" is already rupees) and before a price is entered.
  const currentUnitPrice = valid && parsed > 0 ? formatUnitPrice(parsed, quantity, unitType) : null;
  const referenceUnitPrice = canCompare
    ? formatUnitPrice(
        reference as number,
        referenceQuantity as number,
        referenceUnitType as UnitType,
      )
    : null;

  const save = () => {
    if (!valid) {
      setError("Enter the price you paid.");
      return;
    }
    startTransition(async () => {
      if (sizeChanged) {
        const sizeResult = await updateListItem({
          listItemId: item.id,
          quantity,
          unitType,
          allowClosed,
        });
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

  // The quantity row below carries the amount whenever it's editable, so the
  // subtitle only spells it out when that row is hidden.
  return (
    <Sheet
      open
      onClose={onClose}
      title={name.primary}
      subtitle={[
        name.secondary,
        editable ? null : `List wants ${formatQty(item.quantity, item.unitType)}`,
        item.shopName,
      ]
        .filter(Boolean)
        .join(" · ")}
      footer={
        editable ? (
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
        ) : undefined
      }
    >
      <div className="space-y-4 pb-3">
        {editable ? (
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-ios-label-2">
                Quantity bought
                {sizeChanged ? (
                  <span className="ml-1.5 font-normal text-ios-blue">
                    (list wanted {formatQty(item.quantity, item.unitType)})
                  </span>
                ) : null}
              </span>
              {editingQuantity ? null : (
                <button
                  type="button"
                  onClick={() => setEditingQuantity(true)}
                  aria-label={`Edit quantity, currently ${formatQty(quantity, unitType)}`}
                  className="flex h-8 flex-none items-center gap-1.5 rounded-full bg-ios-surface-2 px-3 text-[14px] font-medium text-ios-blue ring-1 ring-inset ring-ios-separator transition active:scale-95"
                >
                  <span className="tabular-nums">{formatQty(quantity, unitType)}</span>
                  <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none" aria-hidden>
                    <path
                      d="M4 20l.9-4.2L15.6 5.1a1.6 1.6 0 0 1 2.3 0l1 1a1.6 1.6 0 0 1 0 2.3L8.2 19.1 4 20zM14.8 6l3.2 3.2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>

            {editingQuantity ? (
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
                <span className="mt-1.5 block text-[12px] text-ios-label-3">
                  {item.hasVariableUnit
                    ? "Store had a different size or pack? Adjust it here — the price comparison accounts for the change."
                    : "Bought a different amount? Adjust it here — the price you enter below is taken as the price for this quantity."}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {editable ? (
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-ios-label-2">Price paid</span>
              {canCompare ? (
                <button
                  type="button"
                  onClick={() => setComparing((current) => !current)}
                  aria-pressed={comparing}
                  aria-label="Compare with the last price paid"
                  title="Compare with the last price paid"
                  className={`flex h-8 w-8 flex-none items-center justify-center rounded-full transition active:scale-95 ${
                    comparing
                      ? "bg-ios-blue text-white"
                      : "bg-ios-surface-2 text-ios-blue ring-1 ring-inset ring-ios-separator"
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
                    <path
                      d="M12 4v16M5 8h14M5 8l-2.5 5.5h5L5 8zm14 0l-2.5 5.5h5L19 8z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ) : null}
            </div>
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
                aria-label="Price paid"
                className="h-14 w-full bg-transparent px-2 text-[22px] font-semibold tabular-nums outline-none"
              />
            </div>

            {comparing ? (
              <div className="mt-2 rounded-ios bg-ios-surface-2 p-3 ring-1 ring-inset ring-ios-separator">
                {projected !== null ? (
                  <>
                    <p className="text-[15px] font-semibold tabular-nums">
                      ≈ {formatPrice(projected)}
                      <span className="ml-1.5 text-[12px] font-normal text-ios-label-2">
                        at {formatQty(quantity, unitType)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[12px] text-ios-label-2">
                      Based on {formatPrice(reference as number)} for{" "}
                      {formatQty(referenceQuantity as number, referenceUnitType as UnitType)}
                    </p>
                  </>
                ) : (
                  <p className="text-[13px] text-ios-label-2">
                    Last bought in a different kind of unit — nothing to compare against.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          // Closed list: what was paid, stated, with nothing to type into.
          <div>
            <p className="text-[13px] font-medium text-ios-label-2">Price paid</p>
            <p className="mt-1 text-[28px] font-semibold tabular-nums">
              {item.isPurchased ? formatPrice(item.purchasePrice ?? 0) : "Not bought"}
            </p>
          </div>
        )}

        {!editable ? null : (
          <div className="space-y-2">
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

            {/* The rate, right under the pill: the same ₹ over a bigger or
                smaller pack is what the pill can't tell you. */}
            {currentUnitPrice || referenceUnitPrice ? (
              <p className="text-[13px] text-ios-label-2">
                {currentUnitPrice ? (
                  <>
                    <span className="font-semibold tabular-nums text-ios-label">
                      {currentUnitPrice}
                    </span>{" "}
                    at {formatQty(quantity, unitType)}
                  </>
                ) : null}
                {currentUnitPrice && referenceUnitPrice ? " · " : null}
                {referenceUnitPrice ? (
                  <>
                    <span className="tabular-nums">{referenceUnitPrice}</span> last time
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
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
                  {/* Shop first — where you bought it is what makes an old
                      price worth comparing; the list name only dates it. */}
                  <span className="min-w-0 pl-3 text-right text-[12px] text-ios-label-3">
                    <span className="block truncate">{entry.shopName ?? "Shop not set"}</span>
                    {entry.listName ? (
                      <span className="block truncate text-ios-label-3/70">{entry.listName}</span>
                    ) : null}
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
