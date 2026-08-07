import type {
  BudgetOccurrenceStatus,
  BudgetRecurrence,
  BudgetReminderKind,
} from "@/generated/prisma/enums";

export type { BudgetOccurrenceStatus, BudgetRecurrence, BudgetReminderKind };

/**
 * Prisma returns Decimal instances, which cannot cross the server/client
 * boundary. Every query in queries.ts maps rows onto these plain shapes, and
 * all dates are civil "YYYY-MM-DD" strings rather than Date objects.
 */

export type BudgetCategoryDTO = {
  id: number;
  name: string;
  iconKey: string;
  colorKey: string;
  sortOrder: number;
};

/**
 * Where an occurrence stands, computed server-side against the Indian civil
 * date. Deriving this on the client from `new Date()` would both drift and
 * produce a hydration mismatch, so there is exactly one clock.
 */
export type OccurrenceState = "PLANNED" | "DUE_TODAY" | "OVERDUE" | "PAID" | "SKIPPED";

export type OccurrenceDTO = {
  /** Stable key — an occurrence often has no row: `${expenseId}:${dueDate}`. */
  key: string;
  expenseId: number;
  /** null when nobody has touched this date yet, so no row exists. */
  occurrenceId: number | null;
  name: string;
  categoryName: string;
  iconKey: string;
  colorKey: string;
  dueDate: string;
  /** The per-occurrence override if there is one, else the expense's amount. */
  plannedAmount: number;
  paidAmount: number | null;
  paidOn: string | null;
  state: OccurrenceState;
  note: string | null;
  recurrenceLabel: string;
  /**
   * A stored row whose date the (since-edited) rule no longer produces. Kept
   * visible rather than hidden, so editing a rule never loses paid history.
   */
  detached: boolean;
};

export type ExpenseDTO = {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  iconKey: string;
  colorKey: string;
  amount: number;
  recurrence: BudgetRecurrence;
  intervalMonths: number | null;
  anchorDate: string;
  endDate: string | null;
  isActive: boolean;
  remindersEnabled: boolean;
  reminderLeadDays: number;
  notes: string | null;
  recurrenceLabel: string;
  /** Next due date on or after today, or null once the series has ended. */
  nextDueDate: string | null;
  /**
   * The day this expense was set up, as a date key. Occurrences before it are
   * back-history implied by the rule rather than bills anyone failed to pay,
   * so they never raise an overdue alert.
   */
  trackedFrom: string;
};

export type BudgetOverviewDTO = {
  monthKey: string;
  /** Today's Indian civil date — the single clock the whole UI renders against. */
  today: string;
  monthOccurrences: OccurrenceDTO[];
  /** Unpaid and past due, capped at a 12-month lookback. */
  overdue: OccurrenceDTO[];
  /** Unpaid and due within the next 7 days, today included. */
  dueSoon: OccurrenceDTO[];
  plannedTotal: number;
  paidTotal: number;
  expenses: ExpenseDTO[];
  categories: BudgetCategoryDTO[];
  /** False when the server has no VAPID keys, so the UI can explain why. */
  pushConfigured: boolean;
  /**
   * Passed as a prop rather than read from a NEXT_PUBLIC_ variable: those are
   * inlined at build time, which on Railway means the key must be present when
   * the image is built, not just when it runs.
   */
  vapidPublicKey: string | null;
};
