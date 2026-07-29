import Link from "next/link";

import { CreateListButton } from "@/components/CreateListButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { listNameFor, monthKeyOf, monthKeyToLabel } from "@/lib/dates";
import { getLists } from "@/lib/queries";
import { formatPrice } from "@/lib/units";
import type { ListSummaryDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<ListSummaryDTO["status"], string> = {
  DRAFT: "bg-ios-surface-2 text-ios-label-2",
  FINALIZED: "bg-ios-blue-soft text-ios-blue",
  COMPLETED: "bg-ios-green-soft text-ios-green",
};

const STATUS_LABELS: Record<ListSummaryDTO["status"], string> = {
  DRAFT: "Draft",
  FINALIZED: "Ready to shop",
  COMPLETED: "Done",
};

export default async function HomePage() {
  const lists = await getLists();
  const currentMonthKey = monthKeyOf();
  const currentList = lists.find((list) => list.monthKey === currentMonthKey) ?? null;
  const past = lists.filter((list) => list.id !== currentList?.id);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 pt-2">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-wide text-ios-label-2">
            {listNameFor()}
          </p>
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">Grocery</h1>
        </div>
        <div className="flex flex-none items-center gap-2">
          <ThemeToggle />
          <CreateListButton
            suggestedName={listNameFor()}
            monthKey={currentMonthKey}
            variant="icon"
          />
        </div>
      </header>

      <section className="ios-card overflow-hidden">
        {currentList ? (
          <Link href={`/lists/${currentList.id}`} className="block active:opacity-70">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] text-ios-label-2">This month</p>
                  <p className="text-[24px] font-semibold tracking-tight">{currentList.name}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${STATUS_STYLES[currentList.status]}`}
                >
                  {STATUS_LABELS[currentList.status]}
                </span>
              </div>

              <Progress
                purchased={currentList.purchasedCount}
                total={currentList.itemCount}
                spent={currentList.totalSpent}
              />
            </div>
          </Link>
        ) : (
          <div className="p-5">
            <p className="text-[13px] text-ios-label-2">This month</p>
            <p className="text-[24px] font-semibold tracking-tight">{listNameFor()}</p>
            <p className="mt-1 text-[15px] text-ios-label-2">
              No list yet. Start one and add items from your master list.
            </p>
            <div className="mt-4">
              <CreateListButton suggestedName={listNameFor()} monthKey={currentMonthKey} />
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between px-1 pb-2">
          <h2 className="text-[20px] font-semibold tracking-tight">Previous lists</h2>
          {past.length > 0 ? (
            <Link href="/history" className="text-[15px] text-ios-blue">
              History
            </Link>
          ) : null}
        </div>

        {past.length === 0 ? (
          <p className="ios-card p-5 text-[15px] text-ios-label-2">
            Finished lists will appear here with what you spent.
          </p>
        ) : (
          <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
            {past.slice(0, 8).map((list) => (
              <li key={list.id}>
                <Link href={`/lists/${list.id}`} className="ios-row active:bg-ios-surface-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-medium">{list.name}</p>
                    <p className="text-[13px] text-ios-label-2">
                      {monthKeyToLabel(list.monthKey)} · {list.itemCount} items
                      {list.totalSpent > 0 ? ` · ${formatPrice(list.totalSpent)}` : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[list.status]}`}
                  >
                    {STATUS_LABELS[list.status]}
                  </span>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Progress({
  purchased,
  total,
  spent,
}: {
  purchased: number;
  total: number;
  spent: number;
}) {
  const percent = total === 0 ? 0 : Math.round((purchased / total) * 100);

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between text-[13px] text-ios-label-2">
        <span>
          {purchased} of {total} bought
        </span>
        <span className="tabular-nums">{spent > 0 ? formatPrice(spent) : `${percent}%`}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-ios-surface-2">
        <div
          className="h-full rounded-full bg-ios-blue transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none text-ios-label-3" aria-hidden>
      <path
        d="M9 5l7 7-7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
