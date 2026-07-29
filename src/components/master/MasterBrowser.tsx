"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { LanguageToggle } from "@/components/LanguageToggle";
import { Sheet } from "@/components/Sheet";
import { Stepper } from "@/components/Stepper";
import { deleteMasterItem, setMasterItemActive, upsertMasterItem } from "@/lib/actions";
import { bilingualName, useLanguage } from "@/lib/language";
import {
  UNIT_TYPES,
  formatPrice,
  formatQty,
  normalizeQty,
  unitOptionLabel,
  type UnitType,
} from "@/lib/units";
import type { CategoryDTO, MasterItemDTO, ShopDTO } from "@/lib/types";

type MasterBrowserProps = {
  items: MasterItemDTO[];
  categories: CategoryDTO[];
  shops: ShopDTO[];
};

type Draft = {
  id?: number;
  nameEn: string;
  nameTa: string;
  categoryId: number;
  unitType: UnitType;
  shopId: number | null;
  defaultQty: number;
  isActive: boolean;
};

export function MasterBrowser({ items, categories, shops }: MasterBrowserProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const trimmed = query.trim();
    const matches = items.filter((item) => {
      if (categoryId && item.categoryId !== categoryId) return false;
      if (!needle) return true;
      return (
        item.nameEn.toLowerCase().includes(needle) ||
        item.nameTa.includes(trimmed) ||
        item.categoryName.toLowerCase().includes(needle) ||
        (item.categoryNameTa ?? "").includes(trimmed) ||
        (item.shopName ?? "").toLowerCase().includes(needle)
      );
    });

    // Grouped by category id (stable across a language switch), labeled in
    // whichever language is currently selected.
    const grouped = new Map<number, { label: string; items: MasterItemDTO[] }>();
    for (const item of matches) {
      const label = language === "ta" ? (item.categoryNameTa ?? item.categoryName) : item.categoryName;
      const existing = grouped.get(item.categoryId);
      if (existing) existing.items.push(item);
      else grouped.set(item.categoryId, { label, items: [item] });
    }
    return [...grouped.entries()];
  }, [items, query, categoryId, language]);

  const startNew = () =>
    setDraft({
      nameEn: "",
      nameTa: "",
      categoryId: categoryId ?? categories[0]?.id ?? 0,
      unitType: "COUNT",
      shopId: null,
      defaultQty: 1,
      isActive: true,
    });

  const startEdit = (item: MasterItemDTO) =>
    setDraft({
      id: item.id,
      nameEn: item.nameEn,
      nameTa: item.nameTa,
      categoryId: item.categoryId,
      unitType: item.unitType,
      shopId: item.shopId,
      defaultQty: item.defaultQty || 1,
      isActive: item.isActive,
    });

  const save = () => {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const result = await upsertMasterItem(draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft(null);
      router.refresh();
    });
  };

  const toggleActive = (item: MasterItemDTO) => {
    startTransition(async () => {
      await setMasterItemActive(item.id, !item.isActive);
      router.refresh();
    });
  };

  const remove = (item: MasterItemDTO) => {
    if (!window.confirm(`Delete "${item.nameEn}" from the master list? This can't be undone.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteMasterItem(item.id);
      setDraft(null);
      if (result.ok && !result.data.deleted) {
        window.alert(
          `"${item.nameEn}" is used in a past list, so it was hidden from search instead of permanently deleted.`,
        );
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">Master List</h1>
          <p className="text-[15px] text-ios-label-2">
            {items.length} items · {categories.length} categories
          </p>
        </div>
        <LanguageToggle />
      </header>

      <div className="space-y-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search items, categories or shops"
          className="h-11 w-full rounded-ios bg-ios-surface px-4 text-[17px] shadow-ios outline-none focus:ring-2 focus:ring-ios-blue"
        />

        <div className="-mx-4 overflow-x-auto px-4 pb-1">
          <div className="flex w-max gap-2">
            <FilterChip active={categoryId === null} onClick={() => setCategoryId(null)}>
              All
            </FilterChip>
            {categories.map((category) => (
              <FilterChip
                key={category.id}
                active={categoryId === category.id}
                onClick={() => setCategoryId(category.id)}
              >
                {language === "ta" ? (category.nameTa ?? category.nameEn) : category.nameEn}
              </FilterChip>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={startNew}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-ios bg-ios-surface text-[17px] font-semibold text-ios-blue shadow-ios transition active:scale-[0.98]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
        </svg>
        New master item
      </button>

      {groups.length === 0 ? (
        <p className="ios-card p-6 text-center text-[15px] text-ios-label-2">No items matched.</p>
      ) : (
        groups.map(([categoryId, group]) => (
          <section key={categoryId}>
            <p className="px-1 pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-ios-label-3">
              {group.label} · {group.items.length}
            </p>
            <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
              {group.items.map((item) => {
                const name = bilingualName(item.nameTa, item.nameEn, language);
                return (
                <li key={item.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="ios-row min-w-0 flex-1 text-left active:bg-ios-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-[16px] font-medium ${
                          item.isActive ? "" : "text-ios-label-3 line-through"
                        }`}
                      >
                        {name.primary}
                      </span>
                      <span className="block truncate text-[13px] text-ios-label-2">
                        {name.secondary} · {unitOptionLabel(item.unitType)}
                        {item.shopName ? ` · ${item.shopName}` : ""}
                      </span>
                    </span>
                    {item.lastPrice !== null ? (
                      <span className="flex-none text-[13px] tabular-nums text-ios-label-2">
                        {formatPrice(item.lastPrice)}
                      </span>
                    ) : null}
                  </button>
                  <Link
                    href={`/items/${item.id}`}
                    aria-label={`Price history for ${item.nameEn}`}
                    className="flex h-11 w-11 flex-none items-center justify-center text-ios-label-3 active:opacity-60"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                      <path
                        d="M9 5l7 7-7 7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </Link>
                </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <Sheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit item" : "New master item"}
        subtitle="Stored in your master database and reusable every month."
        footer={
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="flex h-12 w-full items-center justify-center rounded-ios bg-ios-blue text-[17px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save item"}
          </button>
        }
      >
        {draft ? (
          <div className="space-y-4 pb-3">
            <Field label="Tamil name (Grocery)">
              <input
                value={draft.nameTa}
                onChange={(event) => setDraft({ ...draft, nameTa: event.target.value })}
                placeholder="துவரம் பருப்பு"
                className="h-12 w-full rounded-ios bg-ios-surface-2 px-4 text-[17px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
              />
            </Field>

            <Field label="English name (Grocery.1)">
              <input
                value={draft.nameEn}
                onChange={(event) => setDraft({ ...draft, nameEn: event.target.value })}
                placeholder="Toor Dal"
                className="h-12 w-full rounded-ios bg-ios-surface-2 px-4 text-[17px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
              />
            </Field>

            <Field label="Category (Type)">
              <select
                value={draft.categoryId}
                onChange={(event) => setDraft({ ...draft, categoryId: Number(event.target.value) })}
                className="h-12 w-full rounded-ios bg-ios-surface-2 px-3 text-[17px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.nameTa ? `${category.nameTa} / ` : ""}
                    {category.nameEn}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Unit (Qty Type)">
              <div className="flex flex-wrap gap-2">
                {UNIT_TYPES.map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        unitType: unit,
                        defaultQty: normalizeQty(draft.defaultQty, unit),
                      })
                    }
                    className={`h-10 rounded-full px-4 text-[15px] font-medium transition active:scale-95 ${
                      draft.unitType === unit
                        ? "bg-ios-blue text-white"
                        : "bg-ios-surface-2 text-ios-label-2 ring-1 ring-inset ring-ios-separator"
                    }`}
                  >
                    {unitOptionLabel(unit)}
                  </button>
                ))}
              </div>
            </Field>

            <Field label={`Default quantity (${formatQty(draft.defaultQty, draft.unitType)})`}>
              <Stepper
                value={draft.defaultQty}
                unit={draft.unitType}
                onChange={(defaultQty, unitType) => setDraft({ ...draft, defaultQty, unitType })}
              />
            </Field>

            <Field label="Shop by (From)">
              <div className="flex flex-wrap gap-2">
                {shops.map((shop) => (
                  <button
                    key={shop.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, shopId: shop.id })}
                    className={`h-10 rounded-full px-4 text-[15px] font-medium transition active:scale-95 ${
                      draft.shopId === shop.id
                        ? "bg-ios-blue text-white"
                        : "bg-ios-surface-2 text-ios-label-2 ring-1 ring-inset ring-ios-separator"
                    }`}
                  >
                    {shop.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, shopId: null })}
                  className={`h-10 rounded-full px-4 text-[15px] font-medium transition active:scale-95 ${
                    draft.shopId === null
                      ? "bg-ios-blue text-white"
                      : "bg-ios-surface-2 text-ios-label-2 ring-1 ring-inset ring-ios-separator"
                  }`}
                >
                  Not set
                </button>
              </div>
            </Field>

            {draft.id ? (
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const item = items.find((candidate) => candidate.id === draft.id);
                    if (item) toggleActive(item);
                    setDraft(null);
                  }}
                  className="h-11 text-[16px] font-medium text-ios-blue active:opacity-60"
                >
                  {draft.isActive ? "Hide from search" : "Restore to search"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const item = items.find((candidate) => candidate.id === draft.id);
                    if (item) remove(item);
                  }}
                  className="h-11 text-[16px] font-medium text-ios-red active:opacity-60"
                >
                  Delete item
                </button>
              </div>
            ) : null}

            {error ? <p className="text-[14px] text-ios-red">{error}</p> : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="pb-1.5 text-[13px] font-medium text-ios-label-2">{label}</p>
      {children}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 flex-none rounded-full px-4 text-[14px] font-medium transition active:scale-95 ${
        active
          ? "bg-ios-blue text-white"
          : "bg-ios-surface text-ios-label-2 ring-1 ring-inset ring-ios-separator"
      }`}
    >
      {children}
    </button>
  );
}
