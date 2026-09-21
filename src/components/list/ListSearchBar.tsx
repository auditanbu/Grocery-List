"use client";

type ListSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

/**
 * Search pinned to the bottom of the screen, where a thumb reaches it.
 *
 * It sits directly on top of AppNav's tab bar via --tab-bar-height, which
 * collapses to zero at md+ where that bar becomes a sidebar. z-20 keeps it
 * under the nav (z-30) and well under any Sheet (z-50), so an open sheet
 * covers it rather than competing with it.
 */
export function ListSearchBar({ value, onChange, placeholder = "Search this list" }: ListSearchBarProps) {
  return (
    <div
      className="fixed inset-x-0 z-20 border-t border-ios-separator bg-ios-bg/90 px-4 pt-2 backdrop-blur-xl md:left-64"
      style={{
        bottom: "var(--tab-bar-height)",
        paddingBottom: "calc(0.5rem + var(--bottom-bar-safe))",
      }}
    >
      {/* Matches <main>'s column so the field lines up with the content. */}
      <div className="relative mx-auto w-full max-w-3xl">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ios-label-3"
          aria-hidden
        >
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.1" />
          <path d="M20 20l-4.3-4.3" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        </svg>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-11 w-full rounded-ios bg-ios-surface pl-10 pr-10 text-[17px] shadow-ios outline-none focus:ring-2 focus:ring-ios-blue"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ios-label-3 active:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}
