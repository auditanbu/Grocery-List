/**
 * Imports master data straight from the spreadsheet.
 *
 * Export "Grocery database.xlsx" as CSV (File → Save As → CSV UTF-8), then:
 *   npm run db:import -- "./Grocery database.csv"
 *
 * Expected headers (extra columns are ignored, order does not matter):
 *   Grocery | Grocery.1 | Type | Qty Type | From
 *
 * Optional — marks items sold in inconsistent pack sizes (soaps, pastes,
 * shampoos, ...) so they get the quantity/unit editor while shopping:
 *   Unit (pack size, e.g. 200) | Unit Type (g | ml | kg | L | blank)
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createScriptClient, importMasterData, type MasterRow } from "./master-import.js";

/** Minimal RFC-4180 parser: handles quoted fields, embedded commas and newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const source = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const HEADER_ALIASES: Record<keyof MasterRow, string[]> = {
  grocery: ["grocery", "tamil", "tamil name", "item"],
  groceryEn: ["grocery.1", "grocery1", "english", "english name", "item name"],
  type: ["type", "category"],
  qtyType: ["qty type", "qtytype", "unit type", "uom"],
  from: ["from", "shop", "shop by", "store"],
  // Optional — present on the supplementary "variable pack size" sheet
  // (e.g. soaps/pastes sold in inconsistent sizes), absent from the main
  // spreadsheet export. A row with a non-blank "Unit" is treated as marked
  // for variable-unit support.
  unit: ["unit", "pack size", "pack qty", "size"],
  variableUnit: ["variable unit", "has variable unit", "variable size"],
};
const OPTIONAL_COLUMNS: (keyof MasterRow)[] = ["grocery", "from", "unit", "variableUnit"];

function columnIndexes(header: string[]) {
  const normalized = header.map((h) => h.trim().toLowerCase());
  const indexes = {} as Record<keyof MasterRow, number>;

  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [keyof MasterRow, string[]][]) {
    indexes[key] = normalized.findIndex((h) => aliases.includes(h));
  }
  return indexes;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: npm run db:import -- "./Grocery database.csv"');
    process.exit(1);
  }

  const rows = parseCsv(await readFile(file, "utf8"));
  if (rows.length < 2) {
    console.error("No data rows found in the CSV.");
    process.exit(1);
  }

  const indexes = columnIndexes(rows[0]);
  const missing = (Object.keys(indexes) as (keyof MasterRow)[]).filter(
    (key) => indexes[key] === -1 && !OPTIONAL_COLUMNS.includes(key),
  );
  if (missing.length) {
    console.error(
      `Missing required column(s): ${missing.join(", ")}. Found headers: ${rows[0].join(" | ")}`,
    );
    process.exit(1);
  }

  const at = (row: string[], index: number) => (index === -1 ? "" : (row[index] ?? "").trim());
  const items: MasterRow[] = rows.slice(1).map((row) => {
    const unitRaw = at(row, indexes.unit);
    const unit = unitRaw ? Number.parseFloat(unitRaw) : undefined;
    const variableUnitRaw = at(row, indexes.variableUnit).toLowerCase();

    return {
      grocery: at(row, indexes.grocery),
      groceryEn: at(row, indexes.groceryEn),
      type: at(row, indexes.type),
      qtyType: at(row, indexes.qtyType),
      from: at(row, indexes.from),
      unit: unit !== undefined && Number.isFinite(unit) ? unit : undefined,
      // Explicit "yes/true/1" wins; otherwise a filled-in "Unit" implies it.
      variableUnit: variableUnitRaw
        ? ["yes", "true", "1", "y"].includes(variableUnitRaw)
        : unitRaw !== "",
    };
  });

  const prisma = createScriptClient();
  try {
    const result = await importMasterData(prisma, { items });
    console.log(`✔ Imported ${file}`);
    console.log(`   categories: ${result.categories}`);
    console.log(`   shops:      ${result.shops}`);
    console.log(`   items:      ${result.created} created, ${result.updated} updated`);
    for (const reason of result.skipped) console.log(`   skipped: ${reason}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
