import "server-only";

import { prisma } from "../prisma";
import { netBalances, simplify, toPaise, toRupees } from "./balances";
import type {
  BalanceDTO,
  CategoryTotalDTO,
  ExpenseCategoryDTO,
  ExpenseDTO,
  ExpenseMonthDTO,
  ExpensePersonDTO,
  PaymentMethodDTO,
  SettlementDTO,
  TransferDTO,
} from "./types";

type DecimalLike = { toNumber(): number } | number | null | undefined;

function num(value: DecimalLike): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

function monthRange(monthKey: string): { start: Date; end: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
}

export async function getPeople(): Promise<ExpensePersonDTO[]> {
  const rows = await prisma.expensePerson.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    colorKey: row.colorKey,
    isActive: row.isActive,
  }));
}

export async function getPaymentMethods(): Promise<PaymentMethodDTO[]> {
  const rows = await prisma.paymentMethod.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  return rows.map((row) => ({ id: row.id, name: row.name, isActive: row.isActive }));
}

export async function getExpenseCategories(): Promise<ExpenseCategoryDTO[]> {
  const rows = await prisma.expenseCategory.findMany({
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    include: { budget: true },
  });
  return rows.map((row) => ({
    id: row.id,
    nameEn: row.nameEn,
    nameTa: row.nameTa,
    kind: row.kind,
    budget: row.budget ? num(row.budget.amount) : null,
  }));
}

/**
 * Who is owed what, across every split expense and settlement ever recorded.
 *
 * Deliberately not scoped to a month: a debt run up in September is still a
 * debt in October, and the settlement that clears it usually lands in a
 * different month from the expense that caused it.
 */
async function getBalances(
  people: ExpensePersonDTO[],
): Promise<{ balances: BalanceDTO[]; transfers: TransferDTO[] }> {
  const [expenses, settlements] = await Promise.all([
    prisma.expense.findMany({
      where: { kind: "EXPENSE", shares: { some: {} } },
      select: { paidById: true, shares: { select: { personId: true, amount: true } } },
    }),
    prisma.settlement.findMany({
      select: { fromPersonId: true, toPersonId: true, amount: true },
    }),
  ]);

  const net = netBalances({
    expenses: expenses.map((expense) => ({
      paidById: expense.paidById,
      shares: expense.shares.map((share) => ({
        personId: share.personId,
        amountPaise: toPaise(num(share.amount)),
      })),
    })),
    settlements: settlements.map((settlement) => ({
      fromPersonId: settlement.fromPersonId,
      toPersonId: settlement.toPersonId,
      amountPaise: toPaise(num(settlement.amount)),
    })),
  });

  const nameOf = new Map(people.map((person) => [person.id, person]));
  const balances: BalanceDTO[] = [...net.entries()]
    .filter(([, paise]) => paise !== 0)
    .map(([personId, paise]) => ({
      personId,
      personName: nameOf.get(personId)?.name ?? "Someone",
      colorKey: nameOf.get(personId)?.colorKey ?? null,
      net: toRupees(paise),
    }))
    .sort((a, b) => b.net - a.net);

  const transfers: TransferDTO[] = simplify(net).map((transfer) => ({
    fromPersonId: transfer.fromPersonId,
    fromName: nameOf.get(transfer.fromPersonId)?.name ?? "Someone",
    toPersonId: transfer.toPersonId,
    toName: nameOf.get(transfer.toPersonId)?.name ?? "Someone",
    amount: toRupees(transfer.amountPaise),
  }));

  return { balances, transfers };
}

export async function getExpenseMonth(monthKey: string): Promise<ExpenseMonthDTO> {
  const { start, end } = monthRange(monthKey);

  const [rows, settlementRows, categories, people, methods] = await Promise.all([
    prisma.expense.findMany({
      where: { spentAt: { gte: start, lt: end } },
      orderBy: [{ spentAt: "desc" }, { id: "desc" }],
      include: {
        category: true,
        paidBy: true,
        method: true,
        shares: { include: { person: true } },
      },
    }),
    prisma.settlement.findMany({
      where: { settledAt: { gte: start, lt: end } },
      orderBy: [{ settledAt: "desc" }, { id: "desc" }],
      include: { fromPerson: true, toPerson: true },
    }),
    getExpenseCategories(),
    getPeople(),
    getPaymentMethods(),
  ]);

  const entries: ExpenseDTO[] = rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    amount: num(row.amount),
    spentAt: row.spentAt.toISOString(),
    monthKey: row.monthKey,
    categoryId: row.categoryId,
    categoryNameEn: row.category.nameEn,
    categoryNameTa: row.category.nameTa,
    paidById: row.paidById,
    paidByName: row.paidBy?.name ?? null,
    methodId: row.methodId,
    methodName: row.method?.name ?? null,
    note: row.note,
    splitMethod: row.splitMethod,
    shares: row.shares.map((share) => ({
      personId: share.personId,
      personName: share.person.name,
      amount: num(share.amount),
      shareUnits: share.shareUnits,
    })),
  }));

  const spent = entries
    .filter((entry) => entry.kind === "EXPENSE")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const income = entries
    .filter((entry) => entry.kind === "INCOME")
    .reduce((sum, entry) => sum + entry.amount, 0);

  // Only categories with something in them this month — an empty list of
  // every category ever created says nothing about the month.
  const totals = new Map<number, number>();
  for (const entry of entries) {
    totals.set(entry.categoryId, (totals.get(entry.categoryId) ?? 0) + entry.amount);
  }
  const categoryTotals: CategoryTotalDTO[] = categories
    .filter((category) => totals.has(category.id) || category.budget !== null)
    .map((category) => ({
      categoryId: category.id,
      nameEn: category.nameEn,
      nameTa: category.nameTa,
      kind: category.kind,
      total: totals.get(category.id) ?? 0,
      budget: category.budget,
    }))
    .sort((a, b) => b.total - a.total);

  const settlements: SettlementDTO[] = settlementRows.map((row) => ({
    id: row.id,
    fromPersonId: row.fromPersonId,
    fromName: row.fromPerson.name,
    toPersonId: row.toPersonId,
    toName: row.toPerson.name,
    amount: num(row.amount),
    settledAt: row.settledAt.toISOString(),
    note: row.note,
  }));

  const { balances, transfers } = await getBalances(people);

  return {
    monthKey,
    spent,
    income,
    entries,
    categoryTotals,
    settlements,
    balances,
    transfers,
    categories,
    people,
    methods,
  };
}

/** Every month with an entry, newest first — for the month switcher. */
export async function getExpenseMonths(): Promise<string[]> {
  const rows = await prisma.expense.findMany({
    select: { monthKey: true },
    distinct: ["monthKey"],
    orderBy: { monthKey: "desc" },
  });
  return rows.map((row) => row.monthKey);
}
