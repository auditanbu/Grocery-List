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

export type PdfLanguage = "en" | "ta";

export type PdfOptions = {
  /** e.g. "Jul 2026" */
  listName: string;
  /** Shop the view is filtered to; null when printing every shop. */
  shopName?: string | null;
  /** Group rows under shop headings — used for the unfiltered print. */
  groupByShop?: boolean;
  language: PdfLanguage;
};

const CONTACT = {
  en: "Anbarasu - 9865027890",
  ta: "அன்பரசு - 9865027890",
};

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

function formatToday(locale: string): string {
  return new Date().toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Builds the traditional print sheet:
 *
 *   [S.No] | [Item Name] | [Quantity] | [Unit] | [Price — left blank]
 *
 * The price column stays empty so it can be filled in by hand at the shop.
 * Tamil text needs a different rendering path — see buildTamilPdf below.
 */
export async function buildGroceryPdf(items: PdfItem[], options: PdfOptions): Promise<jsPDF> {
  return options.language === "ta" ? buildTamilPdf(items, options) : buildEnglishPdf(items, options);
}

/**
 * Vector text via jsPDF-autotable — crisp, small file, searchable/selectable.
 * jsPDF's built-in fonts are Latin-only, which is fine here: English mode
 * only ever prints nameEn.
 */
function buildEnglishPdf(items: PdfItem[], options: PdfOptions): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
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
  doc.text(`Printed ${formatToday("en-IN")}`, pageWidth - margin, 25, { align: "right" });
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
      shopItems.forEach((item, index) => body.push(rowFor(item, index + 1)));
    }
  } else {
    items.forEach((item, index) => body.push(rowFor(item, index + 1)));
  }

  autoTable(doc, {
    startY: 34,
    head: [["S.No", "Item Name", "Qty", "Unit", "Price"]],
    body,
    theme: "grid",
    styles: {
      font: "helvetica",
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
    margin: { left: margin, right: margin, bottom: 24 },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(130);
      doc.text(`${items.length} item${items.length === 1 ? "" : "s"}`, margin, pageHeight - 14);
      doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - margin, pageHeight - 14, {
        align: "right",
      });
      doc.setTextColor(0);
    },
  });

  // Blank total line, in keeping with a hand-filled shop sheet.
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  if (finalY && finalY < doc.internal.pageSize.getHeight() - 34) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Total", pageWidth - margin - 52, finalY + 10);
    doc.setDrawColor(120);
    doc.line(pageWidth - margin - 32, finalY + 10.5, pageWidth - margin, finalY + 10.5);
  }

  addContactFooterToAllPages(doc, "en", margin);
  return doc;
}

function rowFor(item: PdfItem, serial: number): string[] {
  return [
    String(serial),
    item.nameEn,
    formatQtyValue(item.quantity, item.unitType),
    UNIT_LABEL[item.unitType] || "nos",
    "",
  ];
}

/** Prints "Anbarasu - 9865027890" bottom-left of every page, English mode only. */
function addContactFooterToAllPages(doc: jsPDF, language: "en", margin: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(CONTACT[language], margin, pageHeight - 8);
    doc.setTextColor(0);
  }
}

/**
 * Tamil text needs real OpenType shaping (combining vowel signs, conjunct
 * consonants) that jsPDF cannot do — it draws glyphs one Unicode codepoint
 * at a time, which silently mangles Tamil (e.g. "துவரம்" renders as
 * "தவரம்"). Instead this renders the print sheet as HTML off-screen,
 * captures it with the browser's own — correct — text engine via
 * html2canvas, and places the result into the PDF as paginated images.
 */
async function buildTamilPdf(items: PdfItem[], options: PdfOptions): Promise<jsPDF> {
  const html2canvas = (await import("html2canvas")).default;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "-10000px";
  container.style.width = `${A4_WIDTH_MM}mm`;
  container.style.backgroundColor = "#ffffff";
  container.innerHTML = buildTamilSheetHtml(items, options);
  document.body.appendChild(container);

  try {
    // Let web fonts finish loading before the browser paints what we're
    // about to capture.
    if (document.fonts?.ready) await document.fonts.ready;

    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pxPerMm = canvas.width / A4_WIDTH_MM;
    const pageHeightPx = Math.round(pxPerMm * A4_HEIGHT_MM);
    const pageCount = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

    for (let page = 0; page < pageCount; page++) {
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - page * pageHeightPx);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeightPx;

      const ctx = pageCanvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        page * pageHeightPx,
        canvas.width,
        sliceHeightPx,
        0,
        0,
        canvas.width,
        sliceHeightPx,
      );

      const imageData = pageCanvas.toDataURL("image/jpeg", 0.92);
      if (page > 0) doc.addPage();
      doc.addImage(imageData, "JPEG", 0, 0, A4_WIDTH_MM, sliceHeightPx / pxPerMm);
    }

    return doc;
  } finally {
    document.body.removeChild(container);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const TAMIL_FONT_STACK =
  '"Noto Sans Tamil", "Tamil Sangam MN", "Tamil MN", "Nirmala UI", -apple-system, sans-serif';

function buildTamilSheetHtml(items: PdfItem[], options: PdfOptions): string {
  const margin = "14mm";
  const shopLabel = options.shopName ? `கடை: ${options.shopName}` : "அனைத்து கடைகள்";
  const grouped = options.groupByShop && !options.shopName;

  const rowHtml = (item: PdfItem, serial: number) => `
    <tr style="border-bottom:1px solid #ddd;">
      <td style="padding:2.2mm; text-align:center;color:#666;">${serial}</td>
      <td style="padding:2.2mm;">
        <div style="font-weight:600;">${escapeHtml(item.nameTa)}</div>
        <div style="font-size:9pt;color:#666;">${escapeHtml(item.nameEn)}</div>
      </td>
      <td style="padding:2.2mm; text-align:right;">${escapeHtml(formatQtyValue(item.quantity, item.unitType))}</td>
      <td style="padding:2.2mm; text-align:center;">${escapeHtml(UNIT_LABEL[item.unitType] || "nos")}</td>
      <td style="padding:2.2mm;"></td>
    </tr>`;

  let bodyRows = "";
  if (grouped) {
    const byShop = new Map<string, PdfItem[]>();
    for (const item of items) {
      const key = item.shopName ?? "வேறு";
      byShop.set(key, [...(byShop.get(key) ?? []), item]);
    }
    for (const [shop, shopItems] of byShop) {
      bodyRows += `<tr><td colspan="5" style="padding:2.2mm;background:#f2f2f7;font-weight:700;color:#333;">${escapeHtml(shop)}</td></tr>`;
      bodyRows += shopItems.map((item, index) => rowHtml(item, index + 1)).join("");
    }
  } else {
    bodyRows = items.map((item, index) => rowHtml(item, index + 1)).join("");
  }

  return `
    <div style="font-family:${TAMIL_FONT_STACK}; color:#111; padding:${margin}; box-sizing:border-box; font-size:11pt;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #ccc; padding-bottom:6mm; margin-bottom:6mm;">
        <div>
          <div style="font-size:17pt; font-weight:700;">மாத மளிகை பட்டியல்</div>
          <div style="font-size:10pt; color:#444; margin-top:1mm;">${escapeHtml(options.listName)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10pt;">${escapeHtml(shopLabel)}</div>
          <div style="font-size:8pt; color:#888; margin-top:1mm;">அச்சிடப்பட்டது ${escapeHtml(formatToday("ta-IN"))}</div>
        </div>
      </div>

      <table style="width:100%; border-collapse:collapse; font-size:10.5pt;">
        <thead>
          <tr style="background:#1c1c1e; color:#fff;">
            <th style="padding:2.5mm; text-align:center; width:12mm;">வ.எண்</th>
            <th style="padding:2.5mm; text-align:left;">பொருளின் பெயர்</th>
            <th style="padding:2.5mm; text-align:right; width:20mm;">அளவு</th>
            <th style="padding:2.5mm; text-align:center; width:18mm;">அலகு</th>
            <th style="padding:2.5mm; text-align:left; width:30mm;">விலை</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-top:8mm;">
        <div style="font-weight:700; margin-right:4mm;">மொத்தம்</div>
        <div style="width:32mm; border-bottom:1px solid #888;"></div>
      </div>

      <div style="margin-top:14mm; padding-top:4mm; border-top:1px solid #eee; display:flex; justify-content:space-between; font-size:9pt; color:#666;">
        <div>${escapeHtml(CONTACT.ta)}</div>
        <div>${items.length} பொருட்கள்</div>
      </div>
    </div>`;
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
