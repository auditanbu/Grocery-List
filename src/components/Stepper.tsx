"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  UNIT_LABEL,
  decrement,
  formatQtyValue,
  increment,
  minFor,
  normalizeQty,
  stepFor,
  type UnitType,
} from "@/lib/units";

type StepperProps = {
  value: number;
  unit: UnitType;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Compact fits inside a list row; regular is used inside sheets. */
  size?: "compact" | "regular";
  "aria-label"?: string;
};

const HOLD_DELAY_MS = 450;
const HOLD_INTERVAL_MS = 110;
const HOLD_FAST_AFTER_TICKS = 8;
const HOLD_FAST_INTERVAL_MS = 45;

/**
 * iOS-style +/- stepper whose increment follows the item's unit:
 *
 *   g, ml  -> 50   (50 → 100 → 150)
 *   kg, L  -> 0.5  (0.5 → 1 → 1.5)
 *   Rs     -> 10   (₹10 → ₹20)
 *   blank  -> 1    (1 → 2 → 3)
 *
 * Press and hold either button to repeat, and tap the value to type an
 * exact amount (which snaps back onto the unit's step grid on blur).
 */
export function Stepper({
  value,
  unit,
  onChange,
  disabled = false,
  size = "regular",
  "aria-label": ariaLabel,
}: StepperProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const timers = useRef<{ timeout?: ReturnType<typeof setTimeout>; interval?: ReturnType<typeof setInterval> }>({});
  const latest = useRef(value);
  latest.current = value;

  const stopHold = useCallback(() => {
    if (timers.current.timeout) clearTimeout(timers.current.timeout);
    if (timers.current.interval) clearInterval(timers.current.interval);
    timers.current = {};
  }, []);

  useEffect(() => stopHold, [stopHold]);

  const apply = useCallback(
    (direction: 1 | -1) => {
      const next =
        direction === 1
          ? increment(latest.current, unit)
          : decrement(latest.current, unit);
      if (next !== latest.current) {
        latest.current = next;
        onChange(next);
      }
    },
    [onChange, unit],
  );

  const startHold = useCallback(
    (direction: 1 | -1) => {
      if (disabled) return;
      apply(direction);
      stopHold();

      timers.current.timeout = setTimeout(() => {
        let ticks = 0;
        const run = (delay: number) => {
          timers.current.interval = setInterval(() => {
            ticks += 1;
            apply(direction);
            if (ticks === HOLD_FAST_AFTER_TICKS && delay !== HOLD_FAST_INTERVAL_MS) {
              if (timers.current.interval) clearInterval(timers.current.interval);
              run(HOLD_FAST_INTERVAL_MS);
            }
          }, delay);
        };
        run(HOLD_INTERVAL_MS);
      }, HOLD_DELAY_MS);
    },
    [apply, disabled, stopHold],
  );

  const commitDraft = () => {
    const parsed = Number.parseFloat(draft.replace(",", "."));
    setEditing(false);
    if (Number.isFinite(parsed)) {
      const next = normalizeQty(parsed, unit);
      if (next !== value) onChange(next);
    }
  };

  const atMinimum = value <= minFor(unit);
  const compact = size === "compact";
  const buttonSize = compact ? "h-10 w-10" : "h-12 w-12";
  const valueWidth = compact ? "min-w-[4.25rem]" : "min-w-[5.5rem]";
  const unitLabel = UNIT_LABEL[unit];

  return (
    <div
      className={`inline-flex select-none items-center rounded-full bg-ios-surface-2 p-1 ring-1 ring-inset ring-ios-separator ${
        disabled ? "opacity-50" : ""
      }`}
      role="group"
      aria-label={ariaLabel ?? `Quantity, steps of ${stepFor(unit)} ${unitLabel || "units"}`}
    >
      <button
        type="button"
        aria-label={`Decrease by ${stepFor(unit)}`}
        disabled={disabled || atMinimum}
        onPointerDown={() => startHold(-1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onContextMenu={(event) => event.preventDefault()}
        className={`${buttonSize} flex items-center justify-center rounded-full bg-ios-surface text-ios-blue shadow-sm transition active:scale-95 disabled:text-ios-label-3 disabled:shadow-none`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path d="M6 12h12" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
        </svg>
      </button>

      {editing ? (
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitDraft();
            if (event.key === "Escape") setEditing(false);
          }}
          className={`${valueWidth} bg-transparent text-center text-[17px] font-semibold tabular-nums outline-none`}
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setDraft(formatQtyValue(value, unit));
            setEditing(true);
          }}
          className={`${valueWidth} text-center text-[17px] font-semibold tabular-nums`}
        >
          {unit === "RS" ? "₹" : ""}
          {formatQtyValue(value, unit)}
          {unitLabel && unit !== "RS" ? (
            <span className="ml-1 text-[13px] font-medium text-ios-label-2">{unitLabel}</span>
          ) : null}
        </button>
      )}

      <button
        type="button"
        aria-label={`Increase by ${stepFor(unit)}`}
        disabled={disabled}
        onPointerDown={() => startHold(1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onContextMenu={(event) => event.preventDefault()}
        className={`${buttonSize} flex items-center justify-center rounded-full bg-ios-surface text-ios-blue shadow-sm transition active:scale-95 disabled:text-ios-label-3 disabled:shadow-none`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path
            d="M12 6v12M6 12h12"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
