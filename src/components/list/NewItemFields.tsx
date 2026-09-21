"use client";

import { SizeField } from "@/components/SizeField";
import { hasTamilScript } from "@/lib/tanglish";
import { UNIT_TYPES, formatQty, sizeOf, unitOptionLabel, type UnitType } from "@/lib/units";
import type { CategoryDTO, ShopDTO } from "@/lib/types";

export type NewItemDraft = {
  nameTa: string;
  nameTl: string;
  nameEn: string;
  categoryId: number;
  unitType: UnitType;
  shopId: number | null;
  /** Pack size, for countable items sold by the packet. Null when loose. */
  sizeValue: number | null;
  sizeUnit: UnitType | null;
};

/**
 * Seeds a draft from whatever is in a search box: Tamil script goes to the
 * Tamil name, anything else to the English one — you are usually creating the
 * item precisely because the search came up empty.
 */
export function newItemDraft(query: string, categories: CategoryDTO[]): NewItemDraft {
  const trimmed = query.trim();
  const tamil = hasTamilScript(trimmed);
  return {
    nameTa: tamil ? trimmed : "",
    nameTl: "",
    nameEn: tamil ? "" : trimmed,
    categoryId: categories[0]?.id ?? 0,
    unitType: "COUNT",
    shopId: null,
    sizeValue: null,
    sizeUnit: null,
  };
}

type NewItemFieldsProps = {
  draft: NewItemDraft;
  onChange: (draft: NewItemDraft) => void;
  categories: CategoryDTO[];
  shops: ShopDTO[];
};

/**
 * The master-item form, without a sheet around it — the shopping sheet and the
 * Add items page each wrap it in their own title and footer, because one saves
 * and adds to the list while the other only saves to the catalogue.
 */
export function NewItemFields({ draft, onChange, categories, shops }: NewItemFieldsProps) {
  const chip = (active: boolean) =>
    `h-9 rounded-full px-3.5 text-[14px] font-medium transition active:scale-95 ${
      active
        ? "bg-ios-blue text-white"
        : "bg-ios-surface-2 text-ios-label-2 ring-1 ring-inset ring-ios-separator"
    }`;

  const input =
    "h-12 w-full rounded-ios bg-ios-surface-2 px-4 text-[17px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue";

  return (
    <>
      <Field label="Tamil name">
        <input
          value={draft.nameTa}
          onChange={(event) => onChange({ ...draft, nameTa: event.target.value })}
          placeholder="துவரம் பருப்பு"
          className={input}
        />
      </Field>

      <Field label="Tanglish name">
        <input
          value={draft.nameTl}
          onChange={(event) => onChange({ ...draft, nameTl: event.target.value })}
          placeholder="Thuvaram Paruppu"
          className={input}
        />
        <p className="pt-1.5 text-[12px] text-ios-label-3">
          Leave blank and one is worked out from the Tamil name.
        </p>
      </Field>

      <Field label="English name">
        <input
          value={draft.nameEn}
          onChange={(event) => onChange({ ...draft, nameEn: event.target.value })}
          placeholder="Toor Dal"
          className={input}
        />
      </Field>

      <Field label="Category">
        <select
          value={draft.categoryId}
          onChange={(event) => onChange({ ...draft, categoryId: Number(event.target.value) })}
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

      <Field label="Unit type">
        <div className="flex flex-wrap gap-2">
          {UNIT_TYPES.map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() =>
                onChange({
                  ...draft,
                  unitType: unit,
                  // A size belongs to a pack, so it goes when the item stops
                  // being counted in packs.
                  ...(unit === "COUNT" ? {} : { sizeValue: null, sizeUnit: null }),
                })
              }
              className={chip(draft.unitType === unit)}
            >
              {unitOptionLabel(unit)}
            </button>
          ))}
        </div>
      </Field>

      {draft.unitType === "COUNT" ? (
        <Field
          label={`Size${
            sizeOf(draft.sizeValue, draft.sizeUnit)
              ? ` (${formatQty(draft.sizeValue as number, draft.sizeUnit as UnitType)})`
              : ""
          }`}
        >
          <SizeField
            value={draft.sizeValue}
            unit={draft.sizeUnit}
            clearable
            onChange={(sizeValue, sizeUnit) => onChange({ ...draft, sizeValue, sizeUnit })}
            aria-label="Size of one pack"
          />
          <p className="pt-1.5 text-[12px] text-ios-label-3">
            What one comes in — a 200 g paste, a 500 ml bottle. Leave it empty
            for anything sold loose.
          </p>
        </Field>
      ) : null}

      <Field label="Shop by">
        <div className="flex flex-wrap gap-2">
          {shops.map((shop) => (
            <button
              key={shop.id}
              type="button"
              onClick={() => onChange({ ...draft, shopId: shop.id })}
              className={chip(draft.shopId === shop.id)}
            >
              {shop.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...draft, shopId: null })}
            className={chip(draft.shopId === null)}
          >
            Not set
          </button>
        </div>
      </Field>
    </>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="pb-1.5 text-[13px] font-medium text-ios-label-2">{label}</p>
      {children}
    </div>
  );
}
