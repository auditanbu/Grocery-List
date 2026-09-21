"use client";

import { useEffect, useState } from "react";

import { SIZE_UNITS, UNIT_LABEL, formatQtyValue, roundSize, type UnitType } from "@/lib/units";

type SizeFieldProps = {
  /** Null when the item has no size — it is sold loose. */
  value: number | null;
  unit: UnitType | null;
  /** Fires with both fields at once; (null, null) means "no size". */
  onChange: (value: number | null, unit: UnitType | null) => void;
  /** Offers a "None" chip that clears the size. */
  clearable?: boolean;
  "aria-label"?: string;
};

/** The unit a size defaults to when one is typed before a unit is picked. */
const DEFAULT_SIZE_UNIT: UnitType = "G";

/**
 * Types a pack size — "200 g", "500 ml", "1.5 L".
 *
 * Deliberately a plain number box rather than the `Stepper` the quantity
 * uses: sizes are whatever the packet says, and the stepper's grid would
 * round a 75 g soap up to 100 g the moment it was typed.
 */
export function SizeField({
  value,
  unit,
  onChange,
  clearable = false,
  "aria-label": ariaLabel,
}: SizeFieldProps) {
  const [draft, setDraft] = useState(() => (value === null ? "" : formatQtyValue(value, unit ?? DEFAULT_SIZE_UNIT)));

  // Follows the value when it changes from outside (a different item opened
  // in the sheet, or the "None" chip clearing it).
  useEffect(() => {
    setDraft(value === null ? "" : formatQtyValue(value, unit ?? DEFAULT_SIZE_UNIT));
  }, [value, unit]);

  const commit = (text: string) => {
    const parsed = Number.parseFloat(text.replace(",", "."));
    // An emptied box is "no size yet", not "no unit" — the unit chip stays
    // picked so typing the number again doesn't need it chosen twice.
    if (!Number.isFinite(parsed) || parsed <= 0) {
      onChange(null, unit);
      return;
    }
    onChange(roundSize(parsed), unit ?? DEFAULT_SIZE_UNIT);
  };

  const chip = (active: boolean) =>
    `h-10 rounded-full px-4 text-[15px] font-medium transition active:scale-95 ${
      active
        ? "bg-ios-blue text-white"
        : "bg-ios-surface-2 text-ios-label-2 ring-1 ring-inset ring-ios-separator"
    }`;

  return (
    <div className="space-y-2">
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          commit(event.target.value);
        }}
        placeholder="200"
        aria-label={ariaLabel ?? "Size"}
        className="h-12 w-full rounded-ios bg-ios-surface-2 px-4 text-[17px] tabular-nums outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
      />
      <div className="flex flex-wrap gap-2">
        {clearable ? (
          <button
            type="button"
            onClick={() => onChange(null, null)}
            className={chip(value === null && unit === null)}
          >
            None
          </button>
        ) : null}
        {SIZE_UNITS.map((sizeUnit) => (
          <button
            key={sizeUnit}
            type="button"
            onClick={() => onChange(value, sizeUnit)}
            className={chip(unit === sizeUnit)}
          >
            {UNIT_LABEL[sizeUnit]}
          </button>
        ))}
      </div>
    </div>
  );
}
