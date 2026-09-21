import { formatQty, type PackSize } from "@/lib/units";

/**
 * The pack size as a chip beside an item's name — "3 ரோசஸ் டீ தூள்" is a row
 * of tins until it says which tin, and the size is what you match against
 * the shelf.
 *
 * A chip rather than part of the name string so it survives a long name:
 * the name truncates, the size does not. It belongs to the row, not to any
 * one language's name, so a screen showing both names carries one pill.
 */
export function SizePill({ size, dimmed }: { size: PackSize | null; dimmed?: boolean }) {
  if (!size) return null;
  return (
    <span
      className={`flex-none rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ring-inset ring-ios-separator ${
        dimmed ? "text-ios-label-3" : "bg-ios-surface-2 text-ios-label-2"
      }`}
    >
      {formatQty(size.value, size.unit)}
    </span>
  );
}
