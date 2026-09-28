"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Sheet } from "@/components/Sheet";
import { createTrip } from "@/lib/expenses/actions";
import type { ExpensePersonDTO } from "@/lib/expenses/types";

/**
 * Starts a trip: a name and a fixed roster. The roster is what every
 * expense logged under the trip defaults to splitting equally across — see
 * EntrySheet — so it is asked up front rather than per expense.
 */
export function NewTripSheet({
  open,
  people,
  onClose,
}: {
  open: boolean;
  people: ExpensePersonDTO[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [participantIds, setParticipantIds] = useState<number[]>(
    people.filter((person) => person.isActive).map((person) => person.id),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const result = await createTrip({ name, participantIds });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      onClose();
      router.refresh();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New trip"
      subtitle="A named pot of expenses, split equally across whoever's on it."
      footer={
        <button
          type="button"
          onClick={save}
          disabled={pending || !name.trim() || participantIds.length === 0}
          className="flex h-12 w-full items-center justify-center rounded-ios bg-ios-blue text-[17px] font-semibold text-white active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create trip"}
        </button>
      }
    >
      <div className="space-y-4 pb-3">
        {error ? <p className="text-[14px] text-ios-red">{error}</p> : null}

        <div>
          <span className="block pb-1.5 text-[13px] font-medium text-ios-label-2">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Goa trip"
            aria-label="Trip name"
            className="h-12 w-full rounded-ios bg-ios-surface-2 px-4 text-[16px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
          />
        </div>

        <div>
          <span className="block pb-1.5 text-[13px] font-medium text-ios-label-2">Who&apos;s on it</span>
          {people.length === 0 ? (
            <p className="text-[13px] text-ios-label-2">
              Add people first, from the people icon on the Expenses screen.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {people.map((person) => {
                const active = participantIds.includes(person.id);
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() =>
                      setParticipantIds((current) =>
                        current.includes(person.id)
                          ? current.filter((id) => id !== person.id)
                          : [...current, person.id],
                      )
                    }
                    className={`h-9 rounded-full px-3.5 text-[14px] font-medium transition active:scale-95 ${
                      active
                        ? "bg-ios-blue text-white"
                        : "bg-ios-surface-2 text-ios-label-2 ring-1 ring-inset ring-ios-separator"
                    }`}
                  >
                    {person.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
