"use server";

import { revalidatePath } from "next/cache";

import { isAdminSession } from "../admin";
import { isDateKey, todayDateKey } from "../dates";
import { prisma } from "../prisma";
import { occurrencesBetween } from "./recurrence";
import type { BudgetOccurrenceStatus, BudgetRecurrence } from "./types";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function revalidate(): void {
  revalidatePath("/budget");
  revalidatePath("/budget/expenses");
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

type ExpenseInput = {
  name: string;
  categoryId: number;
  amount: number;
  recurrence: BudgetRecurrence;
  /** Required when recurrence is CUSTOM_MONTHS, ignored otherwise. */
  intervalMonths?: number | null;
  anchorDate: string;
  endDate?: string | null;
  remindersEnabled?: boolean;
  reminderLeadDays?: number;
  notes?: string | null;
};

type NormalizedExpense = {
  name: string;
  categoryId: number;
  amount: number;
  recurrence: BudgetRecurrence;
  intervalMonths: number | null;
  anchorDate: string;
  endDate: string | null;
  remindersEnabled: boolean;
  reminderLeadDays: number;
  notes: string | null;
};

/** Every validation rule in one place, shared by create and update. */
function normalizeExpense(input: ExpenseInput): NormalizedExpense | { error: string } {
  const name = input.name.trim();
  if (!name) return { error: "Enter a name." };
  if (name.length > 191) return { error: "That name is too long." };

  if (!Number.isInteger(input.categoryId)) return { error: "Choose a category." };
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { error: "Enter a valid amount." };

  if (!isDateKey(input.anchorDate)) return { error: "Enter a valid start date." };

  const endDate = input.endDate || null;
  if (endDate !== null) {
    if (!isDateKey(endDate)) return { error: "Enter a valid end date." };
    if (endDate < input.anchorDate) return { error: "The end date can't be before the start date." };
  }

  // Keep exactly one source of truth: a stale intervalMonths left over from a
  // spell as CUSTOM_MONTHS must not survive a switch back to a preset.
  let intervalMonths: number | null = null;
  if (input.recurrence === "CUSTOM_MONTHS") {
    const months = input.intervalMonths;
    if (!Number.isInteger(months) || (months as number) < 1 || (months as number) > 60) {
      return { error: "Repeat every 1 to 60 months." };
    }
    intervalMonths = months as number;
  }

  const reminderLeadDays = input.reminderLeadDays ?? 2;
  if (!Number.isInteger(reminderLeadDays) || reminderLeadDays < 0 || reminderLeadDays > 30) {
    return { error: "Remind between 0 and 30 days ahead." };
  }

  return {
    name,
    categoryId: input.categoryId,
    amount: round2(input.amount),
    recurrence: input.recurrence,
    intervalMonths,
    anchorDate: input.anchorDate,
    endDate,
    remindersEnabled: input.remindersEnabled ?? true,
    reminderLeadDays,
    notes: input.notes?.trim() || null,
  };
}

/** Admin only — household bills are shared financial records. */
export async function createExpense(input: ExpenseInput): Promise<ActionResult<{ id: number }>> {
  if (!(await isAdminSession())) return fail("Admin only.");

  const normalized = normalizeExpense(input);
  if ("error" in normalized) return fail(normalized.error);

  const expense = await prisma.budgetExpense.create({ data: normalized });
  revalidate();
  return { ok: true, data: { id: expense.id } };
}

/**
 * Admin only. Editing the rule needs no reconciliation — due dates are derived
 * from it, and any stored row the new rule no longer produces stays visible as
 * a detached occurrence rather than being deleted.
 */
export async function updateExpense(id: number, input: ExpenseInput): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");

  const normalized = normalizeExpense(input);
  if ("error" in normalized) return fail(normalized.error);

  await prisma.budgetExpense.update({ where: { id }, data: normalized });
  revalidate();
  return { ok: true };
}

/** Admin only — cascades every occurrence and reminder, so payment history goes too. */
export async function deleteExpense(id: number): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");
  await prisma.budgetExpense.delete({ where: { id } });
  revalidate();
  return { ok: true };
}

/** Admin only — the non-destructive way to retire a bill, keeping its history. */
export async function setExpenseActive(id: number, isActive: boolean): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");
  await prisma.budgetExpense.update({ where: { id }, data: { isActive } });
  revalidate();
  return { ok: true };
}

/** Admin only — per-expense reminder switch. */
export async function setExpenseReminders(
  id: number,
  remindersEnabled: boolean,
): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");
  await prisma.budgetExpense.update({ where: { id }, data: { remindersEnabled } });
  revalidate();
  return { ok: true };
}

/**
 * A date is writable if the rule actually produces it, or if a row already
 * exists there. Without this check a crafted call could scatter payment rows
 * across dates the expense was never due on.
 */
async function assertRealOccurrence(expenseId: number, dueDate: string): Promise<string | null> {
  if (!isDateKey(dueDate)) return "Invalid date.";

  const expense = await prisma.budgetExpense.findUnique({ where: { id: expenseId } });
  if (!expense) return "That expense no longer exists.";

  const generated = occurrencesBetween(
    {
      recurrence: expense.recurrence,
      intervalMonths: expense.intervalMonths,
      anchorDate: expense.anchorDate,
      endDate: expense.endDate,
    },
    dueDate,
    dueDate,
  );
  if (generated.length > 0) return null;

  const existing = await prisma.budgetOccurrence.findUnique({
    where: { expenseId_dueDate: { expenseId, dueDate } },
  });
  return existing ? null : "That expense isn't due on that date.";
}

type MarkPaidInput = {
  expenseId: number;
  dueDate: string;
  paidAmount: number;
  /** Defaults to today in India. */
  paidOn?: string | null;
  note?: string | null;
};

/** Admin only — recording a payment is what turns a plan into household history. */
export async function markOccurrencePaid(input: MarkPaidInput): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");

  // Zero is legitimate — a waived or fully-discounted bill.
  if (!Number.isFinite(input.paidAmount) || input.paidAmount < 0) {
    return fail("Enter a valid amount.");
  }

  const problem = await assertRealOccurrence(input.expenseId, input.dueDate);
  if (problem) return fail(problem);

  const paidOn = input.paidOn || todayDateKey();
  if (!isDateKey(paidOn)) return fail("Enter a valid payment date.");

  const data = {
    status: "PAID" as BudgetOccurrenceStatus,
    paidAmount: round2(input.paidAmount),
    paidOn,
    note: input.note?.trim() || null,
  };

  await prisma.budgetOccurrence.upsert({
    where: { expenseId_dueDate: { expenseId: input.expenseId, dueDate: input.dueDate } },
    create: { expenseId: input.expenseId, dueDate: input.dueDate, ...data },
    update: data,
  });

  revalidate();
  return { ok: true };
}

/** Admin only. Drops the row entirely when nothing else was stored on it. */
export async function unmarkOccurrencePaid(
  expenseId: number,
  dueDate: string,
): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");

  const existing = await prisma.budgetOccurrence.findUnique({
    where: { expenseId_dueDate: { expenseId, dueDate } },
  });
  if (!existing) return { ok: true };

  if (existing.plannedAmount === null && existing.note === null) {
    await prisma.budgetOccurrence.delete({ where: { id: existing.id } });
  } else {
    await prisma.budgetOccurrence.update({
      where: { id: existing.id },
      data: { status: null, paidAmount: null, paidOn: null },
    });
  }

  revalidate();
  return { ok: true };
}

/** Admin only — skip a month without paying it (e.g. a bill that didn't arrive). */
export async function setOccurrenceSkipped(
  expenseId: number,
  dueDate: string,
  skipped: boolean,
): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");

  const problem = await assertRealOccurrence(expenseId, dueDate);
  if (problem) return fail(problem);

  const status = skipped ? ("SKIPPED" as BudgetOccurrenceStatus) : null;
  await prisma.budgetOccurrence.upsert({
    where: { expenseId_dueDate: { expenseId, dueDate } },
    create: { expenseId, dueDate, status },
    update: { status, paidAmount: null, paidOn: null },
  });

  revalidate();
  return { ok: true };
}

/** Admin only — override just this month's expected amount. */
export async function setOccurrenceAmount(
  expenseId: number,
  dueDate: string,
  amount: number | null,
): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");

  if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
    return fail("Enter a valid amount.");
  }

  const problem = await assertRealOccurrence(expenseId, dueDate);
  if (problem) return fail(problem);

  const plannedAmount = amount === null ? null : round2(amount);
  await prisma.budgetOccurrence.upsert({
    where: { expenseId_dueDate: { expenseId, dueDate } },
    create: { expenseId, dueDate, plannedAmount },
    update: { plannedAmount },
  });

  revalidate();
  return { ok: true };
}

/** Admin only. */
export async function createBudgetCategory(input: {
  name: string;
  iconKey?: string;
  colorKey?: string;
}): Promise<ActionResult<{ id: number }>> {
  if (!(await isAdminSession())) return fail("Admin only.");

  const name = input.name.trim();
  if (!name) return fail("Enter a category name.");
  if (name.length > 64) return fail("That name is too long.");

  const existing = await prisma.budgetCategory.findUnique({ where: { name } });
  if (existing) return fail("That category already exists.");

  const category = await prisma.budgetCategory.create({
    data: {
      name,
      iconKey: input.iconKey || "other",
      colorKey: input.colorKey || "blue",
      sortOrder: 100,
    },
  });

  revalidate();
  return { ok: true, data: { id: category.id } };
}

/** Admin only — blocked while any expense still points at the category. */
export async function deleteBudgetCategory(id: number): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");

  const inUse = await prisma.budgetExpense.count({ where: { categoryId: id } });
  if (inUse > 0) return fail("That category is still in use.");

  await prisma.budgetCategory.delete({ where: { id } });
  revalidate();
  return { ok: true };
}
