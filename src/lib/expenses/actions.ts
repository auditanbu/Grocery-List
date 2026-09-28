"use server";

import { revalidatePath } from "next/cache";

import { isAdminSession } from "../admin";
import { monthKeyOf } from "../dates";
import { prisma } from "../prisma";
import { allocateByShares, allocateEqually, toPaise, toRupees } from "./balances";
import type { EntryKind, SplitMethod } from "./types";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * How an entry divides. `personIds` is who is in; the rest depends on the
 * method — nothing for EQUAL, an amount each for EXACT, a weight each for
 * SHARES. Null means the entry is not split at all.
 */
export type SplitInput = {
  method: SplitMethod;
  personIds: number[];
  /** personId -> rupees, for EXACT. */
  exact?: Record<number, number>;
  /** personId -> weight, for SHARES. */
  units?: Record<number, number>;
} | null;

export type ExpenseInput = {
  kind: EntryKind;
  amount: number;
  /** UTC ISO datetime, already resolved from the browser's timezone. */
  spentAt: string;
  categoryId: number;
  paidById?: number | null;
  methodId?: number | null;
  note?: string | null;
  split: SplitInput;
};

/**
 * Turns a split into the rows that get stored, or says why it cannot.
 *
 * EXACT is checked to the paisa: a split that does not add up to the entry is
 * the one mistake that quietly corrupts every balance downstream, so it is
 * refused here rather than stored and puzzled over later.
 */
function resolveShares(
  input: ExpenseInput,
): { ok: true; shares: { personId: number; amount: number; shareUnits: number | null }[] } | { ok: false; error: string } {
  const { split } = input;
  if (!split || split.personIds.length === 0) return { ok: true, shares: [] };

  const ids = [...new Set(split.personIds)];
  const amountPaise = toPaise(input.amount);

  if (split.method === "EQUAL") {
    const allocated = allocateEqually(amountPaise, ids, input.paidById ?? null);
    return {
      ok: true,
      shares: ids.map((personId) => ({
        personId,
        amount: toRupees(allocated.get(personId) ?? 0),
        shareUnits: null,
      })),
    };
  }

  if (split.method === "SHARES") {
    const units = new Map<number, number>();
    for (const personId of ids) {
      const weight = Math.round(Number(split.units?.[personId] ?? 0));
      if (!Number.isFinite(weight) || weight < 0) return { ok: false, error: "Shares must be whole numbers." };
      units.set(personId, weight);
    }
    if ([...units.values()].every((weight) => weight === 0)) {
      return { ok: false, error: "Give at least one person a share." };
    }
    const allocated = allocateByShares(amountPaise, units, input.paidById ?? null);
    return {
      ok: true,
      shares: ids
        .filter((personId) => (units.get(personId) ?? 0) > 0)
        .map((personId) => ({
          personId,
          amount: toRupees(allocated.get(personId) ?? 0),
          shareUnits: units.get(personId) ?? 0,
        })),
    };
  }

  // EXACT
  let assigned = 0;
  const shares = ids.map((personId) => {
    const value = Number(split.exact?.[personId] ?? 0);
    const paise = toPaise(Number.isFinite(value) ? value : 0);
    assigned += paise;
    return { personId, amount: toRupees(paise), shareUnits: null };
  });
  if (assigned !== amountPaise) {
    const difference = toRupees(Math.abs(amountPaise - assigned));
    return {
      ok: false,
      error:
        assigned < amountPaise
          ? `₹${difference.toFixed(2)} of this entry is unassigned.`
          : `The split is ₹${difference.toFixed(2)} over the entry.`,
    };
  }
  return { ok: true, shares };
}

function validate(input: ExpenseInput): string | null {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return "Enter an amount.";
  if (!Number.isFinite(input.categoryId)) return "Choose a category.";
  if (Number.isNaN(Date.parse(input.spentAt))) return "Enter a valid date.";
  return null;
}

export async function createExpense(input: ExpenseInput): Promise<ActionResult<{ id: number }>> {
  const invalid = validate(input);
  if (invalid) return fail(invalid);

  const resolved = resolveShares(input);
  if (!resolved.ok) return fail(resolved.error);

  const spentAt = new Date(input.spentAt);
  const entry = await prisma.expense.create({
    data: {
      kind: input.kind,
      amount: money(input.amount),
      spentAt,
      monthKey: monthKeyOf(spentAt),
      categoryId: input.categoryId,
      paidById: input.paidById ?? null,
      methodId: input.methodId ?? null,
      note: input.note?.trim() || null,
      splitMethod: resolved.shares.length > 0 ? input.split?.method ?? null : null,
      shares: { create: resolved.shares },
    },
  });

  revalidatePath("/expenses");
  return { ok: true, data: { id: entry.id } };
}

export async function updateExpense(id: number, input: ExpenseInput): Promise<ActionResult> {
  const invalid = validate(input);
  if (invalid) return fail(invalid);

  const resolved = resolveShares(input);
  if (!resolved.ok) return fail(resolved.error);

  const spentAt = new Date(input.spentAt);
  // The shares are replaced wholesale rather than reconciled: who is on a
  // split changes as often as the amount does, and a half-updated set would
  // no longer sum to the entry.
  await prisma.$transaction([
    prisma.expenseShare.deleteMany({ where: { expenseId: id } }),
    prisma.expense.update({
      where: { id },
      data: {
        kind: input.kind,
        amount: money(input.amount),
        spentAt,
        monthKey: monthKeyOf(spentAt),
        categoryId: input.categoryId,
        paidById: input.paidById ?? null,
        methodId: input.methodId ?? null,
        note: input.note?.trim() || null,
        splitMethod: resolved.shares.length > 0 ? input.split?.method ?? null : null,
        shares: { create: resolved.shares },
      },
    }),
  ]);

  revalidatePath("/expenses");
  return { ok: true };
}

/** Admin only — an entry is a shared record of what the household spent. */
export async function deleteExpense(id: number): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");
  await prisma.expense.delete({ where: { id } });
  revalidatePath("/expenses");
  return { ok: true };
}

export async function settleUp(input: {
  fromPersonId: number;
  toPersonId: number;
  amount: number;
  settledAt?: string;
  note?: string | null;
}): Promise<ActionResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return fail("Enter an amount.");
  if (input.fromPersonId === input.toPersonId) return fail("Pick two different people.");

  const settledAt = input.settledAt ? new Date(input.settledAt) : new Date();
  if (Number.isNaN(settledAt.getTime())) return fail("Enter a valid date.");

  await prisma.settlement.create({
    data: {
      fromPersonId: input.fromPersonId,
      toPersonId: input.toPersonId,
      amount: money(input.amount),
      settledAt,
      monthKey: monthKeyOf(settledAt),
      note: input.note?.trim() || null,
    },
  });

  revalidatePath("/expenses");
  return { ok: true };
}

/** Admin only — undoing a payment puts a debt back on someone. */
export async function deleteSettlement(id: number): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");
  await prisma.settlement.delete({ where: { id } });
  revalidatePath("/expenses");
  return { ok: true };
}

export async function upsertPerson(input: {
  id?: number;
  name: string;
  colorKey?: string | null;
}): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");
  const name = input.name.trim();
  if (!name) return fail("Give this person a name.");

  if (input.id) {
    await prisma.expensePerson.update({
      where: { id: input.id },
      data: { name, colorKey: input.colorKey ?? null },
    });
  } else {
    const count = await prisma.expensePerson.count();
    await prisma.expensePerson.create({
      data: { name, colorKey: input.colorKey ?? null, sortOrder: count },
    });
  }

  revalidatePath("/expenses");
  return { ok: true };
}

/**
 * Admin only. A person who has ever paid for or shared an entry is hidden
 * rather than deleted — removing them would take those shares with them and
 * silently rewrite balances that were already settled.
 */
export async function removePerson(id: number): Promise<ActionResult<{ deleted: boolean }>> {
  if (!(await isAdminSession())) return fail("Admin only.");

  const [shares, paid, settlements] = await Promise.all([
    prisma.expenseShare.count({ where: { personId: id } }),
    prisma.expense.count({ where: { paidById: id } }),
    prisma.settlement.count({
      where: { OR: [{ fromPersonId: id }, { toPersonId: id }] },
    }),
  ]);

  if (shares + paid + settlements > 0) {
    await prisma.expensePerson.update({ where: { id }, data: { isActive: false } });
    revalidatePath("/expenses");
    return { ok: true, data: { deleted: false } };
  }

  await prisma.expensePerson.delete({ where: { id } });
  revalidatePath("/expenses");
  return { ok: true, data: { deleted: true } };
}

export async function upsertExpenseCategory(input: {
  id?: number;
  nameEn: string;
  nameTa?: string | null;
  kind: EntryKind;
}): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");
  const nameEn = input.nameEn.trim();
  if (!nameEn) return fail("Give this category a name.");

  const data = { nameEn, nameTa: input.nameTa?.trim() || null, kind: input.kind };
  if (input.id) {
    await prisma.expenseCategory.update({ where: { id: input.id }, data });
  } else {
    const count = await prisma.expenseCategory.count();
    await prisma.expenseCategory.create({ data: { ...data, sortOrder: count } });
  }

  revalidatePath("/expenses");
  return { ok: true };
}

/** Admin only — refused while entries still point at it, which is the DB's rule too. */
export async function removeExpenseCategory(id: number): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");
  const used = await prisma.expense.count({ where: { categoryId: id } });
  if (used > 0) {
    return fail(`${used} ${used === 1 ? "entry uses" : "entries use"} this category — move them first.`);
  }
  await prisma.expenseCategory.delete({ where: { id } });
  revalidatePath("/expenses");
  return { ok: true };
}

/** Admin only, like the fuel budget: a ceiling shouldn't move by accident. */
export async function setCategoryBudget(
  categoryId: number,
  amount: number | null,
): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");

  if (amount === null) {
    await prisma.expenseBudget.deleteMany({ where: { categoryId } });
    revalidatePath("/expenses");
    return { ok: true };
  }

  if (!Number.isFinite(amount) || amount <= 0) return fail("Enter a budget, or clear it.");
  await prisma.expenseBudget.upsert({
    where: { categoryId },
    create: { categoryId, amount: money(amount) },
    update: { amount: money(amount) },
  });

  revalidatePath("/expenses");
  return { ok: true };
}

export async function upsertPaymentMethod(input: {
  id?: number;
  name: string;
}): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");
  const name = input.name.trim();
  if (!name) return fail("Give this method a name.");

  if (input.id) {
    await prisma.paymentMethod.update({ where: { id: input.id }, data: { name } });
  } else {
    const count = await prisma.paymentMethod.count();
    await prisma.paymentMethod.create({ data: { name, sortOrder: count } });
  }

  revalidatePath("/expenses");
  return { ok: true };
}

/** Admin only. Kept (hidden) when entries were paid with it, so their history stays readable. */
export async function removePaymentMethod(id: number): Promise<ActionResult<{ deleted: boolean }>> {
  if (!(await isAdminSession())) return fail("Admin only.");
  const used = await prisma.expense.count({ where: { methodId: id } });
  if (used > 0) {
    await prisma.paymentMethod.update({ where: { id }, data: { isActive: false } });
    revalidatePath("/expenses");
    return { ok: true, data: { deleted: false } };
  }
  await prisma.paymentMethod.delete({ where: { id } });
  revalidatePath("/expenses");
  return { ok: true, data: { deleted: true } };
}
