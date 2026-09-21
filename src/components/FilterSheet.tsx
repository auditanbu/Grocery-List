"use client";

import { Sheet } from "@/components/Sheet";

export type FilterOption<T> = {
  /** Stable React key — values can be null or undefined, which keys can't be. */
  key: string;
  label: string;
  value: T;
  count?: number;
};

/**
 * Object.is, not ===, so `undefined` ("all") and `null` ("Not set") can both be
 * real values in the same menu.
 */
export function selectedOption<T>(options: FilterOption<T>[], value: T) {
  return options.find((option) => Object.is(option.value, value));
}

type FilterSheetProps<T> = {
  open: boolean;
  onClose: () => void;
  label: string;
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** The options list on its own, so a header menu can open it without a button. */
export function FilterSheet<T>({
  open,
  onClose,
  label,
  options,
  value,
  onChange,
}: FilterSheetProps<T>) {
  return (
    <Sheet open={open} onClose={onClose} title={label}>
      <ul className="divide-y divide-ios-separator pb-2">
        {options.map((option) => {
          const isSelected = Object.is(option.value, value);
          return (
            <li key={option.key}>
              <button
                type="button"
                onClick={() => {
                  onChange(option.value);
                  onClose();
                }}
                className="ios-row w-full text-left active:bg-ios-surface-2"
              >
                <span
                  className={`min-w-0 flex-1 truncate text-[16px] ${
                    isSelected ? "font-semibold text-ios-blue" : ""
                  }`}
                >
                  {option.label}
                </span>
                {option.count !== undefined ? (
                  <span className="flex-none text-[14px] tabular-nums text-ios-label-3">
                    {option.count}
                  </span>
                ) : null}
                <span className="flex h-5 w-5 flex-none items-center justify-center text-ios-blue">
                  {isSelected ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                      <path
                        d="M5 13l4.5 4.5L19 7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

/* Header glyphs, drawn to match AppNav's 24-box, strokeWidth 1.7 outline set. */

export function ShopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
      <path
        d="M4 9h16l-1 10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1L4 9zM4 9l1.4-4.3A1 1 0 0 1 6.4 4h11.2a1 1 0 0 1 1 .7L20 9M9.5 13h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CategoryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
      <path
        d="M4 5h6v6H4V5zm10 0h6v6h-6V5zM4 13h6v6H4v-6zm10 0h6v6h-6v-6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
      <path
        d="M3 4h2.2l2.3 10.3a1.5 1.5 0 0 0 1.5 1.2h7.7a1.5 1.5 0 0 0 1.5-1.2L20 7H6M10 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Counter-clockwise arrow — "put this list back to a draft". */
export function ReopenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
      <path
        d="M4 5v5h5M4.6 13a7.5 7.5 0 1 0 1.2-5.2L4 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Pencil — unlocks a closed list for editing. Deliberately nothing like
 *  ReopenIcon: one rewinds the list's status, the other only unlocks a view. */
export function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
      <path
        d="M4 20l.9-4.2L15.6 5.1a1.6 1.6 0 0 1 2.3 0l1 1a1.6 1.6 0 0 1 0 2.3L8.2 19.1 4 20zM14.8 6l3.2 3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
      <path
        d="M5 13l4.5 4.5L19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FunnelIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
      <path
        d="M4 5h16l-6.2 7.3v5.4L10.2 20v-7.7L4 5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
