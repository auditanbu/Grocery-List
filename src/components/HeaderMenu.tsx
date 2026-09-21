"use client";

import { Sheet } from "@/components/Sheet";

export type HeaderMenuItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  /** Current value shown on the right, e.g. the selected shop. */
  detail?: string;
  /** Renders the row in the accent colour — a filter that is currently on. */
  active?: boolean;
  /** Destructive-ish or status-changing actions read in orange. */
  tone?: "default" | "warn";
  disabled?: boolean;
  onSelect: () => void;
};

type HeaderMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  items: HeaderMenuItem[];
  /** Read-once detail (status, dates) shown above the actions. */
  info?: React.ReactNode;
  /** Shown as a dot on the burger when any filter is applied. */
  showDot?: boolean;
};

/**
 * The header's controls behind one button.
 *
 * Opens the app's bottom `Sheet` rather than an anchored dropdown: there is no
 * popover primitive here, the sheet is the established pattern for every other
 * picker, and it is a far better thumb target than a menu pinned to the top
 * corner of a tall phone. Selecting an item always closes the menu, so a row
 * that opens a second sheet (a filter) reads as one continuous gesture.
 */
export function HeaderMenu({
  open,
  onOpenChange,
  title = "Menu",
  items,
  info,
}: HeaderMenuProps) {
  return (
    <Sheet open={open} onClose={() => onOpenChange(false)} title={title}>
      {info ? (
        <div className="mb-2 rounded-ios bg-ios-surface-2 px-4 py-3 ring-1 ring-inset ring-ios-separator">
          {info}
        </div>
      ) : null}
      <ul className="divide-y divide-ios-separator pb-2">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              disabled={item.disabled}
              onClick={() => {
                onOpenChange(false);
                item.onSelect();
              }}
              className="ios-row w-full text-left transition active:bg-ios-surface-2 disabled:opacity-40"
            >
              <span
                className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${
                  item.active
                    ? "bg-ios-blue text-white"
                    : item.tone === "warn"
                      ? "bg-ios-surface-2 text-ios-orange"
                      : "bg-ios-surface-2 text-ios-blue"
                }`}
              >
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-medium">{item.label}</span>
                {item.detail ? (
                  <span className="block truncate text-[13px] text-ios-label-2">{item.detail}</span>
                ) : null}
              </span>
              <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none text-ios-label-3" aria-hidden>
                <path
                  d="M9 5l7 7-7 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

type BurgerButtonProps = {
  onClick: () => void;
  /** A filter is applied somewhere inside — surfaced so it isn't hidden. */
  marked?: boolean;
  label?: string;
};

/** The button that opens the menu. Marked with a dot when a filter is on
 *  inside, so an applied filter is never invisible behind a closed menu. */
export function BurgerButton({ onClick, marked, label = "Menu" }: BurgerButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ios-surface text-ios-blue shadow-ios transition active:scale-95"
    >
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
        <path
          d="M4 7h16M4 12h16M4 17h16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
      {marked ? (
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-ios-blue ring-2 ring-ios-bg" />
      ) : null}
    </button>
  );
}
