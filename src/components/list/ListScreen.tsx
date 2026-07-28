"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { SegmentedControl } from "@/components/SegmentedControl";
import { DraftEditor } from "@/components/list/DraftEditor";
import { FinalizedList } from "@/components/list/FinalizedList";
import { ShopFilter } from "@/components/list/ShopFilter";
import { ShoppingView } from "@/components/list/ShoppingView";
import { reopenList } from "@/lib/actions";
import { monthKeyToLabel } from "@/lib/dates";
import type { ListDetailDTO, MasterItemDTO } from "@/lib/types";

type ListScreenProps = {
  list: ListDetailDTO;
  masterItems: MasterItemDTO[];
};

type Mode = "list" | "shopping";

const STATUS_LABEL = {
  DRAFT: "Draft",
  FINALIZED: "Finalized",
  COMPLETED: "Completed",
} as const;

export function ListScreen({ list, masterItems }: ListScreenProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(list.status === "COMPLETED" ? "shopping" : "list");
  const [shopId, setShopId] = useState<number | null | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  const shopOptions = useMemo(() => {
    const counts = new Map<number | null, { name: string; count: number }>();
    for (const item of list.items) {
      const key = item.shopId;
      const entry = counts.get(key) ?? { name: item.shopName ?? "Not set", count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
    return [...counts.entries()]
      .map(([id, value]) => ({ id, name: value.name, count: value.count }))
      .sort((a, b) => {
        if (a.id === null) return 1;
        if (b.id === null) return -1;
        return a.name.localeCompare(b.name);
      });
  }, [list.items]);

  const visibleItems = useMemo(
    () => (shopId === undefined ? list.items : list.items.filter((item) => item.shopId === shopId)),
    [list.items, shopId],
  );

  const selectedShopName =
    shopId === undefined ? null : (shopOptions.find((option) => option.id === shopId)?.name ?? null);

  const reopen = () => {
    startTransition(async () => {
      await reopenList(list.id);
      router.refresh();
    });
  };

  const isDraft = list.status === "DRAFT";

  return (
    <div className="space-y-5">
      <header className="space-y-3 pt-1">
        <Link href="/" className="inline-flex items-center gap-1 text-[15px] text-ios-blue">
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path
              d="M15 5l-7 7 7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Lists
        </Link>

        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-[30px] font-bold leading-tight tracking-tight">{list.name}</h1>
            <p className="text-[13px] text-ios-label-2">
              {monthKeyToLabel(list.monthKey)} · {STATUS_LABEL[list.status]} · {list.itemCount}{" "}
              items
            </p>
          </div>
          {!isDraft ? (
            <button
              type="button"
              onClick={reopen}
              disabled={pending}
              className="h-9 flex-none rounded-full bg-ios-surface px-4 text-[14px] font-medium text-ios-blue shadow-ios active:scale-95 disabled:opacity-50"
            >
              Edit list
            </button>
          ) : null}
        </div>
      </header>

      {isDraft ? (
        <DraftEditor list={list} masterItems={masterItems} />
      ) : (
        <>
          <SegmentedControl
            options={[
              { value: "list" as const, label: "List" },
              {
                value: "shopping" as const,
                label: "Shopping",
                badge: list.itemCount - list.purchasedCount,
              },
            ]}
            value={mode}
            onChange={setMode}
          />

          <ShopFilter
            options={shopOptions}
            value={shopId}
            onChange={setShopId}
            total={list.items.length}
          />

          {mode === "list" ? (
            <FinalizedList list={list} items={visibleItems} shopName={selectedShopName} />
          ) : (
            <ShoppingView list={list} items={visibleItems} />
          )}
        </>
      )}
    </div>
  );
}
