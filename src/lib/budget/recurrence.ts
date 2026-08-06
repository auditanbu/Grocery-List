/*
 * Recurrence maths for the Family Budget module.
 *
 * A BudgetExpense stores a *rule*, not a list of dates: an anchor date plus an
 * interval in months. Due dates are derived from it on demand, so the calendar
 * works arbitrarily far forward and back with no generator job and no horizon,
 * and editing a rule needs no reconciliation of already-generated rows.
 *
 * Deliberately carries no "server-only" directive: the create/edit sheet
 * previews the next few due dates client-side using the very same code the
 * server uses, so what the admin sees is what the calendar will show.
 */

import { daysInMonth, isDateKey } from "../dates";
import type { BudgetRecurrence } from "./types";

export type RecurrenceRule = {
  recurrence: BudgetRecurrence;
  /** Only meaningful when recurrence is CUSTOM_MONTHS. */
  intervalMonths: number | null;
  /** "YYYY-MM-DD" — the first due date, and the day-of-month anchor. */
  anchorDate: string;
  /** Inclusive last date the rule may produce, or null for indefinitely. */
  endDate: string | null;
};

/** A corrupt interval must not be able to hang a render. */
const MAX_OCCURRENCES = 600;

const FIXED_INTERVALS: Record<string, number> = {
  MONTHLY: 1,
  EVERY_2_MONTHS: 2,
  QUARTERLY: 3,
  HALF_YEARLY: 6,
  YEARLY: 12,
};

/** Months between occurrences, or null for a one-off (exactly one date). */
export function intervalMonthsOf(rule: RecurrenceRule): number | null {
  if (rule.recurrence === "ONE_OFF") return null;
  if (rule.recurrence === "CUSTOM_MONTHS") {
    const months = rule.intervalMonths;
    return months && months > 0 ? months : null;
  }
  return FIXED_INTERVALS[rule.recurrence] ?? null;
}

/**
 * Adds whole months, clamping to the last day of a short target month:
 * "2026-01-31" + 1 -> "2026-02-28", + 2 -> "2026-03-31".
 *
 * Callers must always compute occurrence k as addMonthsClamped(anchor, k * n)
 * — from the anchor, never by stepping off occurrence k-1. Stepping would let
 * a bill due on the 31st clamp to the 28th in February and then stay there.
 */
export function addMonthsClamped(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const total = (year * 12 + (month - 1)) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return `${String(targetYear).padStart(4, "0")}-${String(targetMonth).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

/** Every due date the rule produces within [fromKey, toKey], inclusive. */
export function occurrencesBetween(
  rule: RecurrenceRule,
  fromKey: string,
  toKey: string,
): string[] {
  if (!isDateKey(rule.anchorDate) || fromKey > toKey) return [];

  const interval = intervalMonthsOf(rule);
  if (interval === null) {
    return rule.anchorDate >= fromKey && rule.anchorDate <= toKey ? [rule.anchorDate] : [];
  }

  // The series' own end can cut the window short.
  const upper = rule.endDate && rule.endDate < toKey ? rule.endDate : toKey;
  if (upper < rule.anchorDate) return [];

  // Jump straight to the neighbourhood of `fromKey` rather than counting up
  // from the anchor, then step back one so clamping can't skip a date that
  // lands slightly earlier than the arithmetic suggests.
  const [anchorYear, anchorMonth] = rule.anchorDate.split("-").map(Number);
  const [fromYear, fromMonth] = fromKey.split("-").map(Number);
  const monthsFromAnchor = (fromYear * 12 + fromMonth) - (anchorYear * 12 + anchorMonth);
  let k = Math.max(0, Math.floor(monthsFromAnchor / interval) - 1);

  const dates: string[] = [];
  for (let guard = 0; guard < MAX_OCCURRENCES; guard += 1, k += 1) {
    const dueDate = addMonthsClamped(rule.anchorDate, k * interval);
    if (dueDate > upper) break;
    if (dueDate >= fromKey) dates.push(dueDate);
  }
  return dates;
}

/** The first due date on or after `fromKey`, or null if the series has ended. */
export function nextOccurrenceOnOrAfter(rule: RecurrenceRule, fromKey: string): string | null {
  const interval = intervalMonthsOf(rule);
  if (interval === null) {
    return rule.anchorDate >= fromKey ? rule.anchorDate : null;
  }
  // Two years is enough to catch any interval a household would use; beyond
  // that the series is effectively over as far as "next due" is concerned.
  const horizon = addMonthsClamped(fromKey, Math.max(24, interval * 2));
  return occurrencesBetween(rule, fromKey, horizon)[0] ?? null;
}

export function recurrenceLabel(rule: RecurrenceRule): string {
  switch (rule.recurrence) {
    case "ONE_OFF":
      return "One-off";
    case "MONTHLY":
      return "Monthly";
    case "EVERY_2_MONTHS":
      return "Every 2 months";
    case "QUARTERLY":
      return "Quarterly";
    case "HALF_YEARLY":
      return "Half-yearly";
    case "YEARLY":
      return "Yearly";
    case "CUSTOM_MONTHS": {
      const months = rule.intervalMonths ?? 0;
      return months === 1 ? "Monthly" : `Every ${months} months`;
    }
    default:
      return "Repeats";
  }
}

/** The presets offered by the create/edit sheet, in display order. */
export const RECURRENCE_OPTIONS: { value: BudgetRecurrence; label: string }[] = [
  { value: "ONE_OFF", label: "One-off" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "EVERY_2_MONTHS", label: "2 months" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "HALF_YEARLY", label: "Half-yearly" },
  { value: "YEARLY", label: "Yearly" },
  { value: "CUSTOM_MONTHS", label: "Custom" },
];
