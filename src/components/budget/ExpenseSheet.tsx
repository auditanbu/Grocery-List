"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Sheet } from "@/components/Sheet";
import { dateKeyToShortLabel, todayDateKey } from "@/lib/dates";
import {
  createExpense,
  deleteExpense,
  setExpenseActive,
  updateExpense,
} from "@/lib/budget/actions";
import { RECURRENCE_OPTIONS, occurrencesBetween, addMonthsClamped } from "@/lib/budget/recurrence";
import type { BudgetCategoryDTO, BudgetRecurrence, ExpenseDTO } from "@/lib/budget/types";

const inputClass =
  "mt-1.5 h-12 w-full rounded-ios bg-ios-surface-2 px-4 text-[16px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue";

export function ExpenseSheet({
  open,
  onClose,
  expense,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  expense: ExpenseDTO | null;
  categories: BudgetCategoryDTO[];
}) {
  const router = useRouter();
  const isEdit = expense !== null;

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [recurrence, setRecurrence] = useState<BudgetRecurrence>("MONTHLY");
  const [intervalMonths, setIntervalMonths] = useState("3");
  const [anchorDate, setAnchorDate] = useState(() => todayDateKey());
  const [endDate, setEndDate] = useState("");
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderLeadDays, setReminderLeadDays] = useState("2");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (expense) {
      setName(expense.name);
      setCategoryId(expense.categoryId);
      setAmount(String(expense.amount));
      setRecurrence(expense.recurrence);
      setIntervalMonths(String(expense.intervalMonths ?? 3));
      setAnchorDate(expense.anchorDate);
      setEndDate(expense.endDate ?? "");
      setRemindersEnabled(expense.remindersEnabled);
      setReminderLeadDays(String(expense.reminderLeadDays));
      setNotes(expense.notes ?? "");
    } else {
      setName("");
      setCategoryId(categories[0]?.id ?? null);
      setAmount("");
      setRecurrence("MONTHLY");
      setIntervalMonths("3");
      setAnchorDate(todayDateKey());
      setEndDate("");
      setRemindersEnabled(true);
      setReminderLeadDays("2");
      setNotes("");
    }
  }, [open, expense, categories]);

  /*
   * Live preview of the next few due dates, computed with the very same
   * function the server and calendar use. This is why recurrence.ts carries no
   * "server-only" directive — it makes the 31st-clamping visible up front
   * rather than surprising somebody in February.
   */
  const preview = useMemo(() => {
    const parsedInterval = Number.parseInt(intervalMonths, 10);
    const rule = {
      recurrence,
      intervalMonths: recurrence === "CUSTOM_MONTHS" ? parsedInterval : null,
      anchorDate,
      endDate: endDate || null,
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) return [];
    return occurrencesBetween(rule, anchorDate, addMonthsClamped(anchorDate, 60)).slice(0, 5);
  }, [recurrence, intervalMonths, anchorDate, endDate]);

  const save = () => {
    if (categoryId === null) {
      setError("Choose a category.");
      return;
    }
    const parsedAmount = Number.parseFloat(amount.replace(",", "."));
    const payload = {
      name,
      categoryId,
      amount: parsedAmount,
      recurrence,
      intervalMonths: recurrence === "CUSTOM_MONTHS" ? Number.parseInt(intervalMonths, 10) : null,
      anchorDate,
      endDate: endDate || null,
      remindersEnabled,
      reminderLeadDays: Number.parseInt(reminderLeadDays, 10),
      notes: notes.trim() || null,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateExpense(expense.id, payload)
        : await createExpense(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  const retire = () => {
    if (!expense) return;
    startTransition(async () => {
      const result = await setExpenseActive(expense.id, !expense.isActive);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  const remove = () => {
    if (!expense) return;
    if (
      !window.confirm(
        `Delete "${expense.name}"? Its payment history will be deleted too. To stop it recurring without losing history, set an end date instead.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteExpense(expense.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit expense" : "New expense"}
      subtitle={isEdit ? expense.name : "A bill that repeats, or a one-off"}
      footer={
        <div className="space-y-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="flex h-12 w-full items-center justify-center rounded-ios bg-ios-blue text-[17px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            {isEdit ? "Save changes" : "Add expense"}
          </button>
          {isEdit ? (
            <>
              {/* The non-destructive way out: stops it recurring, keeps history. */}
              <button
                type="button"
                onClick={retire}
                disabled={pending}
                className="flex h-11 w-full items-center justify-center rounded-ios text-[15px] font-medium text-ios-label-2 active:opacity-60 disabled:opacity-50"
              >
                {expense.isActive ? "Retire (keep history)" : "Reactivate"}
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="flex h-11 w-full items-center justify-center rounded-ios text-[15px] font-medium text-ios-red active:opacity-60 disabled:opacity-50"
              >
                Delete expense
              </button>
            </>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-[13px] font-medium text-ios-label-2">Name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="EB bill"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-[13px] font-medium text-ios-label-2">Category</span>
          <select
            value={categoryId ?? ""}
            onChange={(event) => setCategoryId(Number(event.target.value))}
            className={inputClass}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[13px] font-medium text-ios-label-2">Amount</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="2400"
            className={inputClass}
          />
        </label>

        <div>
          <span className="text-[13px] font-medium text-ios-label-2">Repeats</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {RECURRENCE_OPTIONS.map((option) => {
              const active = option.value === recurrence;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRecurrence(option.value)}
                  className={`h-9 rounded-full px-3.5 text-[14px] font-medium transition active:scale-95 ${
                    active
                      ? "bg-ios-blue text-white"
                      : "bg-ios-surface-2 text-ios-label-2 ring-1 ring-inset ring-ios-separator"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {recurrence === "CUSTOM_MONTHS" ? (
          <label className="block">
            <span className="text-[13px] font-medium text-ios-label-2">Every N months</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="60"
              value={intervalMonths}
              onChange={(event) => setIntervalMonths(event.target.value)}
              className={inputClass}
            />
          </label>
        ) : null}

        <label className="block">
          <span className="text-[13px] font-medium text-ios-label-2">
            {recurrence === "ONE_OFF" ? "Due date" : "First due date"}
          </span>
          <input
            type="date"
            value={anchorDate}
            onChange={(event) => setAnchorDate(event.target.value)}
            className={inputClass}
          />
        </label>

        {recurrence !== "ONE_OFF" ? (
          <label className="block">
            <span className="text-[13px] font-medium text-ios-label-2">Ends on (optional)</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className={inputClass}
            />
          </label>
        ) : null}

        {preview.length > 0 ? (
          <p className="rounded-ios bg-ios-surface-2 px-3 py-2 text-[13px] text-ios-label-2">
            Next: {preview.map((date) => dateKeyToShortLabel(date)).join(" · ")}
          </p>
        ) : null}

        <label className="flex items-center justify-between gap-3">
          <span className="text-[15px]">Send reminders</span>
          <input
            type="checkbox"
            checked={remindersEnabled}
            onChange={(event) => setRemindersEnabled(event.target.checked)}
            className="h-6 w-6 accent-[color:var(--color-ios-blue)]"
          />
        </label>

        {remindersEnabled ? (
          <label className="block">
            <span className="text-[13px] font-medium text-ios-label-2">
              Remind this many days ahead (0 = only on the day)
            </span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="30"
              value={reminderLeadDays}
              onChange={(event) => setReminderLeadDays(event.target.value)}
              className={inputClass}
            />
          </label>
        ) : null}

        <label className="block">
          <span className="text-[13px] font-medium text-ios-label-2">Notes (optional)</span>
          <input
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Account number, who pays it, …"
            className={inputClass}
          />
        </label>

        {error ? <p className="text-[14px] text-ios-red">{error}</p> : null}
      </div>
    </Sheet>
  );
}
