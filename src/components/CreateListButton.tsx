"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Sheet } from "@/components/Sheet";
import { createList } from "@/lib/actions";

type CreateListButtonProps = {
  /** Pre-filled `MMM YYYY` name, e.g. "Jul 2026". */
  suggestedName: string;
  /** "YYYY-MM" for the month being created. */
  monthKey: string;
  variant?: "primary" | "plain";
};

export function CreateListButton({
  suggestedName,
  monthKey,
  variant = "primary",
}: CreateListButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggestedName);
  const [month, setMonth] = useState(monthKey);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await createList({ name, monthKey: month });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.push(`/lists/${result.data.id}`);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "primary"
            ? "flex h-12 w-full items-center justify-center rounded-ios bg-ios-blue text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-90"
            : "text-[17px] font-medium text-ios-blue active:opacity-60"
        }
      >
        New list
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="New monthly list"
        subtitle="The name is suggested from the month — change it if you like."
        footer={
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="flex h-12 w-full items-center justify-center rounded-ios bg-ios-blue text-[17px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create list"}
          </button>
        }
      >
        <div className="space-y-4 pb-2">
          <label className="block">
            <span className="text-[13px] font-medium text-ios-label-2">List name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={suggestedName}
              className="mt-1.5 h-12 w-full rounded-ios bg-ios-surface-2 px-4 text-[17px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
            />
          </label>

          <label className="block">
            <span className="text-[13px] font-medium text-ios-label-2">Month</span>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="mt-1.5 h-12 w-full rounded-ios bg-ios-surface-2 px-4 text-[17px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
            />
            <span className="mt-1.5 block text-[13px] text-ios-label-2">
              One list per month. Picking a month that already has a list opens it instead.
            </span>
          </label>

          {error ? <p className="text-[14px] text-ios-red">{error}</p> : null}
        </div>
      </Sheet>
    </>
  );
}
