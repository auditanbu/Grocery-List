import { formatPrice } from "@/lib/units";

type PriceDeltaProps = {
  current: number;
  previous: number | null;
  /** `full` also prints the previous price next to the arrow. */
  variant?: "badge" | "full";
};

/**
 * Green down-arrow when today's price beats last month's, red up-arrow when
 * it is dearer, grey dash when unchanged. Renders nothing without a
 * previous price to compare against.
 */
export function PriceDelta({ current, previous, variant = "badge" }: PriceDeltaProps) {
  if (previous === null || previous === undefined || previous <= 0) {
    return variant === "full" ? (
      <span className="text-[12px] text-ios-label-3">No earlier price</span>
    ) : null;
  }

  const diff = current - previous;
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
  const tone = cheaper ? "bg-ios-green-soft text-ios-green" : "bg-ios-red-soft text-ios-red";
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
