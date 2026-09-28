"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Sheet } from "@/components/Sheet";
import { createExpense, updateExpense, type SplitInput } from "@/lib/expenses/actions";
import { useLanguage } from "@/lib/language";
import { formatPrice } from "@/lib/units";
import { allocateByShares, allocateEqually, toPaise, toRupees } from "@/lib/expenses/balances";
import type {
  EntryKind,
  ExpenseDTO,
  ExpenseMonthDTO,
  SplitMethod,
} from "@/lib/expenses/types";

const SPLIT_LABELS: Record<SplitMethod, string> = {
  EQUAL: "Equally",
  EXACT: "Exact amounts",
  SHARES: "Shares",
};

/** The datetime-local value for an ISO string, in the browser's own timezone. */
function localInputValue(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/**
 * Adding or correcting one entry: what it cost, what it was for, who paid —
 * and, only if you open it, how it splits.
 *
 * The split stays shut by default because most entries are not shared, and a
 * form that asks about five people every time is a form you stop using. When
 * it is open the remainder is shown live, so an exact split that does not add
 * up is visible before it is saved rather than refused afterwards.
 */
export function EntrySheet({
  entry,
  month,
  onClose,
  onDelete,
}: {
  entry: ExpenseDTO | null;
  month: ExpenseMonthDTO;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const router = useRouter();
  const { language } = useLanguage();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? "EXPENSE");
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [spentAt, setSpentAt] = useState(
    localInputValue(entry?.spentAt ?? new Date().toISOString()),
  );
  const [categoryId, setCategoryId] = useState<number | null>(entry?.categoryId ?? null);
  const [paidById, setPaidById] = useState<number | null>(entry?.paidById ?? null);
  const [methodId, setMethodId] = useState<number | null>(entry?.methodId ?? null);
  const [note, setNote] = useState(entry?.note ?? "");

  const [splitOpen, setSplitOpen] = useState((entry?.shares.length ?? 0) > 0);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(entry?.splitMethod ?? "EQUAL");
  const [splitWith, setSplitWith] = useState<number[]>(entry?.shares.map((share) => share.personId) ?? []);
  const [exact, setExact] = useState<Record<number, string>>(
    Object.fromEntries((entry?.shares ?? []).map((share) => [share.personId, String(share.amount)])),
  );
  const [units, setUnits] = useState<Record<number, string>>(
    Object.fromEntries((entry?.shares ?? []).map((share) => [share.personId, String(share.shareUnits ?? 1)])),
  );

  const parsedAmount = Number.parseFloat(amount);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const categories = month.categories.filter((category) => category.kind === kind);
  const people = month.people.filter((person) => person.isActive || splitWith.includes(person.id));
  const categoryName = (nameEn: string, nameTa: string | null) =>
    language === "ta" ? (nameTa ?? nameEn) : nameEn;

  // What each person would owe as it stands — the same functions the server
  // will use, so what is shown is what gets stored.
  const preview = useMemo(() => {
    if (!splitOpen || splitWith.length === 0 || !validAmount) return null;
    const amountPaise = toPaise(parsedAmount);
    if (splitMethod === "EQUAL") return allocateEqually(amountPaise, splitWith, paidById);
    if (splitMethod === "SHARES") {
      const weights = new Map(splitWith.map((id) => [id, Math.round(Number(units[id] ?? 1)) || 0]));
      return allocateByShares(amountPaise, weights, paidById);
    }
    return new Map(splitWith.map((id) => [id, toPaise(Number(exact[id] ?? 0) || 0)]));
  }, [splitOpen, splitWith, validAmount, parsedAmount, splitMethod, units, exact, paidById]);

  const assigned = preview ? [...preview.values()].reduce((sum, paise) => sum + paise, 0) : 0;
  const remainder = validAmount ? toPaise(parsedAmount) - assigned : 0;

  const save = () => {
    if (!validAmount) return setError("Enter an amount.");
    if (categoryId === null) return setError("Choose a category.");

    const split: SplitInput =
      splitOpen && splitWith.length > 0
        ? {
            method: splitMethod,
            personIds: splitWith,
            exact: Object.fromEntries(splitWith.map((id) => [id, Number(exact[id] ?? 0) || 0])),
            units: Object.fromEntries(splitWith.map((id) => [id, Math.round(Number(units[id] ?? 1)) || 0])),
          }
        : null;

    const input = {
      kind,
      amount: parsedAmount,
      spentAt: new Date(spentAt).toISOString(),
      categoryId,
      paidById,
      methodId,
      note,
      split,
    };

    startTransition(async () => {
      const result = entry ? await updateExpense(entry.id, input) : await createExpense(input);
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
      open
      onClose={onClose}
      title={entry ? "Edit entry" : kind === "INCOME" ? "Money in" : "New entry"}
      footer={
        <div className="space-y-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="flex h-12 w-full items-center justify-center rounded-ios bg-ios-blue text-[17px] font-semibold text-white active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? "Saving…" : entry ? "Save changes" : "Add entry"}
          </button>
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="h-11 w-full text-[16px] font-medium text-ios-red active:opacity-60"
            >
              Delete entry
            </button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4 pb-3">
        {error ? <p className="text-[14px] text-ios-red">{error}</p> : null}

        <div className="flex gap-2">
          {(["EXPENSE", "INCOME"] as EntryKind[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setKind(option);
                setCategoryId(null);
              }}
              className={`h-10 flex-1 rounded-full text-[15px] font-medium transition active:scale-95 ${
                kind === option
                  ? "bg-ios-blue text-white"
                  : "bg-ios-surface-2 text-ios-label-2 ring-1 ring-inset ring-ios-separator"
              }`}
            >
              {option === "EXPENSE" ? "Money out" : "Money in"}
            </button>
          ))}
        </div>

        <div className="flex items-center rounded-ios bg-ios-surface-2 px-3 ring-1 ring-inset ring-ios-separator focus-within:ring-2 focus-within:ring-ios-blue">
          <span className="text-[22px] font-semibold text-ios-label-2">₹</span>
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            aria-label="Amount"
            className="h-14 w-full bg-transparent px-2 text-[22px] font-semibold tabular-nums outline-none"
          />
        </div>

        <Field label="Category">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Chip
                key={category.id}
                active={categoryId === category.id}
                onClick={() => setCategoryId(category.id)}
              >
                {categoryName(category.nameEn, category.nameTa)}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="When">
          <input
            type="datetime-local"
            value={spentAt}
            onChange={(event) => setSpentAt(event.target.value)}
            aria-label="When"
            className="h-12 w-full rounded-ios bg-ios-surface-2 px-4 text-[16px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
          />
        </Field>

        {people.length > 0 ? (
          <Field label={kind === "INCOME" ? "Received by" : "Paid by"}>
            <div className="flex flex-wrap gap-2">
              {people.map((person) => (
                <Chip
                  key={person.id}
                  active={paidById === person.id}
                  onClick={() => setPaidById(paidById === person.id ? null : person.id)}
                >
                  {person.name}
                </Chip>
              ))}
            </div>
          </Field>
        ) : null}

        {month.methods.length > 0 ? (
          <Field label="How">
            <div className="flex flex-wrap gap-2">
              {month.methods
                .filter((method) => method.isActive || methodId === method.id)
                .map((method) => (
                  <Chip
                    key={method.id}
                    active={methodId === method.id}
                    onClick={() => setMethodId(methodId === method.id ? null : method.id)}
                  >
                    {method.name}
                  </Chip>
                ))}
            </div>
          </Field>
        ) : null}

        <Field label="Note">
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What was it for?"
            aria-label="Note"
            className="h-12 w-full rounded-ios bg-ios-surface-2 px-4 text-[16px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
          />
        </Field>

        {kind === "EXPENSE" && month.people.length > 0 ? (
          <div className="rounded-ios bg-ios-surface-2 p-3 ring-1 ring-inset ring-ios-separator">
            <button
              type="button"
              onClick={() => setSplitOpen((open) => !open)}
              aria-expanded={splitOpen}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="text-[15px] font-medium">Split this</span>
              <span className="text-[14px] font-medium text-ios-blue">
                {splitOpen ? "Not shared" : "Share it"}
              </span>
            </button>

            {splitOpen ? (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {people.map((person) => (
                    <Chip
                      key={person.id}
                      active={splitWith.includes(person.id)}
                      onClick={() =>
                        setSplitWith((current) =>
                          current.includes(person.id)
                            ? current.filter((id) => id !== person.id)
                            : [...current, person.id],
                        )
                      }
                    >
                      {person.name}
                    </Chip>
                  ))}
                </div>

                <div className="flex gap-2">
                  {(Object.keys(SPLIT_LABELS) as SplitMethod[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSplitMethod(option)}
                      className={`h-9 flex-1 rounded-full text-[13px] font-medium transition active:scale-95 ${
                        splitMethod === option
                          ? "bg-ios-blue text-white"
                          : "bg-ios-surface text-ios-label-2 ring-1 ring-inset ring-ios-separator"
                      }`}
                    >
                      {SPLIT_LABELS[option]}
                    </button>
                  ))}
                </div>

                {splitWith.length > 0 ? (
                  <ul className="divide-y divide-ios-separator overflow-hidden rounded-ios bg-ios-surface">
                    {splitWith.map((personId) => {
                      const person = month.people.find((candidate) => candidate.id === personId);
                      const share = preview?.get(personId) ?? 0;
                      return (
                        <li key={personId} className="flex items-center gap-3 px-3.5 py-2.5">
                          <span className="min-w-0 flex-1 truncate text-[15px]">
                            {person?.name ?? "Someone"}
                          </span>
                          {splitMethod === "EXACT" ? (
                            <input
                              inputMode="decimal"
                              value={exact[personId] ?? ""}
                              onChange={(event) =>
                                setExact((current) => ({ ...current, [personId]: event.target.value }))
                              }
                              placeholder="0.00"
                              aria-label={`Amount for ${person?.name ?? "person"}`}
                              className="h-9 w-24 rounded-ios bg-ios-surface-2 px-2 text-right text-[15px] tabular-nums outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
                            />
                          ) : splitMethod === "SHARES" ? (
                            <input
                              inputMode="numeric"
                              value={units[personId] ?? "1"}
                              onChange={(event) =>
                                setUnits((current) => ({ ...current, [personId]: event.target.value }))
                              }
                              aria-label={`Shares for ${person?.name ?? "person"}`}
                              className="h-9 w-16 rounded-ios bg-ios-surface-2 px-2 text-right text-[15px] tabular-nums outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
                            />
                          ) : null}
                          <span className="w-20 flex-none text-right text-[14px] font-semibold tabular-nums text-ios-label-2">
                            {formatPrice(toRupees(share))}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-[13px] text-ios-label-2">Pick who this is shared with.</p>
                )}

                {splitWith.length > 0 && validAmount ? (
                  <p
                    className={`text-[13px] ${
                      remainder === 0 ? "text-ios-label-3" : "text-ios-red"
                    }`}
                  >
                    {remainder === 0
                      ? `Adds up to ${formatPrice(parsedAmount)}.`
                      : remainder > 0
                        ? `${formatPrice(toRupees(remainder))} still unassigned.`
                        : `${formatPrice(toRupees(-remainder))} over the entry.`}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="block pb-1.5 text-[13px] font-medium text-ios-label-2">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-full px-3.5 text-[14px] font-medium transition active:scale-95 ${
        active
          ? "bg-ios-blue text-white"
          : "bg-ios-surface-2 text-ios-label-2 ring-1 ring-inset ring-ios-separator"
      }`}
    >
      {children}
    </button>
  );
}
