"use client";

type ShopOption = {
  id: number | null;
  name: string;
  count: number;
};

type ShopFilterProps = {
  options: ShopOption[];
  /** `undefined` means "All shops". */
  value: number | null | undefined;
  onChange: (value: number | null | undefined) => void;
  total: number;
};

/** Horizontally scrolling chips used to narrow a finalized list to one shop. */
export function ShopFilter({ options, value, onChange, total }: ShopFilterProps) {
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
          All shops
          <span className="ml-1.5 tabular-nums opacity-70">{total}</span>
        </button>
        {options.map((option) => (
          <button
            key={option.id ?? "none"}
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
