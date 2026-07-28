"use client";

import { useEffect } from "react";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/**
 * iOS sheet: slides up from the bottom on iPhone, centres as a card on
 * iPad and desktop. Closes on backdrop tap or Escape.
 */
export function Sheet({ open, onClose, title, subtitle, children, footer }: SheetProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Dismiss"
        tabIndex={-1}
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-black/25 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet-in relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-ios-surface shadow-ios-lg sm:max-w-lg sm:rounded-[1.75rem]"
      >
        <div className="flex-none px-5 pb-3 pt-3">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ios-separator sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[19px] font-semibold tracking-tight">{title}</h2>
              {subtitle ? <p className="text-[13px] text-ios-label-2">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-ios-surface-2 text-ios-label-2 transition active:scale-95"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-2">{children}</div>

        {footer ? (
          <div
            className="flex-none border-t border-ios-separator bg-ios-surface px-5 pt-3"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
