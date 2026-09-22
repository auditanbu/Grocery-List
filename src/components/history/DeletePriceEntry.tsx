"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { deletePriceEntry } from "@/lib/actions";
import { useAdmin } from "@/lib/admin-context";

/**
 * Removes one price from an item's history.
 *
 * Admin-only and confirmed, like the other destructive controls: price
 * history is what every comparison is read off, so a row should only ever
 * leave it on purpose. What it is for is the leftovers — a price typed
 * while trying the app out, which otherwise sits in "biggest price moves"
 * forever pretending to be a real move.
 */
export function DeletePriceEntry({ entryId, label }: { entryId: number; label: string }) {
  const { isAdmin } = useAdmin();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!isAdmin) return null;

  const remove = () => {
    if (!window.confirm(`Delete ${label} from this item's price history? This can't be undone.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deletePriceEntry(entryId);
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      aria-label={`Delete ${label}`}
      title={`Delete ${label}`}
      className="-mr-1 flex h-8 w-8 flex-none items-center justify-center rounded-full text-ios-red transition active:scale-95 disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
        <path
          d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7m-7 0 .8 11.1A2 2 0 0 0 9.8 20h4.4a2 2 0 0 0 2-1.9L17 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
