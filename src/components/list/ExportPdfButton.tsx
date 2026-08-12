"use client";

import { useState } from "react";

import type { PdfLanguage } from "@/lib/pdf";
import type { ListItemDTO } from "@/lib/types";

type ExportPdfButtonProps = {
  listName: string;
  shopName: string | null;
  items: ListItemDTO[];
  /** Print shop headings when no single shop is selected. */
  groupByShop?: boolean;
  /** Follows the app's Tamil/Tanglish/English display toggle — no separate prompt. */
  language: PdfLanguage;
  /** Icon-only for the header, next to the language toggle. */
  variant?: "full" | "icon";
};

/**
 * Generates the printable sheet in the browser, in whichever language the
 * app is currently displaying. jsPDF (and, for Tamil, html2canvas) are
 * imported lazily so neither lands in the initial bundle.
 */
export function ExportPdfButton({
  listName,
  shopName,
  items,
  groupByShop = true,
  language,
  variant = "full",
}: ExportPdfButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportPdf = async () => {
    if (items.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const { downloadGroceryPdf } = await import("@/lib/pdf");
      await downloadGroceryPdf(
        items.map((item) => ({
          nameEn: item.nameEn,
          nameTa: item.nameTa,
          nameTl: item.nameTl,
          quantity: item.quantity,
          unitType: item.unitType,
          shopName: item.shopName,
          categoryName: item.categoryName,
        })),
        { listName, shopName, groupByShop, language },
      );
    } catch {
      setError("Could not generate the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const icon = (
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
  );

  if (variant === "icon") {
    return (
      <div>
        <button
          type="button"
          onClick={exportPdf}
          disabled={busy || items.length === 0}
          aria-label={busy ? "Preparing PDF…" : "Export PDF"}
          title={busy ? "Preparing PDF…" : "Export PDF"}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ios-surface text-ios-blue shadow-ios transition active:scale-95 disabled:opacity-40"
        >
          {icon}
        </button>
        {error ? <p className="mt-1 text-[13px] text-ios-red">{error}</p> : null}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={exportPdf}
        disabled={busy || items.length === 0}
        className="flex h-11 items-center justify-center gap-2 rounded-ios bg-ios-surface px-4 text-[15px] font-medium text-ios-blue shadow-ios transition active:scale-[0.98] disabled:opacity-40"
      >
        {icon}
        {busy ? "Preparing…" : "Export PDF"}
      </button>
      {error ? <p className="mt-1 text-[13px] text-ios-red">{error}</p> : null}
    </div>
  );
}
