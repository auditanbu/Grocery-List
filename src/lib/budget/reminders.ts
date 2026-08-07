import "server-only";

import { addDaysToDateKey, dateKeyToShortLabel, monthKeyOfDateKey, todayDateKey } from "../dates";
import { prisma } from "../prisma";
import { formatPrice } from "../units";
import { sendToAll } from "./push";
import { occurrencesBetween } from "./recurrence";
import type { BudgetReminderKind } from "./types";

type Candidate = {
  expenseId: number;
  name: string;
  amount: number;
  dueDate: string;
  kind: BudgetReminderKind;
};

export type SweepResult = {
  today: string;
  candidates: number;
  sent: number;
  duplicates: number;
  delivered: number;
  items: {
    expense: string;
    dueDate: string;
    kind: BudgetReminderKind;
    outcome: "sent" | "duplicate" | "dry-run";
  }[];
};

function bodyFor(candidate: Candidate): string {
  if (candidate.kind === "DUE") return "Due today";
  const days = Math.max(
    0,
    Math.round(
      (Date.parse(`${candidate.dueDate}T00:00:00Z`) -
        Date.parse(`${todayDateKey()}T00:00:00Z`)) /
        86_400_000,
    ),
  );
  const when = days === 1 ? "tomorrow" : `in ${days} days`;
  return `Due ${when} (${dateKeyToShortLabel(candidate.dueDate)})`;
}

/**
 * The daily sweep. Safe to run more than once a day: BudgetReminder's unique
 * key on (expenseId, dueDate, kind) is the idempotency guard, and the row is
 * written *before* the push is sent — so a crash mid-sweep costs at most one
 * notification, rather than re-sending everything on the retry.
 */
export async function runReminderSweep(
  options: { dryRun?: boolean } = {},
): Promise<SweepResult> {
  const today = todayDateKey();

  const expenses = await prisma.budgetExpense.findMany({
    where: { isActive: true, remindersEnabled: true },
  });

  const candidates: Candidate[] = [];
  for (const expense of expenses) {
    const rule = {
      recurrence: expense.recurrence,
      intervalMonths: expense.intervalMonths,
      anchorDate: expense.anchorDate,
      endDate: expense.endDate,
    };
    const leadDate = addDaysToDateKey(today, expense.reminderLeadDays);
    const amount = expense.amount.toNumber();

    if (occurrencesBetween(rule, today, today).length > 0) {
      candidates.push({ expenseId: expense.id, name: expense.name, amount, dueDate: today, kind: "DUE" });
    }

    // leadDays of 0 would just duplicate the DUE reminder.
    if (expense.reminderLeadDays > 0 && occurrencesBetween(rule, leadDate, leadDate).length > 0) {
      candidates.push({
        expenseId: expense.id,
        name: expense.name,
        amount,
        dueDate: leadDate,
        kind: "UPCOMING",
      });
    }
  }

  // Anything already settled shouldn't nag.
  const settled = await prisma.budgetOccurrence.findMany({
    where: {
      expenseId: { in: candidates.map((candidate) => candidate.expenseId) },
      dueDate: { in: candidates.map((candidate) => candidate.dueDate) },
      status: { in: ["PAID", "SKIPPED"] },
    },
    select: { expenseId: true, dueDate: true },
  });
  const settledKeys = new Set(settled.map((row) => `${row.expenseId}:${row.dueDate}`));

  const pending = candidates.filter(
    (candidate) => !settledKeys.has(`${candidate.expenseId}:${candidate.dueDate}`),
  );

  const result: SweepResult = {
    today,
    candidates: pending.length,
    sent: 0,
    duplicates: 0,
    delivered: 0,
    items: [],
  };

  if (options.dryRun) {
    result.items = pending.map((candidate) => ({
      expense: candidate.name,
      dueDate: candidate.dueDate,
      kind: candidate.kind,
      outcome: "dry-run" as const,
    }));
    return result;
  }

  for (const candidate of pending) {
    let reminderId: number;
    try {
      const reminder = await prisma.budgetReminder.create({
        data: { expenseId: candidate.expenseId, dueDate: candidate.dueDate, kind: candidate.kind },
      });
      reminderId = reminder.id;
    } catch {
      // Unique violation — this reminder already went out.
      result.duplicates += 1;
      result.items.push({
        expense: candidate.name,
        dueDate: candidate.dueDate,
        kind: candidate.kind,
        outcome: "duplicate",
      });
      continue;
    }

    const delivered = await sendToAll({
      title: `${candidate.name} · ${formatPrice(candidate.amount)}`,
      body: bodyFor(candidate),
      url: `/budget?month=${monthKeyOfDateKey(candidate.dueDate)}`,
      tag: `budget-${candidate.expenseId}-${candidate.dueDate}-${candidate.kind}`,
    });

    await prisma.budgetReminder.update({ where: { id: reminderId }, data: { delivered } });

    result.sent += 1;
    result.delivered += delivered;
    result.items.push({
      expense: candidate.name,
      dueDate: candidate.dueDate,
      kind: candidate.kind,
      outcome: "sent",
    });
  }

  return result;
}
