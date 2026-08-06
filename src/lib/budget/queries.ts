import "server-only";

import {
  addDaysToDateKey,
  monthKeyOfDateKey,
  todayDateKey,
} from "../dates";
import { prisma } from "../prisma";
import { nextOccurrenceOnOrAfter, occurrencesBetween, recurrenceLabel } from "./recurrence";
import type {
  BudgetCategoryDTO,
  BudgetOverviewDTO,
  ExpenseDTO,
  OccurrenceDTO,
  OccurrenceState,
} from "./types";

type DecimalLike = { toNumber(): number } | number | null | undefined;

function num(value: DecimalLike): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

function numOrNull(value: DecimalLike): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : value.toNumber();
}

/** First and last civil date of a "YYYY-MM" month. */
function monthBounds(monthKey: string): { first: string; last: string } {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { first: `${monthKey}-01`, last: `${monthKey}-${String(lastDay).padStart(2, "0")}` };
}

type ExpenseRow = {
  id: number;
  name: string;
  categoryId: number;
  amount: DecimalLike;
  recurrence: ExpenseDTO["recurrence"];
  intervalMonths: number | null;
  anchorDate: string;
  endDate: string | null;
  isActive: boolean;
  remindersEnabled: boolean;
  reminderLeadDays: number;
  notes: string | null;
  createdAt: Date;
  category: { name: string; iconKey: string; colorKey: string };
};

function stateOf(
  dueDate: string,
  today: string,
  status: "PAID" | "SKIPPED" | null,
): OccurrenceState {
  if (status === "PAID") return "PAID";
  if (status === "SKIPPED") return "SKIPPED";
  if (dueDate < today) return "OVERDUE";
  if (dueDate === today) return "DUE_TODAY";
  return "PLANNED";
}

/**
 * Expands every active rule across [fromKey, toKey] and merges in the sparse
 * stored rows.
 *
 * The result is the *union* of dates the rules generate and dates that already
 * have a row: a row whose date the rule no longer produces (because the rule
 * was edited afterwards) still surfaces, flagged `detached`, so a rule edit can
 * never silently erase payment history.
 */
async function expandWindow(
  fromKey: string,
  toKey: string,
  today: string,
  options: { includeInactive?: boolean } = {},
): Promise<OccurrenceDTO[]> {
  const expenses = (await prisma.budgetExpense.findMany({
    where: {
      ...(options.includeInactive ? {} : { isActive: true }),
      // Index-backed prefilter: a rule can't produce dates before its anchor.
      anchorDate: { lte: toKey },
    },
    include: { category: true },
    orderBy: { name: "asc" },
  })) as unknown as ExpenseRow[];

  if (expenses.length === 0) return [];

  const rows = await prisma.budgetOccurrence.findMany({
    where: {
      expenseId: { in: expenses.map((expense) => expense.id) },
      dueDate: { gte: fromKey, lte: toKey },
    },
  });

  const storedByKey = new Map(rows.map((row) => [`${row.expenseId}:${row.dueDate}`, row]));

  const out: OccurrenceDTO[] = [];
  for (const expense of expenses) {
    const rule = {
      recurrence: expense.recurrence,
      intervalMonths: expense.intervalMonths,
      anchorDate: expense.anchorDate,
      endDate: expense.endDate,
    };
    const label = recurrenceLabel(rule);
    const generated = occurrencesBetween(rule, fromKey, toKey);

    // Dates the rule produces, plus any stored row it no longer produces.
    const dates = new Set(generated);
    for (const row of rows) {
      if (row.expenseId === expense.id) dates.add(row.dueDate);
    }

    for (const dueDate of dates) {
      const stored = storedByKey.get(`${expense.id}:${dueDate}`);
      const plannedOverride = numOrNull(stored?.plannedAmount);
      out.push({
        key: `${expense.id}:${dueDate}`,
        expenseId: expense.id,
        occurrenceId: stored?.id ?? null,
        name: expense.name,
        categoryName: expense.category.name,
        iconKey: expense.category.iconKey,
        colorKey: expense.category.colorKey,
        dueDate,
        plannedAmount: plannedOverride ?? num(expense.amount),
        paidAmount: numOrNull(stored?.paidAmount),
        paidOn: stored?.paidOn ?? null,
        state: stateOf(dueDate, today, stored?.status ?? null),
        note: stored?.note ?? null,
        recurrenceLabel: label,
        detached: stored !== undefined && !generated.includes(dueDate),
      });
    }
  }

  return out.sort((a, b) => (a.dueDate === b.dueDate ? a.name.localeCompare(b.name) : a.dueDate < b.dueDate ? -1 : 1));
}

export async function getBudgetCategories(): Promise<BudgetCategoryDTO[]> {
  const rows = await prisma.budgetCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    iconKey: row.iconKey,
    colorKey: row.colorKey,
    sortOrder: row.sortOrder,
  }));
}

export async function getBudgetExpenses(): Promise<ExpenseDTO[]> {
  const today = todayDateKey();
  const rows = (await prisma.budgetExpense.findMany({
    include: { category: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  })) as unknown as ExpenseRow[];

  return rows.map((row) => {
    const rule = {
      recurrence: row.recurrence,
      intervalMonths: row.intervalMonths,
      anchorDate: row.anchorDate,
      endDate: row.endDate,
    };
    return {
      id: row.id,
      name: row.name,
      categoryId: row.categoryId,
      categoryName: row.category.name,
      iconKey: row.category.iconKey,
      colorKey: row.category.colorKey,
      amount: num(row.amount),
      recurrence: row.recurrence,
      intervalMonths: row.intervalMonths,
      anchorDate: row.anchorDate,
      endDate: row.endDate,
      isActive: row.isActive,
      remindersEnabled: row.remindersEnabled,
      reminderLeadDays: row.reminderLeadDays,
      notes: row.notes,
      recurrenceLabel: recurrenceLabel(rule),
      nextDueDate: row.isActive ? nextOccurrenceOnOrAfter(rule, today) : null,
      trackedFrom: row.createdAt.toISOString().slice(0, 10),
    };
  });
}

/** Everything `/budget` renders, in one round of parallel queries. */
export async function getBudgetOverview(monthKey: string): Promise<BudgetOverviewDTO> {
  const today = todayDateKey();
  const { first, last } = monthBounds(monthKey);

  // A year of lookback is loaded so the list can show history, but only the
  // last 60 days of it can raise an overdue alert — see the filter below.
  const alertFrom = addDaysToDateKey(today, -365);
  const overdueFrom = addDaysToDateKey(today, -60);
  const alertTo = addDaysToDateKey(today, 7);

  const [monthOccurrences, alertWindow, expenses, categories] = await Promise.all([
    expandWindow(first, last, today),
    expandWindow(alertFrom, alertTo, today),
    getBudgetExpenses(),
    getBudgetCategories(),
  ]);

  /*
   * An overdue alert should mean "you still owe this", not "this rule has a
   * back-history". Adding rent today with an anchor of last January would
   * otherwise report seven months of unpaid rent — so an occurrence only
   * raises an alert once it is both recent and dated on or after the day the
   * expense was actually set up. Older ones stay visible in the calendar and
   * list, where they read as history rather than as a demand.
   */
  const trackedFrom = new Map(
    expenses.map((expense) => [expense.id, expense.trackedFrom] as const),
  );
  const overdue = alertWindow.filter(
    (occurrence) =>
      occurrence.state === "OVERDUE" &&
      occurrence.dueDate >= overdueFrom &&
      occurrence.dueDate >= (trackedFrom.get(occurrence.expenseId) ?? "0000-00-00"),
  );
  const dueSoon = alertWindow.filter(
    (occurrence) =>
      (occurrence.state === "DUE_TODAY" || occurrence.state === "PLANNED") &&
      occurrence.dueDate <= alertTo,
  );

  const plannedTotal = monthOccurrences
    .filter((occurrence) => occurrence.state !== "SKIPPED")
    .reduce((sum, occurrence) => sum + occurrence.plannedAmount, 0);
  const paidTotal = monthOccurrences.reduce(
    (sum, occurrence) => sum + (occurrence.paidAmount ?? 0),
    0,
  );

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? null;

  return {
    monthKey,
    today,
    monthOccurrences,
    overdue,
    dueSoon,
    plannedTotal,
    paidTotal,
    expenses,
    categories,
    pushConfigured: Boolean(vapidPublicKey && process.env.VAPID_PRIVATE_KEY),
    vapidPublicKey,
  };
}

/**
 * Occurrences due on `dateKey`, used by the reminder sweep. Exported
 * separately so the sweep never has to build a whole overview.
 */
export async function getOccurrencesOn(dateKey: string): Promise<OccurrenceDTO[]> {
  return expandWindow(dateKey, dateKey, todayDateKey());
}

export { monthKeyOfDateKey };
