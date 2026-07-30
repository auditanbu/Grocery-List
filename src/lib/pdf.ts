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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const TAMIL_FONT_STACK =
  '"Noto Sans Tamil", "Tamil Sangam MN", "Tamil MN", "Nirmala UI", -apple-system, sans-serif';

const TAMIL_PAGE_MARGIN_MM = 14;

type TamilRow = { kind: "shop"; label: string } | { kind: "item"; item: PdfItem; serial: number };

/** Same grouping as the English sheet's `rowFor`/shop-heading loop. */
function buildTamilRows(items: PdfItem[], grouped: boolean): TamilRow[] {
  const rows: TamilRow[] = [];
  if (grouped) {
    const byShop = new Map<string, PdfItem[]>();
    for (const item of items) {
      const key = item.shopName ?? "வேறு";
      byShop.set(key, [...(byShop.get(key) ?? []), item]);
    }
    for (const [shop, shopItems] of byShop) {
      rows.push({ kind: "shop", label: shop });
      shopItems.forEach((item, index) => rows.push({ kind: "item", item, serial: index + 1 }));
    }
  } else {
    items.forEach((item, index) => rows.push({ kind: "item", item, serial: index + 1 }));
  }
  return rows;
}

function tamilRowHtml(row: TamilRow, rowIndex: number): string {
  if (row.kind === "shop") {
    return `<tr data-row="${rowIndex}"><td colspan="5" style="padding:2.2mm;background:#f2f2f7;font-weight:700;color:#333;">${escapeHtml(row.label)}</td></tr>`;
  }
  const { item, serial } = row;
  return `<tr data-row="${rowIndex}" style="border-bottom:1px solid #ddd;">
    <td style="padding:2.2mm; text-align:center;color:#666;">${serial}</td>
    <td style="padding:2.2mm;">
      <div style="font-weight:600;">${escapeHtml(item.nameTa)}</div>
      <div style="font-size:9pt;color:#666;">${escapeHtml(item.nameEn)}</div>
    </td>
    <td style="padding:2.2mm; text-align:right;">${escapeHtml(formatQtyValue(item.quantity, item.unitType))}</td>
    <td style="padding:2.2mm; text-align:center;">${escapeHtml(UNIT_LABEL[item.unitType] || "nos")}</td>
    <td style="padding:2.2mm;"></td>
  </tr>`;
}

/** Header row, styled to match the English sheet's dark, centered thead exactly. */
const TAMIL_TABLE_HEAD = `
  <thead>
    <tr style="background:#1c1c1e; color:#fff;">
      <th style="padding:2.5mm; text-align:center; width:12mm;">வ.எண்</th>
      <th style="padding:2.5mm; text-align:center;">பொருளின் பெயர்</th>
      <th style="padding:2.5mm; text-align:center; width:20mm;">அளவு</th>
      <th style="padding:2.5mm; text-align:center; width:18mm;">அலகு</th>
      <th style="padding:2.5mm; text-align:center; width:30mm;">விலை</th>
    </tr>
  </thead>`;

/** Mirrors the English sheet's title block — page 1 only. */
function tamilTitleBlockHtml(options: PdfOptions): string {
  const shopLabel = options.shopName ? `கடை: ${options.shopName}` : "அனைத்து கடைகள்";
  return `
    <div data-block="title" style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #ccc; padding-bottom:5mm; margin-bottom:5mm;">
      <div>
        <div style="font-size:16pt; font-weight:700;">மாத மளிகை பட்டியல்</div>
        <div style="font-size:11pt; color:#111; margin-top:1mm;">${escapeHtml(options.listName)}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11pt;">${escapeHtml(shopLabel)}</div>
        <div style="font-size:9pt; color:#888; margin-top:1mm;">அச்சிடப்பட்டது ${escapeHtml(formatToday("ta-IN"))}</div>
      </div>
    </div>`;
}

/** Mirrors the English sheet's blank hand-filled total line — last page only. */
function tamilTotalLineHtml(): string {
  return `
    <div data-block="total" style="display:flex; justify-content:flex-end; margin-top:8mm;">
      <div style="font-weight:700; margin-right:4mm;">மொத்தம்</div>
      <div style="width:32mm; border-bottom:1px solid #888;"></div>
    </div>`;
}

/** Mirrors the English sheet's per-page footer (item count + page number + contact). */
function tamilFooterHtml(itemCount: number, page: number, pageCount: number): string {
  return `
    <div data-block="footer" style="margin-top:6mm; padding-top:3mm; border-top:1px solid #eee; font-size:9pt; color:#666;">
      <div style="display:flex; justify-content:space-between;">
        <div>${itemCount} பொருட்கள்</div>
        <div>பக்கம் ${page} / ${pageCount}</div>
      </div>
      <div style="margin-top:2mm;">${escapeHtml(CONTACT.ta)}</div>
    </div>`;
}

/**
 * `fixedHeight` pins the page to exactly one A4 sheet with overflow
 * clipped — a safety net for the final per-page renders so any residual
 * measurement drift trims invisible whitespace instead of bleeding text
 * past the page edge. The probe render omits it so nothing is clipped
 * before it's been measured.
 */
function tamilPageHtml(bodyHtml: string, fixedHeight = false): string {
  const heightStyle = fixedHeight ? `height:${A4_HEIGHT_MM}mm; overflow:hidden;` : "";
  return `<div style="font-family:${TAMIL_FONT_STACK}; color:#111; padding:${TAMIL_PAGE_MARGIN_MM}mm; box-sizing:border-box; font-size:11pt; ${heightStyle}">
    ${bodyHtml}
  </div>`;
}

function tamilTableHtml(rowsHtml: string): string {
  return `<table style="width:100%; border-collapse:collapse; font-size:10.5pt;">${TAMIL_TABLE_HEAD}<tbody>${rowsHtml}</tbody></table>`;
}

/**
 * Tamil text needs real OpenType shaping (combining vowel signs, conjunct
 * consonants) that jsPDF cannot do — it draws glyphs one Unicode codepoint
 * at a time, which silently mangles Tamil (e.g. "துவரம்" renders as
 * "தவரம்"). Instead this renders the print sheet as HTML off-screen and
 * captures it with the browser's own — correct — text engine via
 * html2canvas.
 *
 * Pages are laid out the same way the English autoTable print does: the
 * table header repeats on every page, the title block only appears on
 * page 1, and a footer (item count / page number / contact) repeats on
 * every page. Row heights are measured from a real off-screen render so a
 * row is never sliced in half across a page break.
 */
async function buildTamilPdf(items: PdfItem[], options: PdfOptions): Promise<jsPDF> {
  const html2canvas = (await import("html2canvas")).default;
  if (document.fonts?.ready) await document.fonts.ready;

  const grouped = Boolean(options.groupByShop && !options.shopName);
  const rows = buildTamilRows(items, grouped);

  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.top = "0";
  probe.style.left = "-10000px";
  probe.style.width = `${A4_WIDTH_MM}mm`;
  probe.style.backgroundColor = "#ffffff";
  probe.innerHTML = tamilPageHtml(
    tamilTitleBlockHtml(options) +
      tamilTableHtml(rows.map((row, index) => tamilRowHtml(row, index)).join("")) +
      tamilTotalLineHtml() +
      tamilFooterHtml(items.length, 1, 1),
  );
  document.body.appendChild(probe);

  let pxPerMm: number;
  let titleHeightPx: number;
  let theadHeightPx: number;
  let rowHeightsPx: number[];
  let totalLineHeightPx: number;
  let footerHeightPx: number;
  try {
    pxPerMm = probe.getBoundingClientRect().width / A4_WIDTH_MM;
    const height = (selector: string) => probe.querySelector(selector)?.getBoundingClientRect().height ?? 0;

    titleHeightPx = height('[data-block="title"]');
    theadHeightPx = height("thead");
    rowHeightsPx = rows.map((_, index) => height(`[data-row="${index}"]`));
    totalLineHeightPx = height('[data-block="total"]');
    footerHeightPx = height('[data-block="footer"]');
  } finally {
    document.body.removeChild(probe);
  }

  // getBoundingClientRect().height doesn't include an element's own CSS
  // margin, so the gaps between blocks (title's margin-bottom, the total
  // line's margin-top, the footer's margin-top) have to be added back in
  // explicitly — these mirror the literal margin values set in
  // tamilTitleBlockHtml/tamilTotalLineHtml/tamilFooterHtml below. Missing
  // this originally under-budgeted every page and clipped the footer.
  const titleGapPx = pxPerMm * 5;
  const totalLineGapPx = pxPerMm * 8;
  const footerGapPx = pxPerMm * 6;

  // A few mm of slack for sub-pixel rounding differences between this
  // measurement pass and the final per-page render — keeps the footer
  // clear of the hard clip at the page edge instead of hugging it exactly.
  const usableHeightPx = pxPerMm * (A4_HEIGHT_MM - 2 * TAMIL_PAGE_MARGIN_MM - 10);

  // Walk the rows, closing a page whenever the next row (plus the footer,
  // and the total line once we're on the last row) would overflow it.
  const pages: number[][] = [[]];
  let usedPx = titleHeightPx + titleGapPx + theadHeightPx;
  for (let index = 0; index < rows.length; index++) {
    const isLastRow = index === rows.length - 1;
    const rowBudget = rowHeightsPx[index] + (isLastRow ? totalLineGapPx + totalLineHeightPx : 0);
    if (usedPx + rowBudget + footerGapPx + footerHeightPx > usableHeightPx && pages[pages.length - 1].length > 0) {
      pages.push([]);
      usedPx = theadHeightPx;
    }
    pages[pages.length - 1].push(index);
    usedPx += rowBudget;
  }
  if (pages.length > 1 && pages[pages.length - 1].length === 0) pages.pop();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  for (let page = 0; page < pages.length; page++) {
    const rowIndexes = pages[page];
    const isLastPage = page === pages.length - 1;
    const bodyHtml =
      (page === 0 ? tamilTitleBlockHtml(options) : "") +
      tamilTableHtml(rowIndexes.map((index) => tamilRowHtml(rows[index], index)).join("")) +
      (isLastPage ? tamilTotalLineHtml() : "") +
      tamilFooterHtml(items.length, page + 1, pages.length);

    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "-10000px";
    container.style.width = `${A4_WIDTH_MM}mm`;
    container.style.backgroundColor = "#ffffff";
    container.innerHTML = tamilPageHtml(bodyHtml, true);
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const imageData = canvas.toDataURL("image/jpeg", 0.92);
      if (page > 0) doc.addPage();
      doc.addImage(imageData, "JPEG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
    } finally {
      document.body.removeChild(container);
    }
  }

  return doc;
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
