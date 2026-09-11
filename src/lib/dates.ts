const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Sortable key used as GroceryList.monthKey, e.g. "2026-07". */
export function monthKeyOf(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Suggested list name in `MMM YYYY` form, e.g. "Jul 2026". */
export function listNameFor(date: Date = new Date()): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** "2026-07" -> "Jul 2026". Falls back to the input if it isn't a month key. */
export function monthKeyToLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return monthKey;
  return `${MONTHS[month - 1]} ${year}`;
}

/** The month key n months before the given date. */
export function shiftMonthKey(monthKey: string, months: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  return monthKeyOf(new Date(year, month - 1 + months, 1));
}

export function formatDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
