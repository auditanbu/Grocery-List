"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Sheet } from "@/components/Sheet";
import {
  createExpense,
  updateExpense,
  upsertExpenseCategory,
  type SplitInput,
} from "@/lib/expenses/actions";
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

/** How many category pills show before the rest fold behind the arrow. */
const VISIBLE_CATEGORY_COUNT = 3;
const RECENT_CATEGORIES_KEY = "grocery.expenseCategoryRecents";

/** Most-recently-used category ids, kept separately per entry kind. */
function loadRecentCategoryIds(kind: EntryKind): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_CATEGORIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<Record<EntryKind, number[]>>;
    return Array.isArray(parsed[kind]) ? (parsed[kind] as number[]) : [];
  } catch {
    return [];
  }
}

function saveRecentCategoryIds(kind: EntryKind, ids: number[]): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(RECENT_CATEGORIES_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Record<EntryKind, number[]>>) : {};
    window.localStorage.setItem(RECENT_CATEGORIES_KEY, JSON.stringify({ ...parsed, [kind]: ids }));
  } catch {
    // Best-effort — a missed write just means recency resets next time.
  }
}

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
  defaultTripId,
}: {
  entry: ExpenseDTO | null;
  month: ExpenseMonthDTO;
  onClose: () => void;
  onDelete?: () => void;
  /** Preselects a trip (and its equal split) on a brand-new entry — how the
   *  trip page's own "Add expense" button opens this sheet already in
   *  context, rather than making you pick the trip you are already inside. */
  defaultTripId?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // The amount is the first thing you type on every entry, so the caret
  // should already be sitting there when the sheet finishes its slide-in —
  // an effect + ref outlasts the entrance animation more reliably than the
  // plain `autoFocus` attribute does on its own.
  const amountInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? "EXPENSE");
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [spentAt, setSpentAt] = useState(
    localInputValue(entry?.spentAt ?? new Date().toISOString()),
  );
  const [categoryId, setCategoryId] = useState<number | null>(entry?.categoryId ?? null);
  const [paidById, setPaidById] = useState<number | null>(entry?.paidById ?? null);
  const [methodId, setMethodId] = useState<number | null>(entry?.methodId ?? null);
  const [note, setNote] = useState(entry?.note ?? "");
  const [tripId, setTripId] = useState<number | null>(entry?.tripId ?? defaultTripId ?? null);

  const defaultTrip = !entry && defaultTripId !== undefined
    ? month.openTrips.find((trip) => trip.id === defaultTripId)
    : undefined;
  const [splitOpen, setSplitOpen] = useState((entry?.shares.length ?? 0) > 0 || defaultTrip !== undefined);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(entry?.splitMethod ?? "EQUAL");
  const [splitWith, setSplitWith] = useState<number[]>(
    entry?.shares.map((share) => share.personId) ?? defaultTrip?.participantIds ?? [],
  );
  const [exact, setExact] = useState<Record<number, string>>(
    Object.fromEntries((entry?.shares ?? []).map((share) => [share.personId, String(share.amount)])),
  );
  const [units, setUnits] = useState<Record<number, string>>(
    Object.fromEntries((entry?.shares ?? []).map((share) => [share.personId, String(share.shareUnits ?? 1)])),
  );

  const parsedAmount = Number.parseFloat(amount);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  // What was added from this sheet, shown at once rather than after the
  // refresh brings it back in `month` — and kept if the refresh is slow.
  const [addedCategories, setAddedCategories] = useState<ExpenseMonthDTO["categories"]>([]);
  const categories = [
    ...month.categories,
    ...addedCategories.filter((added) => !month.categories.some((c) => c.id === added.id)),
  ].filter((category) => category.kind === kind);
  const people = month.people.filter((person) => person.isActive || splitWith.includes(person.id));

  // Recently used categories lead the row, so the ones you actually pick
  // most weeks don't hide behind a scroll or an alphabetical accident.
  const [recentCategoryIds, setRecentCategoryIds] = useState<number[]>(() => loadRecentCategoryIds(kind));
  useEffect(() => {
    setRecentCategoryIds(loadRecentCategoryIds(kind));
  }, [kind]);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);

  const orderedCategories = useMemo(() => {
    const byId = new Map(categories.map((category) => [category.id, category] as const));
    const recent = recentCategoryIds
      .map((id) => byId.get(id))
      .filter((category): category is (typeof categories)[number] => category !== undefined);
    const seen = new Set(recent.map((category) => category.id));
    return [...recent, ...categories.filter((category) => !seen.has(category.id))];
  }, [categories, recentCategoryIds]);

  const selectedCategoryIndex = categoryId === null
    ? -1
    : orderedCategories.findIndex((category) => category.id === categoryId);
  // Never hide the category that's actually selected behind the fold.
  const categoriesShown = categoriesExpanded || selectedCategoryIndex >= VISIBLE_CATEGORY_COUNT;
  const visibleCategories = categoriesShown
    ? orderedCategories
    : orderedCategories.slice(0, VISIBLE_CATEGORY_COUNT);
  const hasMoreCategories = orderedCategories.length > VISIBLE_CATEGORY_COUNT;

  const markRecentCategory = (id: number) => {
    setRecentCategoryIds((current) => {
      const next = [id, ...current.filter((existing) => existing !== id)].slice(0, 8);
      saveRecentCategoryIds(kind, next);
      return next;
    });
  };
  const selectCategory = (id: number) => {
    setCategoryId(id);
    markRecentCategory(id);
  };

  // Picking a trip is the "split this equally" gesture: it opens the split
  // and sets it to the trip's whole roster, equally, which is what makes
  // "add expenses, split the trip equally at the end" true without a
  // second kind of arithmetic — see ExpenseTrip in schema.prisma. Still
  // editable afterwards for the one person who skipped a meal.
  const chooseTrip = (id: number | null) => {
    setTripId(id);
    if (id === null) return;
    const trip = month.openTrips.find((candidate) => candidate.id === id);
    if (!trip) return;
    setSplitOpen(true);
    setSplitMethod("EQUAL");
    setSplitWith(trip.participantIds);
  };
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

  const addCategory = () => {
    const nameEn = newCategoryName.trim();
    if (!nameEn) return;
    setError(null);
    startTransition(async () => {
      const result = await upsertExpenseCategory({ nameEn, kind });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAddedCategories((current) => [
        ...current,
        { id: result.data.id, nameEn, nameTa: null, kind, budget: null },
      ]);
      setCategoryId(result.data.id);
      markRecentCategory(result.data.id);
      setNewCategoryName("");
      setNewCategoryOpen(false);
      router.refresh();
    });
  };

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
      tripId: kind === "EXPENSE" ? tripId : null,
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
            ref={amountInputRef}
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
          <div className="flex flex-wrap items-center gap-2">
            {visibleCategories.map((category) => (
              <Chip
                key={category.id}
                active={categoryId === category.id}
                onClick={() => selectCategory(category.id)}
              >
                {category.nameEn}
              </Chip>
            ))}
            {hasMoreCategories ? (
              <button
                type="button"
                onClick={() => setCategoriesExpanded((current) => !current)}
                aria-expanded={categoriesShown}
                aria-label={categoriesShown ? "Show fewer categories" : "Show more categories"}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ios-surface-2 text-ios-label-2 ring-1 ring-inset ring-ios-separator transition active:scale-95"
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`h-4 w-4 transition-transform ${categoriesShown ? "rotate-180" : ""}`}
                  aria-hidden
                >
                  <path
                    d="M6 9l6 6 6-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : null}
            {newCategoryOpen ? null : (
              <Chip active={false} onClick={() => setNewCategoryOpen(true)}>
                + New
              </Chip>
            )}
          </div>
          {categories.length === 0 && !newCategoryOpen ? (
            <p className="pt-1.5 text-[13px] text-ios-label-3">
              No categories yet — tap + New to make one.
            </p>
          ) : null}
          {newCategoryOpen ? (
            <div className="mt-2 flex gap-2">
              <input
                autoFocus
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCategory();
                  }
                }}
                placeholder={kind === "INCOME" ? "e.g. Rent received" : "e.g. Petrol for trip"}
                aria-label="New category name"
                className="h-11 min-w-0 flex-1 rounded-ios bg-ios-surface-2 px-4 text-[16px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
              />
              <button
                type="button"
                disabled={pending || !newCategoryName.trim()}
                onClick={addCategory}
                className="h-11 flex-none rounded-ios bg-ios-blue px-4 text-[15px] font-semibold text-white active:scale-95 disabled:opacity-50"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewCategoryOpen(false);
                  setNewCategoryName("");
                }}
                className="h-11 flex-none px-2 text-[15px] text-ios-blue active:opacity-60"
              >
                Cancel
              </button>
            </div>
          ) : null}
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

        {kind === "EXPENSE" && (month.openTrips.length > 0 || entry?.tripName) ? (
          <Field label="Trip">
            <div className="flex flex-wrap gap-2">
              {entry?.tripId && !month.openTrips.some((trip) => trip.id === entry.tripId) ? (
                // A closed trip the entry already belongs to: shown so it
                // isn't silently dropped by editing, but not selectable —
                // the trip picker only offers still-open trips.
                <Chip active onClick={() => chooseTrip(entry.tripId as number)}>
                  {entry.tripName} (closed)
                </Chip>
              ) : null}
              {month.openTrips.map((trip) => (
                <Chip key={trip.id} active={tripId === trip.id} onClick={() => chooseTrip(trip.id)}>
                  {trip.name}
                </Chip>
              ))}
              {tripId !== null ? (
                <Chip active={false} onClick={() => chooseTrip(null)}>
                  Not a trip
                </Chip>
              ) : null}
            </div>
            {tripId !== null ? (
              <p className="pt-1.5 text-[12px] text-ios-label-3">
                Split equally across the trip below — adjust it if someone wasn&apos;t in on this one.
              </p>
            ) : null}
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
