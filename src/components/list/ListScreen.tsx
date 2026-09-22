"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  CartIcon,
  CategoryIcon,
  CheckIcon,
  FilterSheet,
  PencilIcon,
  ReopenIcon,
  ShopIcon,
  selectedOption,
  type FilterOption,
} from "@/components/FilterSheet";
import { BurgerButton, HeaderMenu, type HeaderMenuItem } from "@/components/HeaderMenu";
import { TrashIcon } from "@/components/home/ListRow";
import { DraftEditor } from "@/components/list/DraftEditor";
import { useExportPdf } from "@/components/list/ExportPdfButton";
import { FinalizedList } from "@/components/list/FinalizedList";
import { ListSearchBar } from "@/components/list/ListSearchBar";
import { ShopAddSheet } from "@/components/list/ShopAddSheet";
import { ShoppingView } from "@/components/list/ShoppingView";
import { deleteList, reopenList } from "@/lib/actions";
import { useAdmin } from "@/lib/admin-context";
import { formatIsoDate, monthKeyToLabel } from "@/lib/dates";
import { LANGUAGE_CODE, LANGUAGE_NAME, LANGUAGE_ORDER, useLanguage } from "@/lib/language";
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
  const { isAdmin } = useAdmin();
  const { language, setLanguage } = useLanguage();
  const [mode, setMode] = useState<Mode>(list.status === "COMPLETED" ? "shopping" : "list");
  const [shopId, setShopId] = useState<number | null | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openSheet, setOpenSheet] = useState<"shop" | "category" | "language" | null>(null);
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

  const pdf = useExportPdf({
    listName: list.name,
    shopName: selectedShopName,
    // The PDF is the sheet you carry to one shop, so it follows the shop
    // filter only — never the category filter or the search, either of which
    // would silently half-print the sheet.
    items: shopItems,
    groupByShop: !selectedShopName,
    language,
  });

  // Deleting a list belongs in here, not on the card you tap to open it: it
  // takes a month of prices with it, and a bin beside the row is one slip
  // from doing that. Admin-only and confirmed, like every other destructive
  // control; afterwards there is no list left to stay on.
  const remove = () => {
    if (
      !window.confirm(
        `Delete "${list.name}"? Its items and the prices recorded on it go too. This can't be undone.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteList(list.id);
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      router.replace("/grocery");
      router.refresh();
    });
  };

  const reopen = () => {
    startTransition(async () => {
      await reopenList(list.id);
      // The list becomes a draft, the search bar unmounts; a stale query
      // would silently apply if it were finalized again this session.
      setQuery("");
      router.refresh();
    });
  };

  // Every header control except the view toggle now lives here. Conditions are
  // the same ones that used to decide whether each icon rendered.
  const menuItems: HeaderMenuItem[] = [];
  if (!isDraft) {
    menuItems.push({
      key: "shop",
      label: "Shop",
      icon: <ShopIcon />,
      detail: selectedOption(shopFilterOptions, shopId)?.label,
      active: shopId !== undefined,
      onSelect: () => setOpenSheet("shop"),
    });
    menuItems.push({
      key: "category",
      label: "Category",
      icon: <CategoryIcon />,
      detail: selectedOption(categoryFilterOptions, categoryId)?.label,
      active: categoryId !== undefined,
      onSelect: () => setOpenSheet("category"),
    });
  }
  if (list.status === "FINALIZED") {
    menuItems.push({
      key: "pdf",
      label: pdf.busy ? "Preparing PDF…" : "Export PDF",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
          <path
            d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      detail: selectedShopName ?? "All shops",
      disabled: pdf.busy || shopItems.length === 0,
      onSelect: () => void pdf.exportPdf(),
    });
  }
  if (!isDraft && mode === "shopping" && editable) {
    menuItems.push({
      key: "add",
      label: "Add item",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
          <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
        </svg>
      ),
      onSelect: () => setAddOpen(true),
    });
  }
  menuItems.push({
    key: "language",
    label: "Language",
    // aria-hidden: the code is decoration here, and without it the row
    // announces as "த Language Tamil".
    icon: (
      <span className="text-[12px] font-bold" aria-hidden>
        {LANGUAGE_CODE[language]}
      </span>
    ),
    detail: LANGUAGE_NAME[language],
    onSelect: () => setOpenSheet("language"),
  });
  if (list.status === "FINALIZED") {
    menuItems.push({
      key: "reopen",
      label: "Reopen as draft",
      icon: <ReopenIcon />,
      tone: "warn",
      disabled: pending,
      onSelect: reopen,
    });
  }
  if (isCompleted) {
    menuItems.push({
      key: "edit",
      label: unlocked ? "Finish editing" : "Edit this list",
      icon: unlocked ? <CheckIcon /> : <PencilIcon />,
      active: unlocked,
      onSelect: () => {
        setUnlocked((current) => !current);
        setAddOpen(false);
      },
    });
  }

  if (isAdmin) {
    menuItems.push({
      key: "delete",
      label: "Delete list",
      icon: <TrashIcon />,
      tone: "danger",
      disabled: pending,
      onSelect: remove,
    });
  }

  const filterApplied = shopId !== undefined || categoryId !== undefined;


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
      {/*
        One pinned row: back, list name, what you have spent, the view toggle
        and the menu. Everything else moved behind the menu, so the header
        costs ~56px instead of ~130px and the list starts that much higher.
      */}
      <header
        className="sticky top-0 z-20 -mx-4 flex items-center gap-2 border-b border-ios-separator bg-ios-bg/90 px-4 pb-2 backdrop-blur-xl"
        style={{
          marginTop: "calc(-1 * env(safe-area-inset-top))",
          paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)",
        }}
      >
        <Link
          href="/grocery"
          aria-label="Back to lists"
          title="Back to lists"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-ios-blue active:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
            <path
              d="M15 5l-7 7 7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>

        <h1 className="min-w-0 flex-1 truncate text-[20px] font-bold tracking-tight">
          {list.name}
        </h1>

        {mode === "shopping" ? (
          <div className="flex-none text-right leading-tight">
            <p className="text-[13px] tabular-nums text-ios-label-2">
              {purchasedCount}
              <span className="text-ios-label-3">/{visibleItems.length}</span>
            </p>
            <p className="text-[17px] font-semibold tabular-nums">{formatPrice(spent)}</p>
          </div>
        ) : null}

        {/* The one control kept out of the menu: switching views is the most
            frequent thing you do here, and it should stay a single tap. */}
        {!isDraft ? (
          <button
            type="button"
            onClick={() => setMode((current) => (current === "list" ? "shopping" : "list"))}
            aria-pressed={mode === "shopping"}
            aria-label={mode === "shopping" ? "Back to list" : "Go shopping"}
            title={mode === "shopping" ? "Back to list" : "Go shopping"}
            className={`relative flex h-9 w-9 flex-none items-center justify-center rounded-full shadow-ios transition active:scale-95 ${
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

        <BurgerButton onClick={() => setMenuOpen(true)} marked={filterApplied} />
      </header>

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

      <HeaderMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        items={menuItems}
        info={
          <>
            <p className="text-[14px] font-medium">
              {monthKeyToLabel(list.monthKey)} · {STATUS_LABEL[list.status]} · {list.itemCount}{" "}
              items
            </p>
            <p className="mt-0.5 text-[13px] text-ios-label-2">
              Made {formatIsoDate(list.createdAt)}
              {list.purchasedAt ? ` · Shopped ${formatIsoDate(list.purchasedAt)}` : ""}
            </p>
          </>
        }
      />

      {/* Opened from a menu row; the menu closes first, so the two sheets
          never stack. */}
      <FilterSheet
        open={openSheet === "shop"}
        onClose={() => setOpenSheet(null)}
        label="Shop"
        options={shopFilterOptions}
        value={shopId}
        onChange={setShopId}
      />
      <FilterSheet
        open={openSheet === "category"}
        onClose={() => setOpenSheet(null)}
        label="Category"
        options={categoryFilterOptions}
        value={categoryId}
        onChange={setCategoryId}
      />
      <FilterSheet
        open={openSheet === "language"}
        onClose={() => setOpenSheet(null)}
        label="Language"
        options={LANGUAGE_ORDER.map((code) => ({
          key: code,
          label: LANGUAGE_NAME[code],
          value: code,
        }))}
        value={language}
        onChange={setLanguage}
      />

      {pdf.error ? (
        <p className="rounded-ios bg-ios-red-soft px-4 py-3 text-[14px] text-ios-red">
          {pdf.error}
        </p>
      ) : null}

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
