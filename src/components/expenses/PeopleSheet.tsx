"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Sheet } from "@/components/Sheet";
import {
  removeExpenseCategory,
  removePaymentMethod,
  removePerson,
  upsertExpenseCategory,
  upsertPaymentMethod,
  upsertPerson,
} from "@/lib/expenses/actions";
import { useAdmin } from "@/lib/admin-context";
import { useLanguage } from "@/lib/language";
import type { EntryKind, ExpenseMonthDTO } from "@/lib/expenses/types";

/**
 * The module's own short list of people, and the payment methods beside it.
 *
 * Admin-only, like every other change to shared vocabulary: a renamed person
 * reaches every balance they are part of. Somebody who has already paid for
 * something is hidden rather than deleted — see removePerson.
 */
export function PeopleSheet({
  open,
  month,
  onClose,
}: {
  open: boolean;
  month: ExpenseMonthDTO;
  onClose: () => void;
}) {
  const router = useRouter();
  const { isAdmin } = useAdmin();
  const { language } = useLanguage();
  const [personName, setPersonName] = useState("");
  const [methodName, setMethodName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryKind, setCategoryKind] = useState<EntryKind>("EXPENSE");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const categoryLabel = (nameEn: string, nameTa: string | null) =>
    language === "ta" ? (nameTa ?? nameEn) : nameEn;

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "That didn't work.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <Sheet open={open} onClose={onClose} title="People, categories & methods">
      <div className="space-y-5 pb-3">
        {error ? <p className="text-[14px] text-ios-red">{error}</p> : null}

        <section>
          <p className="pb-1.5 text-[13px] font-medium text-ios-label-2">
            Categories — what an entry is filed under
          </p>
          {month.categories.length === 0 ? (
            <p className="rounded-ios bg-ios-surface-2 px-4 py-3 text-[14px] text-ios-label-2">
              No categories yet. Add the first one below — anyone can.
            </p>
          ) : (
            <ul className="divide-y divide-ios-separator overflow-hidden rounded-ios bg-ios-surface-2">
              {month.categories.map((category) => (
                <li
                  key={category.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-[15px]">
                    {categoryLabel(category.nameEn, category.nameTa)}
                  </span>
                  <span className="flex-none rounded-full bg-ios-surface px-2 py-0.5 text-[11px] font-medium text-ios-label-3 ring-1 ring-inset ring-ios-separator">
                    {category.kind === "INCOME" ? "Income" : "Expense"}
                  </span>
                  {isAdmin ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm(`Remove "${category.nameEn}"?`))
                          return;
                        run(() => removeExpenseCategory(category.id));
                      }}
                      className="h-8 flex-none rounded-full px-3 text-[13px] font-medium text-ios-red active:opacity-60"
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 space-y-2">
            <div className="flex gap-2">
              {(["EXPENSE", "INCOME"] as EntryKind[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCategoryKind(option)}
                  className={`h-9 flex-1 rounded-full text-[13px] font-medium transition active:scale-95 ${
                    categoryKind === option
                      ? "bg-ios-blue text-white"
                      : "bg-ios-surface-2 text-ios-label-2 ring-1 ring-inset ring-ios-separator"
                  }`}
                >
                  {option === "EXPENSE" ? "For money out" : "For money in"}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="Add a category"
                aria-label="Add a category"
                className="h-11 min-w-0 flex-1 rounded-ios bg-ios-surface-2 px-4 text-[16px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
              />
              <button
                type="button"
                disabled={pending || !categoryName.trim()}
                onClick={() =>
                  run(async () => {
                    const result = await upsertExpenseCategory({
                      nameEn: categoryName,
                      kind: categoryKind,
                    });
                    if (result.ok) setCategoryName("");
                    return result;
                  })
                }
                className="h-11 flex-none rounded-ios bg-ios-blue px-4 text-[15px] font-semibold text-white active:scale-95 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </section>

        <section>
          <p className="pb-1.5 text-[13px] font-medium text-ios-label-2">
            People — who pays, and who shares
          </p>
          {month.people.length === 0 ? (
            <p className="rounded-ios bg-ios-surface-2 px-4 py-3 text-[14px] text-ios-label-2">
              Nobody added yet. Add the two or three people who actually share
              costs — this list is separate from the family tree.
            </p>
          ) : (
            <ul className="divide-y divide-ios-separator overflow-hidden rounded-ios bg-ios-surface-2">
              {month.people.map((person) => (
                <li
                  key={person.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <span
                    className={`min-w-0 flex-1 truncate text-[15px] ${
                      person.isActive ? "" : "text-ios-label-3 line-through"
                    }`}
                  >
                    {person.name}
                  </span>
                  {isAdmin ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm(`Remove ${person.name}?`)) return;
                        run(() => removePerson(person.id));
                      }}
                      className="h-8 flex-none rounded-full px-3 text-[13px] font-medium text-ios-red active:opacity-60"
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {isAdmin ? (
            <div className="mt-2 flex gap-2">
              <input
                value={personName}
                onChange={(event) => setPersonName(event.target.value)}
                placeholder="Add a person"
                aria-label="Add a person"
                className="h-11 min-w-0 flex-1 rounded-ios bg-ios-surface-2 px-4 text-[16px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
              />
              <button
                type="button"
                disabled={pending || !personName.trim()}
                onClick={() =>
                  run(async () => {
                    const result = await upsertPerson({ name: personName });
                    if (result.ok) setPersonName("");
                    return result;
                  })
                }
                className="h-11 flex-none rounded-ios bg-ios-blue px-4 text-[15px] font-semibold text-white active:scale-95 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          ) : null}
        </section>

        <section>
          <p className="pb-1.5 text-[13px] font-medium text-ios-label-2">
            Payment methods — a label, not an account
          </p>
          <ul className="divide-y divide-ios-separator overflow-hidden rounded-ios bg-ios-surface-2">
            {month.methods.map((method) => (
              <li
                key={method.id}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <span
                  className={`min-w-0 flex-1 truncate text-[15px] ${
                    method.isActive ? "" : "text-ios-label-3 line-through"
                  }`}
                >
                  {method.name}
                </span>
                {isAdmin ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(`Remove ${method.name}?`)) return;
                      run(() => removePaymentMethod(method.id));
                    }}
                    className="h-8 flex-none rounded-full px-3 text-[13px] font-medium text-ios-red active:opacity-60"
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          {isAdmin ? (
            <div className="mt-2 flex gap-2">
              <input
                value={methodName}
                onChange={(event) => setMethodName(event.target.value)}
                placeholder="Add a method"
                aria-label="Add a payment method"
                className="h-11 min-w-0 flex-1 rounded-ios bg-ios-surface-2 px-4 text-[16px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
              />
              <button
                type="button"
                disabled={pending || !methodName.trim()}
                onClick={() =>
                  run(async () => {
                    const result = await upsertPaymentMethod({
                      name: methodName,
                    });
                    if (result.ok) setMethodName("");
                    return result;
                  })
                }
                className="h-11 flex-none rounded-ios bg-ios-blue px-4 text-[15px] font-semibold text-white active:scale-95 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          ) : null}
        </section>

        {isAdmin ? null : (
          <p className="text-[12px] text-ios-label-3">
            Sign in as admin to add or remove people and methods.
          </p>
        )}
      </div>
    </Sheet>
  );
}
