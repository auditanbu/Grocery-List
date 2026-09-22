"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PriceDelta } from "@/components/PriceDelta";
import { Sheet } from "@/components/Sheet";
import { SizeField } from "@/components/SizeField";
import { Stepper } from "@/components/Stepper";
import { getItemPriceHistory, recordPurchase, undoPurchase, updateListItem } from "@/lib/actions";
import { displayName, useLanguage } from "@/lib/language";
import { useRateBasis } from "@/lib/rate-basis";
import {
  formatNameWithSize,
  formatPrice,
  formatQty,
  formatQtyValue,
  formatQtyWithSize,
  formatUnitPrice,
  rateBasisLabel,
  sizeOf,
  totalFromShelfPrice,
  totalAmount,
  type RateBasis,
  type UnitType,
} from "@/lib/units";
import type { ListItemDTO, PriceHistoryDTO, ShopDTO } from "@/lib/types";

/** "Showing the rate per kg — tap for per 500 g." */
function rateBasisHint(unit: UnitType, basis: RateBasis, nextBasis: RateBasis): string {
  return `Showing the rate per ${rateBasisLabel(unit, basis)} — tap for per ${rateBasisLabel(
    unit,
    nextBasis,
  )}`;
}

type PurchaseSheetProps = {
  item: ListItemDTO | null;
  /** Every shop on the list, so the row can be moved to the right one. */
  shops: ShopDTO[];
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
 * Two things can be corrected here, each behind its own pill on one row:
 *
 *   - the **size**, for anything sold in packs — the shop only had the
 *     150 g tube, not the 200 g one the list asks for;
 *   - the **quantity** — you grabbed two.
 *
 * Both are applied before the price is recorded, so what you type is
 * always the price for what actually went in the basket, and the
 * comparison against last time is made on the total amount (packs × size)
 * rather than on "one tube" either way.
 */
export function PurchaseSheet({
  item,
  shops,
  editable = true,
  allowClosed,
  onClose,
}: PurchaseSheetProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const { basis, nextBasis, cycleBasis } = useRateBasis();
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [unitType, setUnitType] = useState<UnitType>("COUNT");
  const [sizeValue, setSizeValue] = useState<number | null>(null);
  const [sizeUnit, setSizeUnit] = useState<UnitType | null>(null);
  const [shopId, setShopId] = useState<number | null>(null);
  const [history, setHistory] = useState<PriceHistoryDTO[] | null>(null);
  // True while the field holds a total the shelf chip worked out, so the chip
  // does not turn round and offer to multiply its own answer. Any keystroke
  // in the field clears it.
  const [priceIsProduct, setPriceIsProduct] = useState(false);
  const [editingSize, setEditingSize] = useState(false);
  const [editingQuantity, setEditingQuantity] = useState(false);
  const [editingShop, setEditingShop] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const priceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPrice(item?.purchasePrice != null ? String(item.purchasePrice) : "");
    setQuantity(item?.quantity ?? 0);
    setUnitType(item?.unitType ?? "COUNT");
    setSizeValue(item?.sizeValue ?? null);
    setSizeUnit(item?.sizeUnit ?? null);
    setShopId(item?.shopId ?? null);
    setEditingQuantity(false);
    setPriceIsProduct(false);
    setEditingSize(false);
    setEditingShop(false);
    setError(null);
    setHistory(null);
    if (item) {
      getItemPriceHistory(item.itemId).then(setHistory);
      // The price is what the sheet is for, so the cursor starts there and
      // the phone's keyboard comes up with it. Done here rather than with
      // `autoFocus`: the sheet is portalled and the same input is reused
      // from one item to the next, so there is no fresh mount for that
      // attribute to fire on.
      requestAnimationFrame(() => priceRef.current?.focus());
    }
  }, [item]);

  if (!item) return null;

  const name = displayName(item, language);
  const size = sizeOf(sizeValue, sizeUnit);
  const listSize = sizeOf(item.sizeValue, item.sizeUnit);
  // Anything counted in packs can carry a pack size, whether or not one has
  // ever been filled in: an item nobody has sized yet is exactly the one you
  // are holding when you notice it is a 650 ml bottle. Items measured in
  // g/ml/kg/L (or priced in rupees) carry their amount in the quantity
  // instead, and have no size to set.
  const sizeable = unitType === "COUNT";
  const sizeChanged =
    size?.value !== listSize?.value || size?.unit !== listSize?.unit;
  const quantityChanged = quantity !== item.quantity || unitType !== item.unitType;
  const shopChanged = shopId !== item.shopId;
  const shopLabel = (id: number | null) =>
    shops.find((shop) => shop.id === id)?.name ?? "Not set";

  const reference = item.purchasePrice != null ? item.previousPrice : item.lastPrice;
  const referenceQuantity = item.purchasePrice != null ? item.previousQuantity : item.lastPriceQuantity;
  const referenceUnitType = item.purchasePrice != null ? item.previousUnitType : item.lastPriceUnitType;
  const referenceSize =
    item.purchasePrice != null
      ? sizeOf(item.previousSizeValue, item.previousSizeUnit)
      : sizeOf(item.lastPriceSizeValue, item.lastPriceSizeUnit);
  const parsed = Number.parseFloat(price.replace(",", "."));
  const valid = Number.isFinite(parsed) && parsed >= 0;

  // Packs × size — the amount both prices are actually about. A tube is a
  // tube either way; 200 g against 150 g is what the comparison hangs on.
  const bought = totalAmount(quantity, unitType, size);
  const referenceBought =
    referenceQuantity !== null && referenceUnitType !== null
      ? totalAmount(referenceQuantity, referenceUnitType, referenceSize)
      : null;

  // The shelf prices one — one soap, one kilo — and the list counts eight, so
  // the multiplication is offered rather than left to be done at the shelf.
  // Read off the live quantity, so bumping the count re-does the sum.
  const shelf =
    valid && parsed > 0 && !priceIsProduct
      ? totalFromShelfPrice(parsed, quantity, unitType, basis)
      : null;
  // Nothing to apply when the answer is the number already typed: one pack,
  // or a 1 kg row while the rate line is quoting per kg.
  const showShelfChip = shelf !== null && Math.abs(shelf.total - parsed) >= 0.01;

  const canCompare = reference !== null && referenceBought !== null;

  // The rate that survives a change of pack size: ₹212 for 4 kg and ₹212 for
  // 8 kg are the same rupees and a very different deal. Read off the total
  // amount, and quoted against whichever pack size the rate line is set to —
  // per kg, or per 500/250/100 g when that is the figure the shop is quoting.
  // Recomputed as the price is typed. Null for RS-priced items (their
  // "quantity" is already rupees) and before a price is entered.
  const currentUnitPrice =
    valid && parsed > 0 ? formatUnitPrice(parsed, bought.quantity, bought.unit, basis) : null;
  const referenceUnitPrice = canCompare
    ? formatUnitPrice(reference as number, referenceBought.quantity, referenceBought.unit, basis)
    : null;

  // Loose countable items read "₹40 each" whatever the basis, so there is
  // nothing to cycle through — the line stays plain text for those. Anything
  // with a size measures out in g or ml and does have a rate to re-quote.
  const rateUnit = currentUnitPrice ? bought.unit : (referenceBought?.unit ?? null);
  const rateHint =
    rateUnit !== null && rateBasisLabel(rateUnit, basis) !== null
      ? rateBasisHint(rateUnit, basis, nextBasis)
      : null;

  // Built once, so the wording is identical whether it ends up inside the
  // tappable button or the plain paragraph a loose countable item gets.
  const rateLine = (
    <>
      {currentUnitPrice ? (
        <>
          <span className="font-semibold tabular-nums text-ios-label">{currentUnitPrice}</span> at{" "}
          {formatQtyWithSize(quantity, unitType, size)}
        </>
      ) : null}
      {currentUnitPrice && referenceUnitPrice ? " · " : null}
      {referenceUnitPrice ? (
        <>
          <span className="tabular-nums">{referenceUnitPrice}</span> last time
        </>
      ) : null}
    </>
  );

  // For a packaged item the quantity counts packs, so "1" on its own reads
  // as nothing at all — say what it is a count of. Only once a size is
  // actually set, though: "3 packs" of an unsized item says no more than
  // "3" and reads as though something is missing.
  const packsLabel = (value: number, unit: UnitType) =>
    size ? `${formatQtyValue(value, unit)} ${value === 1 ? "pack" : "packs"}` : formatQty(value, unit);

  const save = () => {
    if (!valid) {
      setError("Enter the price you paid.");
      return;
    }
    startTransition(async () => {
      if (quantityChanged || sizeChanged || shopChanged) {
        const rowResult = await updateListItem({
          listItemId: item.id,
          quantity,
          unitType,
          ...(sizeable ? { sizeValue: size?.value ?? null, sizeUnit: size?.unit ?? null } : {}),
          ...(shopChanged ? { shopId } : {}),
          allowClosed,
        });
        if (!rowResult.ok) {
          setError(rowResult.error);
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

  // The size belongs in the title, not only in the field below: the price
  // typed here is the price *for that size*, and the title is what you
  // glance at while typing it. It follows the size actually bought, so
  // re-sizing at the shop re-titles the sheet.
  const sheetTitle = formatNameWithSize(name.primary, size);

  // The quantity row below carries the amount whenever it's editable, so the
  // subtitle only spells it out when that row is hidden.
  return (
    <Sheet
      open
      onClose={onClose}
      title={sheetTitle}
      subtitle={[
        name.secondary,
        editable ? null : `List wants ${formatQtyWithSize(item.quantity, item.unitType, listSize)}`,
        // The "Bought at" row below owns the shop while it is editable, and
        // it moves — repeating it up here would go stale the moment it is
        // changed. A closed list has no such row, so it keeps it.
        editable ? null : item.shopName,
      ]
        .filter(Boolean)
        .join(" · ")}
      footer={
        editable && item.isPurchased ? (
          <button
            type="button"
            onClick={undo}
            disabled={pending}
            className="h-11 w-full text-[16px] font-medium text-ios-red active:opacity-60"
          >
            Uncheck item
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4 pb-3">
        {/* Size and quantity on one row, each behind its own pill: two
            short facts about what went in the basket, and at the shelf you
            usually change neither. Size sits left of quantity because it is
            read that way — a 500 g packet, two of them. */}
        {editable ? (
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-ios-label-2">
                {sizeable ? "Size & quantity" : "Quantity bought"}
              </span>
              <div className="flex flex-none items-center gap-2">
                {sizeable && !editingSize ? (
                  <button
                    type="button"
                    onClick={() => setEditingSize(true)}
                    aria-label={
                      size
                        ? `Edit size, currently ${formatQty(size.value, size.unit)}`
                        : "Add the size one comes in"
                    }
                    className="flex h-8 flex-none items-center gap-1.5 rounded-full bg-ios-surface-2 px-3 text-[14px] font-medium text-ios-blue ring-1 ring-inset ring-ios-separator transition active:scale-95"
                  >
                    <span className="tabular-nums">
                      {size ? formatQty(size.value, size.unit) : "Add size"}
                    </span>
                    <PencilIcon />
                  </button>
                ) : null}
                {editingQuantity ? null : (
                  <button
                    type="button"
                    onClick={() => setEditingQuantity(true)}
                    aria-label={`Edit quantity, currently ${packsLabel(quantity, unitType)}`}
                    className="flex h-8 flex-none items-center gap-1.5 rounded-full bg-ios-surface-2 px-3 text-[14px] font-medium text-ios-blue ring-1 ring-inset ring-ios-separator transition active:scale-95"
                  >
                    <span className="tabular-nums">{packsLabel(quantity, unitType)}</span>
                    <PencilIcon />
                  </button>
                )}
              </div>
            </div>

            {/* Each editor opens under the row, so whichever pill you tapped
                is the only thing that grows. */}
            {editingSize ? (
              <div className="mt-1.5">
                <SizeField
                  value={sizeValue}
                  unit={sizeUnit}
                  onChange={(nextValue, nextUnit) => {
                    setSizeValue(nextValue);
                    setSizeUnit(nextUnit);
                  }}
                  aria-label={`Size bought for ${item.nameEn}`}
                />
                <span className="mt-1.5 block text-[12px] text-ios-label-3">
                  {sizeChanged && listSize
                    ? `List wants ${formatQty(listSize.value, listSize.unit)}. `
                    : ""}
                  {listSize
                    ? "Shop only had another size? Put it in here — the price you enter below is taken as the price for this size."
                    : "What one comes in — a 200 g paste, a 650 ml bottle. Fill it in and the price you enter below is taken as the price for this size."}
                </span>
              </div>
            ) : null}

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
                  {quantityChanged
                    ? `List wanted ${packsLabel(item.quantity, item.unitType)}. `
                    : ""}
                  {sizeable
                    ? "Took more than one? Adjust the count here — the price you enter below is taken as the price for all of them."
                    : "Bought a different amount? Adjust it here — the price you enter below is taken as the price for this quantity."}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Straight after the quantity, because that is the order the
            questions come in at the shelf: how much did you take, what did
            it cost, done. The button shares the field's row — typing a price
            and confirming it is one motion, not two. */}
        {editable ? (
          <div className="flex items-stretch gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-ios bg-ios-surface-2 px-3 ring-1 ring-inset ring-ios-separator focus-within:ring-2 focus-within:ring-ios-blue">
              <span className="flex-none text-[20px] font-semibold text-ios-label-2">₹</span>
              <input
                ref={priceRef}
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(event) => {
                  setPrice(event.target.value);
                  setPriceIsProduct(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") save();
                }}
                placeholder="0.00"
                aria-label="Price paid"
                className="h-12 w-full min-w-0 bg-transparent px-2 text-[20px] font-semibold tabular-nums outline-none"
              />
            </div>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="flex h-12 flex-none items-center justify-center rounded-ios bg-ios-blue px-4 text-[16px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
            >
              {pending ? "Saving…" : item.isPurchased ? "Update price" : "Mark as bought"}
            </button>
          </div>
        ) : null}

        {editable ? null : (
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
            {showShelfChip && shelf ? (
              <button
                type="button"
                onClick={() => {
                  setPrice(String(shelf.total));
                  setPriceIsProduct(true);
                  priceRef.current?.focus();
                }}
                aria-label={`Use ${formatPrice(shelf.total)} — ${formatPrice(parsed)}${
                  shelf.label === "each" ? " each" : shelf.label
                } for ${packsLabel(quantity, unitType)}`}
                className="h-9 rounded-full bg-ios-blue-soft px-3.5 text-[14px] font-medium text-ios-blue ring-1 ring-inset ring-ios-blue/20 active:scale-95"
              >
                <span className="tabular-nums">{formatPrice(parsed)}</span>
                {shelf.label === "each" ? " each" : shelf.label} ={" "}
                <span className="font-semibold tabular-nums">{formatPrice(shelf.total)}</span> for{" "}
                {packsLabel(quantity, unitType)}
              </button>
            ) : null}

            {/* Cheaper or dearer, once there is a price to judge. There was a
                "same as last time" button here to copy the old price in; it
                went unused, and what it filled in was a guess the rate line
                below states properly anyway. */}
            {reference === null ? (
              <p className="text-[13px] text-ios-label-2">
                First time buying this — the price becomes the baseline for next month.
              </p>
            ) : valid ? (
              <div className="flex flex-wrap items-center gap-2">
                <PriceDelta
                  current={parsed}
                  previous={reference}
                  currentQuantity={bought.quantity}
                  currentUnitType={bought.unit}
                  previousQuantity={referenceBought?.quantity}
                  previousUnitType={referenceBought?.unit}
                />
              </div>
            ) : null}

            {/* The rate: the same ₹ over a bigger or smaller pack is what a
                bare comparison can't tell you. Tapping it changes the pack
                size it is quoted against — per kg is the shelf label, but
                the shop quotes you 100 g. */}
            {currentUnitPrice || referenceUnitPrice ? (
              rateHint !== null ? (
                <button
                  type="button"
                  onClick={cycleBasis}
                  title={rateHint}
                  aria-label={rateHint}
                  className="-mx-1 flex items-center gap-1 rounded-lg px-1 py-0.5 text-left text-[13px] text-ios-label-2 transition active:opacity-60"
                >
                  <span>{rateLine}</span>
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-none text-ios-blue" aria-hidden>
                    <path
                      d="M4 9h13a3.5 3.5 0 0 1 0 7h-2m5-7l-3-3m3 3l-3 3M20 15H7a3.5 3.5 0 0 1 0-7h2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ) : (
                <p className="text-[13px] text-ios-label-2">{rateLine}</p>
              )
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
                      for{" "}
                      {formatQtyWithSize(
                        entry.quantity,
                        entry.unitType,
                        sizeOf(entry.sizeValue, entry.sizeUnit),
                      )}
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

        {/* Where it was actually bought. Last, because it is the one field
            you rarely touch: the row's shop is a copy of the master item's,
            taken when it was added, and is usually already right. When it
            is not — the master default changed after the list was made —
            nothing else could correct it once the list was finalized, and
            it decides which shop this price is recorded against. */}
        {editable ? (
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-ios-label-2">
                Bought at
                {shopChanged ? (
                  <span className="ml-1.5 font-normal text-ios-blue">
                    (list said {shopLabel(item.shopId)})
                  </span>
                ) : null}
              </span>
              {editingShop ? null : (
                <button
                  type="button"
                  onClick={() => setEditingShop(true)}
                  aria-label={`Change shop, currently ${shopLabel(shopId)}`}
                  className="flex h-8 flex-none items-center gap-1.5 rounded-full bg-ios-surface-2 px-3 text-[14px] font-medium text-ios-blue ring-1 ring-inset ring-ios-separator transition active:scale-95"
                >
                  <span className="max-w-[9rem] truncate">{shopLabel(shopId)}</span>
                  <PencilIcon />
                </button>
              )}
            </div>

            {editingShop ? (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {[...shops.map((shop) => ({ id: shop.id as number | null, name: shop.name })), { id: null, name: "Not set" }].map(
                  (shop) => (
                    <button
                      key={shop.id ?? "none"}
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
                  ),
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

/** The small "edit this" affordance on the quantity and shop pills. */
function PencilIcon() {
  return (
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
  );
}
