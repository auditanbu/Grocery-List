"use client";

import { useState } from "react";

import { Sheet } from "@/components/Sheet";
import type { PdfLanguage } from "@/lib/pdf";
import type { ListItemDTO } from "@/lib/types";

type ExportPdfButtonProps = {
  listName: string;
  shopName: string | null;
  items: ListItemDTO[];
  /** Print shop headings when no single shop is selected. */
  groupByShop?: boolean;
};

const LANGUAGES: { value: PdfLanguage; label: string; hint: string }[] = [
  { value: "en", label: "English", hint: "Item names in English" },
  { value: "ta", label: "தமிழ்", hint: "பொருட்களின் பெயர் தமிழில்" },
];

/**
 * Asks which language to print in, then generates the sheet in the
 * browser. jsPDF (and, for Tamil, html2canvas) are imported lazily so
 * neither lands in the initial bundle.
 */
export function ExportPdfButton({
  listName,
  shopName,
  items,
  groupByShop = true,
}: ExportPdfButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportPdf = async (language: PdfLanguage) => {
    setBusy(true);
    setError(null);
    try {
      const { downloadGroceryPdf } = await import("@/lib/pdf");
      await downloadGroceryPdf(
        items.map((item) => ({
          nameEn: item.nameEn,
          nameTa: item.nameTa,
          quantity: item.quantity,
          unitType: item.unitType,
          shopName: item.shopName,
          categoryName: item.categoryName,
        })),
        { listName, shopName, groupByShop, language },
      );
      setOpen(false);
    } catch {
      setError("Could not generate the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={items.length === 0}
        className="flex h-11 items-center justify-center gap-2 rounded-ios bg-ios-surface px-4 text-[15px] font-medium text-ios-blue shadow-ios transition active:scale-[0.98] disabled:opacity-40"
      >
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
        Export PDF
      </button>
      {error ? <p className="mt-1 text-[13px] text-ios-red">{error}</p> : null}

      <Sheet
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="Print language"
        subtitle="Choose the language for item names on the sheet."
      >
        <div className="space-y-2.5 pb-3">
          {LANGUAGES.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={busy}
              onClick={() => exportPdf(option.value)}
              className="flex w-full items-center justify-between rounded-ios bg-ios-surface-2 px-4 py-3.5 text-left ring-1 ring-inset ring-ios-separator transition active:scale-[0.98] disabled:opacity-50"
            >
              <span>
                <span className="block text-[17px] font-semibold">{option.label}</span>
                <span className="block text-[13px] text-ios-label-2">{option.hint}</span>
              </span>
              {busy ? (
                <span className="text-[13px] text-ios-label-2">Preparing…</span>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-ios-label-3" aria-hidden>
                  <path
                    d="M9 5l7 7-7 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
