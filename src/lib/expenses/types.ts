import type { EntryKind, SplitMethod } from "@/generated/prisma/enums";

export type { EntryKind, SplitMethod };

export type ExpensePersonDTO = {
  id: number;
  name: string;
  colorKey: string | null;
  isActive: boolean;
};

export type PaymentMethodDTO = {
  id: number;
  name: string;
  isActive: boolean;
};

export type ExpenseCategoryDTO = {
  id: number;
  nameEn: string;
  nameTa: string | null;
  kind: EntryKind;
  /** The monthly ceiling, or null when nobody has set one. */
  budget: number | null;
};

export type ExpenseShareDTO = {
  personId: number;
  personName: string;
  amount: number;
  shareUnits: number | null;
};

export type ExpenseDTO = {
  id: number;
  kind: EntryKind;
  amount: number;
  spentAt: string;
  monthKey: string;
  categoryId: number;
  categoryNameEn: string;
  categoryNameTa: string | null;
  paidById: number | null;
  paidByName: string | null;
  methodId: number | null;
  methodName: string | null;
  note: string | null;
  splitMethod: SplitMethod | null;
  shares: ExpenseShareDTO[];
};

/** A category's month, and how that sits against its ceiling. */
export type CategoryTotalDTO = {
  categoryId: number;
  nameEn: string;
  nameTa: string | null;
  kind: EntryKind;
  total: number;
  budget: number | null;
};

/** Positive: owed to them. Negative: they owe. Across all time, never one month. */
export type BalanceDTO = {
  personId: number;
  personName: string;
  colorKey: string | null;
  net: number;
};

export type TransferDTO = {
  fromPersonId: number;
  fromName: string;
  toPersonId: number;
  toName: string;
  amount: number;
};

export type SettlementDTO = {
  id: number;
  fromPersonId: number;
  fromName: string;
  toPersonId: number;
  toName: string;
  amount: number;
  settledAt: string;
  note: string | null;
};

export type ExpenseMonthDTO = {
  monthKey: string;
  /** This month only. */
  spent: number;
  income: number;
  entries: ExpenseDTO[];
  categoryTotals: CategoryTotalDTO[];
  settlements: SettlementDTO[];
  /**
   * All-time, not this month: a debt from September is still a debt in
   * October, and a balance that reset each month would never clear.
   */
  balances: BalanceDTO[];
  transfers: TransferDTO[];
  /** Everything the add/edit sheet needs to offer. */
  categories: ExpenseCategoryDTO[];
  people: ExpensePersonDTO[];
  methods: PaymentMethodDTO[];
};
