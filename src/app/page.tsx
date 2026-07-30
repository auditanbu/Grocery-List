import Link from "next/link";

import { AdminLoginButton } from "@/components/AdminLoginButton";
import { CreateListButton } from "@/components/CreateListButton";
import { ListRow } from "@/components/home/ListRow";
import { ThisMonthCard } from "@/components/home/ThisMonthCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { listNameFor, monthKeyOf } from "@/lib/dates";
import { getLists } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const lists = await getLists();
  const currentMonthKey = monthKeyOf();
  const currentLists = lists.filter((list) => list.monthKey === currentMonthKey);
  const past = lists.filter((list) => list.monthKey !== currentMonthKey);

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
          <AdminLoginButton />
          <ThemeToggle />
          <CreateListButton
            suggestedName={listNameFor()}
            monthKey={currentMonthKey}
            variant="icon"
          />
        </div>
      </header>

      <section className="space-y-3">
        <p className="px-1 text-[13px] text-ios-label-2">This month</p>
        {currentLists.length === 0 ? (
          <div className="ios-card p-5">
            <p className="text-[24px] font-semibold tracking-tight">{listNameFor()}</p>
            <p className="mt-1 text-[15px] text-ios-label-2">
              No list yet. Start one and add items from your master list.
            </p>
            <div className="mt-4">
              <CreateListButton suggestedName={listNameFor()} monthKey={currentMonthKey} />
            </div>
          </div>
        ) : (
          currentLists.map((list) => <ThisMonthCard key={list.id} list={list} />)
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
                <ListRow list={list} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
