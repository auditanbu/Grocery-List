import { formatPrice, projectPrice, unitGroup, type UnitType } from "@/lib/units";

type PriceDeltaProps = {
  current: number;
  previous: number | null;
  /**
   * Quantity/unit each price was paid for. When both are given, `current`
   * is projected onto `previous`'s quantity/unit before comparing — e.g.
   * today's ₹ for 150 g becomes "what 200 g would have cost today" before
   * comparing against last time's ₹ for 200 g — so a variable-unit item
   * whose pack size changed still gets a fair delta instead of a raw,
   * misleading one. Omit either pair to fall back to a raw comparison.
   */
  currentQuantity?: number;
  currentUnitType?: UnitType;
  previousQuantity?: number;
  previousUnitType?: UnitType;
  /** `full` also prints the previous price next to the arrow. */
  variant?: "badge" | "full";
};

/**
 * Green down-arrow when today's price beats last month's, red up-arrow when
 * it is dearer, grey dash when unchanged. Renders nothing without a
 * previous price to compare against.
 */
export function PriceDelta({
  current,
  previous,
  currentQuantity,
  currentUnitType,
  previousQuantity,
  previousUnitType,
  variant = "badge",
}: PriceDeltaProps) {
  if (previous === null || previous === undefined || previous <= 0) {
    return variant === "full" ? (
      <span className="text-[12px] text-ios-label-3">No earlier price</span>
    ) : null;
  }

  let comparable = current;
  if (
    currentQuantity !== undefined &&
    currentUnitType !== undefined &&
    previousQuantity !== undefined &&
    previousUnitType !== undefined
  ) {
    if (unitGroup(currentUnitType) !== unitGroup(previousUnitType)) {
      return variant === "full" ? (
        <span className="text-[12px] text-ios-label-3">Different pack size — no comparison</span>
      ) : null;
    }
    const projected = projectPrice(
      current,
      currentQuantity,
      currentUnitType,
      previousQuantity,
      previousUnitType,
    );
    if (projected !== null) comparable = projected;
  }

  const diff = comparable - previous;
  const percent = Math.abs((diff / previous) * 100);
  const rounded = Math.round(Math.abs(diff) * 100) / 100;

  if (rounded < 0.01) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ios-surface-2 px-2 py-0.5 text-[12px] font-medium text-ios-label-2">
        <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden>
          <path d="M6 12h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        Same as last time
      </span>
    );
  }

  const cheaper = diff < 0;
  const tone = cheaper ? "bg-green-50 text-ios-green" : "bg-red-50 text-ios-red";
  const label = cheaper ? "cheaper" : "dearer";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums ${tone}`}
      title={`Last time ${formatPrice(previous)}`}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
        {cheaper ? (
          <path
            d="M12 5v14m0 0l-5.5-5.5M12 19l5.5-5.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : (
          <path
            d="M12 19V5m0 0L6.5 10.5M12 5l5.5 5.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
      </svg>
      ₹{rounded.toFixed(2)}
      <span className="font-medium opacity-80">({percent.toFixed(0)}%)</span>
      {variant === "full" ? (
        <span className="font-medium opacity-80">
          {label} than {formatPrice(previous)}
        </span>
      ) : null}
    </span>
  );
}
