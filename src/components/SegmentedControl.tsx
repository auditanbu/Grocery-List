"use client";

type Option<T extends string> = {
  value: T;
  label: string;
  badge?: number;
};

type SegmentedControlProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/** The iOS segmented control used to switch between List and Shopping modes. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={`flex rounded-[0.6rem] bg-ios-surface-2 p-1 ring-1 ring-inset ring-ios-separator ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-[0.45rem] px-3 py-2 text-[14px] font-medium transition ${
              selected
                ? "bg-ios-surface text-ios-label shadow-sm"
                : "text-ios-label-2 active:opacity-60"
            }`}
          >
            {option.label}
            {option.badge !== undefined ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                  selected ? "bg-ios-blue-soft text-ios-blue" : "bg-ios-separator text-ios-label-2"
                }`}
              >
                {option.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
