"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Sheet } from "@/components/Sheet";
import { useAdmin } from "@/lib/admin-context";
import { dateKeyToLabel } from "@/lib/dates";
import { formatPrice } from "@/lib/units";
import {
  markOccurrencePaid,
  setOccurrenceAmount,
  setOccurrenceSkipped,
  unmarkOccurrencePaid,
} from "@/lib/budget/actions";
import type { OccurrenceDTO } from "@/lib/budget/types";

const inputClass =
  "mt-1.5 h-12 w-full rounded-ios bg-ios-surface-2 px-4 text-[16px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue";

/**
 * One occurrence: what it costs, whether it's paid, and — for admins — the
 * mark-paid form. The actual amount is deliberately editable and free to
 * differ from the planned one; that difference is the point of tracking.
 */
export function OccurrenceSheet({
  open,
  onClose,
  occurrence,
  today,
}: {
  open: boolean;
  onClose: () => void;
  occurrence: OccurrenceDTO | null;
  today: string;
}) {
  const router = useRouter();
  const { isAdmin } = useAdmin();
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !occurrence) return;
    setError(null);
    setAmount(String(occurrence.paidAmount ?? occurrence.plannedAmount));
    setPaidOn(occurrence.paidOn ?? today);
    setNote(occurrence.note ?? "");
  }, [open, occurrence, today]);

  if (!occurrence) return null;

  const parsed = Number.parseFloat(amount.replace(",", "."));
  const delta = Number.isFinite(parsed) ? parsed - occurrence.plannedAmount : 0;

  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  const save = () => {
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Enter how much was paid.");
      return;
    }
    run(() =>
      markOccurrencePaid({
        expenseId: occurrence.expenseId,
        dueDate: occurrence.dueDate,
        paidAmount: parsed,
        paidOn,
        note: note.trim() || null,
      }),
    );
  };

  const isPaid = occurrence.state === "PAID";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={occurrence.name}
      subtitle={`${occurrence.categoryName} · due ${dateKeyToLabel(occurrence.dueDate)}`}
      footer={
        isAdmin ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="flex h-12 w-full items-center justify-center rounded-ios bg-ios-blue text-[17px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
            >
              {isPaid ? "Update payment" : "Mark as paid"}
            </button>
            {isPaid ? (
              <button
                type="button"
                onClick={() => run(() => unmarkOccurrencePaid(occurrence.expenseId, occurrence.dueDate))}
                disabled={pending}
                className="flex h-11 w-full items-center justify-center rounded-ios text-[15px] font-medium text-ios-label-2 active:opacity-60 disabled:opacity-50"
              >
                Undo payment
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  run(() =>
                    setOccurrenceSkipped(
                      occurrence.expenseId,
                      occurrence.dueDate,
                      occurrence.state !== "SKIPPED",
                    ),
                  )
                }
                disabled={pending}
                className="flex h-11 w-full items-center justify-center rounded-ios text-[15px] font-medium text-ios-label-2 active:opacity-60 disabled:opacity-50"
              >
                {occurrence.state === "SKIPPED" ? "Un-skip this month" : "Skip this month"}
              </button>
            )}
          </div>
        ) : null
      }
    >
      <div className="space-y-4">
        <div className="ios-card bg-ios-surface-2 p-4">
          <p className="text-[13px] text-ios-label-2">Planned</p>
          <p className="text-[24px] font-bold tabular-nums tracking-tight">
            {formatPrice(occurrence.plannedAmount)}
          </p>
          <p className="mt-1 text-[13px] text-ios-label-3">{occurrence.recurrenceLabel}</p>
        </div>

        {occurrence.detached ? (
          <p className="rounded-ios bg-ios-orange/10 px-3 py-2 text-[13px] text-ios-orange">
            This expense&rsquo;s schedule changed after this date was recorded, so it no longer
            falls on a scheduled due date. It&rsquo;s kept here so the payment isn&rsquo;t lost.
          </p>
        ) : null}

        {isAdmin ? (
          <>
            <label className="block">
              <span className="text-[13px] font-medium text-ios-label-2">Amount paid</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className={inputClass}
              />
              {Math.abs(delta) >= 0.01 ? (
                <span
                  className={`mt-1.5 block text-[13px] font-medium ${delta > 0 ? "text-ios-red" : "text-ios-green"}`}
                >
                  {delta > 0 ? "+" : "−"}
                  {formatPrice(Math.abs(delta)).slice(1)} vs planned
                </span>
              ) : null}
            </label>

            <label className="block">
              <span className="text-[13px] font-medium text-ios-label-2">Paid on</span>
              <input
                type="date"
                value={paidOn}
                onChange={(event) => setPaidOn(event.target.value)}
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="text-[13px] font-medium text-ios-label-2">Note (optional)</span>
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Reference number, who paid, …"
                className={inputClass}
              />
            </label>

            <button
              type="button"
              onClick={() => {
                if (!Number.isFinite(parsed) || parsed <= 0) {
                  setError("Enter a valid amount.");
                  return;
                }
                run(() => setOccurrenceAmount(occurrence.expenseId, occurrence.dueDate, parsed));
              }}
              disabled={pending}
              className="text-[14px] font-medium text-ios-blue active:opacity-60 disabled:opacity-50"
            >
              Set as this month&rsquo;s expected amount instead
            </button>
          </>
        ) : (
          <div className="space-y-1">
            {occurrence.paidAmount !== null ? (
              <p className="text-[15px]">
                Paid {formatPrice(occurrence.paidAmount)}
                {occurrence.paidOn ? ` on ${dateKeyToLabel(occurrence.paidOn)}` : ""}
              </p>
            ) : (
              <p className="text-[15px] text-ios-label-2">Not paid yet.</p>
            )}
            {occurrence.note ? (
              <p className="text-[14px] text-ios-label-2">{occurrence.note}</p>
            ) : null}
          </div>
        )}

        {error ? <p className="text-[14px] text-ios-red">{error}</p> : null}
      </div>
    </Sheet>
  );
}
