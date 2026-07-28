import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { UNIT_LABEL, formatQtyValue, type UnitType } from "./units";

export type PdfItem = {
  nameEn: string;
  nameTa: string;
  quantity: number;
  unitType: UnitType;
  shopName: string | null;
  categoryName: string | null;
};

export type PdfOptions = {
  /** e.g. "Jul 2026" */
  listName: string;
  /** Shop the view is filtered to; null when printing every shop. */
  shopName?: string | null;
  /** Group rows under shop headings — used for the unfiltered print. */
  groupByShop?: boolean;
};

/**
 * jsPDF's built-in fonts are Latin-only, so Tamil names are dropped unless a
 * Unicode font is available. Drop a base64-encoded TTF at
 * `public/fonts/NotoSansTamil-Regular.base64.txt` and the print sheet turns
 * bilingual automatically. See README → "Bilingual PDFs".
 */
const TAMIL_FONT_URL = "/fonts/NotoSansTamil-Regular.base64.txt";
const TAMIL_FONT_NAME = "NotoSansTamil";

let tamilFontCache: string | null | undefined;

async function loadTamilFont(doc: jsPDF): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (tamilFontCache === undefined) {
    try {
      const response = await fetch(TAMIL_FONT_URL);
      tamilFontCache = response.ok ? (await response.text()).trim() : null;
    } catch {
      tamilFontCache = null;
    }
  }

  if (!tamilFontCache) return false;

  doc.addFileToVFS(`${TAMIL_FONT_NAME}.ttf`, tamilFontCache);
  doc.addFont(`${TAMIL_FONT_NAME}.ttf`, TAMIL_FONT_NAME, "normal");
  return true;
}

function formatToday(): string {
  return new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Builds the traditional print sheet:
 *
 *   [S.No] | [Item Name] | [Quantity] | [Unit] | [Price — left blank]
 *
 * The price column stays empty so it can be filled in by hand at the shop.
 */
export async function buildGroceryPdf(items: PdfItem[], options: PdfOptions): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const hasTamil = await loadTamilFont(doc);
  const bodyFont = hasTamil ? TAMIL_FONT_NAME : "helvetica";

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Monthly Grocery List", margin, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(options.listName, margin, 25);

  const shopLabel = options.shopName ? `Shop: ${options.shopName}` : "All shops";
  doc.text(shopLabel, pageWidth - margin, 18, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Printed ${formatToday()}`, pageWidth - margin, 25, { align: "right" });
  doc.setTextColor(0);

  doc.setDrawColor(200);
  doc.line(margin, 29, pageWidth - margin, 29);

  const grouped = options.groupByShop && !options.shopName;
  const body: (string | { content: string; colSpan: number; styles: object })[][] = [];

  if (grouped) {
    const byShop = new Map<string, PdfItem[]>();
    for (const item of items) {
      const key = item.shopName ?? "Unassigned";
      byShop.set(key, [...(byShop.get(key) ?? []), item]);
    }

    for (const [shop, shopItems] of byShop) {
      body.push([
        {
          content: shop,
          colSpan: 5,
          styles: { fontStyle: "bold", fillColor: [242, 242, 247], textColor: 40 },
        },
      ]);
      shopItems.forEach((item, index) => body.push(rowFor(item, index + 1, hasTamil)));
    }
  } else {
    items.forEach((item, index) => body.push(rowFor(item, index + 1, hasTamil)));
  }

  autoTable(doc, {
    startY: 34,
    head: [["S.No", "Item Name", "Qty", "Unit", "Price"]],
    body,
    theme: "grid",
    styles: {
      font: bodyFont,
      fontSize: 11,
      cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 },
      lineColor: [190, 190, 195],
      lineWidth: 0.2,
      textColor: 20,
    },
    headStyles: {
      font: "helvetica",
      fontStyle: "bold",
      fillColor: [28, 28, 30],
      textColor: 255,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 14, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 20, halign: "right" },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 32 },
    },
    margin: { left: margin, right: margin, bottom: 20 },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(130);
      doc.text(
        `${items.length} item${items.length === 1 ? "" : "s"}`,
        margin,
        pageHeight - 10,
      );
      doc.text(
        `Page ${doc.getNumberOfPages()}`,
        pageWidth - margin,
        pageHeight - 10,
        { align: "right" },
      );
      doc.setTextColor(0);
    },
  });

  // Blank total line, in keeping with a hand-filled shop sheet.
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  if (finalY && finalY < doc.internal.pageSize.getHeight() - 30) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Total", pageWidth - margin - 52, finalY + 10);
    doc.setDrawColor(120);
    doc.line(pageWidth - margin - 32, finalY + 10.5, pageWidth - margin, finalY + 10.5);
  }

  return doc;
}

function rowFor(item: PdfItem, serial: number, hasTamil: boolean): string[] {
  const name = hasTamil && item.nameTa ? `${item.nameEn}  (${item.nameTa})` : item.nameEn;
  return [
    String(serial),
    name,
    formatQtyValue(item.quantity, item.unitType),
    UNIT_LABEL[item.unitType] || "nos",
    "",
  ];
}

export function pdfFileName(listName: string, shopName?: string | null): string {
  const parts = [listName, shopName ?? "All Shops"].map((part) =>
    part.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, ""),
  );
  return `Grocery-${parts.join("-")}.pdf`;
}

/** Triggers a browser download of the print sheet. */
export async function downloadGroceryPdf(items: PdfItem[], options: PdfOptions): Promise<void> {
  const doc = await buildGroceryPdf(items, options);
  doc.save(pdfFileName(options.listName, options.shopName));
}
