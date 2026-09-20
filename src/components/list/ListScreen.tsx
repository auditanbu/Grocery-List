"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { CategoryIcon, FilterMenu, ShopIcon, type FilterOption } from "@/components/FilterMenu";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SegmentedControl } from "@/components/SegmentedControl";
import { DraftEditor } from "@/components/list/DraftEditor";
import { ExportPdfButton } from "@/components/list/ExportPdfButton";
import { FinalizedList } from "@/components/list/FinalizedList";
import { ShoppingView } from "@/components/list/ShoppingView";
import { reopenList } from "@/lib/actions";
import { formatIsoDate, monthKeyToLabel } from "@/lib/dates";
import { useLanguage } from "@/lib/language";
import type { CategoryDTO, ListDetailDTO } from "@/lib/types";

type ListScreenProps = {
  list: ListDetailDTO;
  /** Master categories — needed to create an item from the shopping view. */
  categories: CategoryDTO[];
};

type Mode = "list" | "shopping";

const STATUS_LABEL = {
  DRAFT: "Draft",
  FINALIZED: "Finalized",
  COMPLETED: "Completed",
} as const;

export function ListScreen({ list, categories }: ListScreenProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const [mode, setMode] = useState<Mode>(list.status === "COMPLETED" ? "shopping" : "list");
  const [shopId, setShopId] = useState<number | null | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  // A completed list is a record, not a worksheet: it opens read-only and the
  // "Edit" button unlocks it for this visit only. Nothing is written, and the
  // list keeps its COMPLETED status either way.
  const isCompleted = list.status === "COMPLETED";
  const [unlocked, setUnlocked] = useState(false);
  const editable = !isCompleted || unlocked;

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

  // Shop first, then category, so the category counts describe what the shop
  // filter has already left on screen.
  const shopItems = useMemo(
    () => (shopId === undefined ? list.items : list.items.filter((item) => item.shopId === shopId)),
    [list.items, shopId],
  );

  const categoryOptions = useMemo(() => {
    const counts = new Map<number, { name: string; count: number }>();
    for (const item of shopItems) {
      const name =
        language === "ta" ? (item.categoryNameTa ?? item.categoryName) : item.categoryName;
      const entry = counts.get(item.categoryId) ?? { name, count: 0 };
      entry.count += 1;
      counts.set(item.categoryId, entry);
    }
    return [...counts.entries()]
      .map(([id, value]) => ({ id, name: value.name, count: value.count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [shopItems, language]);

  const visibleItems = useMemo(
    () =>
      categoryId === undefined
        ? shopItems
        : shopItems.filter((item) => item.categoryId === categoryId),
    [shopItems, categoryId],
  );

  const selectedShopName =
    shopId === undefined ? null : (shopOptions.find((option) => option.id === shopId)?.name ?? null);

  const shopFilterOptions: FilterOption<number | null | undefined>[] = [
    { key: "all", label: "All shops", value: undefined, count: list.items.length },
    ...shopOptions.map((option) => ({
      key: String(option.id ?? "none"),
      label: option.name,
      value: option.id,
      count: option.count,
    })),
  ];

  const categoryFilterOptions: FilterOption<number | undefined>[] = [
    { key: "all", label: "All categories", value: undefined, count: shopItems.length },
    ...categoryOptions.map((option) => ({
      key: String(option.id),
      label: option.name,
      value: option.id,
      count: option.count,
    })),
  ];

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
        {/* Back link and actions share the top row so the list name below gets
            the full width — with five controls it otherwise wraps into them. */}
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/grocery"
            className="inline-flex min-w-0 items-center gap-1 text-[15px] text-ios-blue"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none" aria-hidden>
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

          <div className="flex flex-none items-center gap-1.5">
            {/* Filters live as icons up here rather than as chip rows over the
                list. Drafts are excluded — DraftEditor carries its own. */}
            {!isDraft ? (
              <>
                <FilterMenu
                  label="Shop"
                  icon={<ShopIcon />}
                  options={shopFilterOptions}
                  value={shopId}
                  defaultValue={undefined}
                  onChange={setShopId}
                />
                <FilterMenu
                  label="Category"
                  icon={<CategoryIcon />}
                  options={categoryFilterOptions}
                  value={categoryId}
                  defaultValue={undefined}
                  onChange={setCategoryId}
                />
              </>
            ) : null}
            {mode === "list" && list.status === "FINALIZED" ? (
              <ExportPdfButton
                listName={list.name}
                shopName={selectedShopName}
                // The PDF is the sheet you carry to one shop, so it ignores the
                // category filter — a half-printed list is never the intent.
                items={shopItems}
                groupByShop={!selectedShopName}
                language={language}
                variant="icon"
              />
            ) : null}
            <LanguageToggle />
            {list.status === "FINALIZED" ? (
              <button
                type="button"
                onClick={reopen}
                disabled={pending}
                className="h-9 flex-none rounded-full bg-ios-surface px-3.5 text-[14px] font-medium text-ios-blue shadow-ios active:scale-95 disabled:opacity-50"
              >
                Reopen
              </button>
            ) : null}
            {isCompleted ? (
              <button
                type="button"
                onClick={() => setUnlocked((current) => !current)}
                className={`h-9 flex-none rounded-full px-3.5 text-[14px] font-medium shadow-ios transition active:scale-95 ${
                  unlocked ? "bg-ios-blue text-white" : "bg-ios-surface text-ios-blue"
                }`}
              >
                {unlocked ? "Done" : "Edit"}
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <h1 className="text-[30px] font-bold leading-tight tracking-tight">{list.name}</h1>
          <p className="text-[13px] text-ios-label-2">
            {monthKeyToLabel(list.monthKey)} · {STATUS_LABEL[list.status]} · {list.itemCount} items
          </p>
          <p className="text-[12px] text-ios-label-3">
            Made {formatIsoDate(list.createdAt)}
            {list.purchasedAt ? ` · Shopped ${formatIsoDate(list.purchasedAt)}` : ""}
          </p>
        </div>
      </header>

      {isDraft ? (
        <DraftEditor list={list} />
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

          {mode === "list" ? (
            <FinalizedList items={visibleItems} shopName={selectedShopName} />
          ) : (
            <ShoppingView
              list={list}
              items={visibleItems}
              categories={categories}
              editable={editable}
              categoryFiltered={categoryId !== undefined}
            />
          )}
        </>
      )}
    </div>
  );
}
