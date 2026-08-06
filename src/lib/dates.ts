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

/*
 * Civil-date helpers, "YYYY-MM-DD" ("date keys").
 *
 * The Family Budget module treats due dates as calendar dates, not instants —
 * "rent is due on the 5th" means the 5th everywhere, regardless of server
 * timezone. Keeping them as strings (matching the existing monthKey
 * convention) means lexicographic comparison sorts and ranges correctly, and
 * nothing ever round-trips through a Date whose timezone could shift it a day.
 *
 * Every helper below builds on Date.UTC / toISOString and never on
 * new Date(y, m, d) or .getMonth(), which read the process timezone.
 */

/** India observes no DST, so a fixed offset is exact — and needs no date library. */
const IST_OFFSET_MINUTES = 330;

/** Today's civil date in India as "YYYY-MM-DD", correct on a UTC server. */
export function todayDateKey(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

/**
 * True only for a real calendar date — "2026-02-30" and "2027-02-29" are
 * rejected, which is what stops a bogus anchor generating garbage forever.
 */
export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
}

/** `month` is 1-based. Day 0 of the next month is the last day of this one. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Weekday of the 1st of the month, 0 = Sunday. */
export function firstWeekdayOfMonth(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

/** "2026-08-14" -> "2026-08". */
export function monthKeyOfDateKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

/** "2026-08" + day 14 -> "2026-08-14". */
export function dateKeyOf(monthKey: string, day: number): string {
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b`; negative when `b` is earlier. */
export function daysBetweenDateKeys(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** "2026-08-14" -> "14 Aug 2026". */
export function dateKeyToLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return dateKey;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** "2026-08-14" -> "14 Aug", for tight rows where the year is implied. */
export function dateKeyToShortLabel(dateKey: string): string {
  const [, month, day] = dateKey.split("-").map(Number);
  if (!month || month < 1 || month > 12) return dateKey;
  return `${day} ${MONTHS[month - 1]}`;
}
