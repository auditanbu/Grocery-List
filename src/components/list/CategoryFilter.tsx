"use client";

type CategoryOption = {
  id: number;
  name: string;
  count: number;
};

type CategoryFilterProps = {
  options: CategoryOption[];
  /** `undefined` means "All categories". */
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  total: number;
};

/** Horizontally scrolling chips used to narrow the shopping list to one category. */
export function CategoryFilter({ options, value, onChange, total }: CategoryFilterProps) {
  const chip = (active: boolean) =>
    `h-9 flex-none rounded-full px-4 text-[14px] font-medium transition active:scale-95 ${
      active
        ? "bg-ios-blue text-white"
        : "bg-ios-surface text-ios-label-2 ring-1 ring-inset ring-ios-separator"
    }`;

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1">
      <div className="flex w-max gap-2">
        <button type="button" onClick={() => onChange(undefined)} className={chip(value === undefined)}>
          All categories
          <span className="ml-1.5 tabular-nums opacity-70">{total}</span>
        </button>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={chip(value === option.id)}
          >
            {option.name}
            <span className="ml-1.5 tabular-nums opacity-70">{option.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
