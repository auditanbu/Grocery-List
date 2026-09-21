"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  CartIcon,
  CategoryIcon,
  CheckIcon,
  FilterMenu,
  PencilIcon,
  ReopenIcon,
  ShopIcon,
  type FilterOption,
} from "@/components/FilterMenu";
import { LanguageToggle } from "@/components/LanguageToggle";
import { DraftEditor } from "@/components/list/DraftEditor";
import { ExportPdfButton } from "@/components/list/ExportPdfButton";
import { FinalizedList } from "@/components/list/FinalizedList";
import { ListSearchBar } from "@/components/list/ListSearchBar";
import { ShopAddSheet } from "@/components/list/ShopAddSheet";
import { ShoppingView } from "@/components/list/ShoppingView";
import { reopenList } from "@/lib/actions";
import { formatIsoDate, monthKeyToLabel } from "@/lib/dates";
import { useLanguage } from "@/lib/language";
import { formatPrice } from "@/lib/units";
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

/** The shared 36px circle every header control uses. */
const ICON_BUTTON =
  "flex h-9 w-9 flex-none items-center justify-center rounded-full shadow-ios transition active:scale-95";

export function ListScreen({ list, categories }: ListScreenProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const [mode, setMode] = useState<Mode>(list.status === "COMPLETED" ? "shopping" : "list");
  const [shopId, setShopId] = useState<number | null | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // A completed list is a record, not a worksheet: it opens read-only and the
  // "Edit" button unlocks it for this visit only. Nothing is written, and the
  // list keeps its COMPLETED status either way.
  const isCompleted = list.status === "COMPLETED";
  const [unlocked, setUnlocked] = useState(false);
  const editable = !isCompleted || unlocked;
  const isDraft = list.status === "DRAFT";

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

  // Shop, then category, then search. Each stage's counts describe what the
  // stage before it left on screen.
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

  const categoryItems = useMemo(
    () =>
      categoryId === undefined
        ? shopItems
        : shopItems.filter((item) => item.categoryId === categoryId),
    [shopItems, categoryId],
  );

  const visibleItems = useMemo(() => {
    const trimmed = query.trim();
    const needle = trimmed.toLowerCase();
    if (!needle) return categoryItems;
    return categoryItems.filter(
      (item) =>
        item.nameEn.toLowerCase().includes(needle) ||
        item.nameTa.includes(trimmed) ||
        (item.nameTl ?? "").toLowerCase().includes(needle) ||
        item.categoryName.toLowerCase().includes(needle) ||
        (item.categoryNameTa ?? "").includes(trimmed) ||
        (item.shopName ?? "").toLowerCase().includes(needle),
    );
  }, [categoryItems, query]);

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

  // Shopping progress, for the compact readout beside the list name.
  const purchasedCount = visibleItems.filter((item) => item.isPurchased).length;
  const spent = visibleItems.reduce((sum, item) => sum + (item.purchasePrice ?? 0), 0);
  const outstanding = list.itemCount - list.purchasedCount;

  const trimmedQuery = query.trim();
  const emptyMessage = trimmedQuery
    ? `Nothing on this list matched “${trimmedQuery}”.`
    : categoryId !== undefined
      ? "No items in this category."
      : shopId !== undefined
        ? "No items for this shop."
        : "This list has no items yet.";

  const reopen = () => {
    startTransition(async () => {
      await reopenList(list.id);
      // The list becomes a draft, the search bar unmounts; a stale query
      // would silently apply if it were finalized again this session.
      setQuery("");
      router.refresh();
    });
  };

  return (
    // Extra bottom padding clears the fixed search bar. Kept here rather than
    // in layout.tsx, which would add dead space to every other page.
    <div className={`space-y-5 ${isDraft ? "" : "pb-16"}`}>
      {/*
        Pinned header: on a 40-item list the filters and the shopping toggle
        are useless if you have to scroll back up for them. Same mechanics as
        the Add items page — z-20 under AppNav (z-30) and Sheet (z-50), the
        -mx-4/px-4 pair spans <main>'s gutter, and the env() margin/padding
        pair cancels the safe-area padding body applies so a pinned header
        clears the notch instead of sliding under it.
      */}
      <header
        className="sticky top-0 z-20 -mx-4 space-y-2 border-b border-ios-separator bg-ios-bg/90 px-4 pb-3 backdrop-blur-xl"
        style={{
          marginTop: "calc(-1 * env(safe-area-inset-top))",
          paddingTop: "calc(env(safe-area-inset-top) + 0.25rem)",
        }}
      >
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

          {/* A FilterMenu grows to ~110px when a filter is on, so the row can
              exceed the width two active filters leave. Scrolling is the
              safety valve: it degrades instead of clipping or wrapping. */}
          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Drafts are excluded — DraftEditor carries its own shop filter. */}
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

            {list.status === "FINALIZED" ? (
              <ExportPdfButton
                listName={list.name}
                shopName={selectedShopName}
                // The PDF is the sheet you carry to one shop, so it follows the
                // shop filter only — never the category filter or the search,
                // either of which would silently half-print the sheet.
                items={shopItems}
                groupByShop={!selectedShopName}
                language={language}
                variant="icon"
              />
            ) : null}

            {!isDraft && mode === "shopping" && editable ? (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                aria-label="Add item"
                title="Add item"
                className={`${ICON_BUTTON} bg-ios-blue text-white`}
              >
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
                  <path
                    d="M12 6v12M6 12h12"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ) : null}

            {/* Replaces the List/Shopping tabs: tap to shop, tap to come back.
                Filled while shopping, and carrying the count the tab's badge
                used to show. */}
            {!isDraft ? (
              <button
                type="button"
                onClick={() => setMode((current) => (current === "list" ? "shopping" : "list"))}
                aria-pressed={mode === "shopping"}
                aria-label={mode === "shopping" ? "Back to list" : "Go shopping"}
                title={mode === "shopping" ? "Back to list" : "Go shopping"}
                className={`relative ${ICON_BUTTON} ${
                  mode === "shopping" ? "bg-ios-blue text-white" : "bg-ios-surface text-ios-blue"
                }`}
              >
                <CartIcon />
                {mode === "list" && outstanding > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ios-red px-1 text-[10px] font-bold leading-none text-white ring-2 ring-ios-bg">
                    {outstanding}
                  </span>
                ) : null}
              </button>
            ) : null}

            <LanguageToggle />

            {list.status === "FINALIZED" ? (
              <button
                type="button"
                onClick={reopen}
                disabled={pending}
                aria-label="Reopen as draft"
                title="Reopen as draft"
                className={`${ICON_BUTTON} bg-ios-surface text-ios-blue disabled:opacity-50`}
              >
                <ReopenIcon />
              </button>
            ) : null}

            {isCompleted ? (
              <button
                type="button"
                onClick={() => {
                  setUnlocked((current) => !current);
                  setAddOpen(false);
                }}
                aria-pressed={unlocked}
                aria-label={unlocked ? "Finish editing" : "Edit this list"}
                title={unlocked ? "Finish editing" : "Edit this list"}
                className={`${ICON_BUTTON} ${
                  unlocked ? "bg-ios-blue text-white" : "bg-ios-surface text-ios-blue"
                }`}
              >
                {unlocked ? <CheckIcon /> : <PencilIcon />}
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 truncate text-[28px] font-bold leading-tight tracking-tight">
            {list.name}
          </h1>
          {mode === "shopping" ? (
            <div className="flex-none pt-1 text-right">
              <p className="text-[15px] font-semibold leading-tight tabular-nums">
                {purchasedCount}
                <span className="text-ios-label-3">/{visibleItems.length}</span>
              </p>
              <p className="text-[12px] leading-tight tabular-nums text-ios-label-2">
                {formatPrice(spent)}
              </p>
            </div>
          ) : null}
        </div>

        <p className="text-[13px] text-ios-label-2">
          {monthKeyToLabel(list.monthKey)} · {STATUS_LABEL[list.status]} · {list.itemCount} items
        </p>
      </header>

      {/* Scrolls away: you read these once, so they don't earn pinned height. */}
      <p className="px-1 text-[12px] text-ios-label-3">
        Made {formatIsoDate(list.createdAt)}
        {list.purchasedAt ? ` · Shopped ${formatIsoDate(list.purchasedAt)}` : ""}
      </p>

      {isDraft ? (
        <DraftEditor list={list} />
      ) : mode === "list" ? (
        <FinalizedList
          items={visibleItems}
          shopName={selectedShopName}
          emptyMessage={emptyMessage}
        />
      ) : (
        <ShoppingView
          list={list}
          items={visibleItems}
          editable={editable}
          emptyMessage={emptyMessage}
        />
      )}

      {/* Drafts keep DraftEditor's own filtering, so no shared search there. */}
      {!isDraft ? <ListSearchBar value={query} onChange={setQuery} /> : null}

      {/* Drafts add items from the full Add items page instead. */}
      {!isDraft ? (
        <ShopAddSheet
          open={addOpen}
          listId={list.id}
          allowClosed={isCompleted}
          onListItemIds={list.items.map((row) => row.itemId)}
          categories={categories}
          shops={list.shops}
          onClose={() => setAddOpen(false)}
          onAdded={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
