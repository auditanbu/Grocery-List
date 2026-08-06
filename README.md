# Monthly Grocery Planner

A cross-platform PWA for planning, printing and shopping a monthly grocery
list — built with the Next.js App Router, Prisma, and an iOS-flavoured
Tailwind design system. Optimized for iPhone/Android, fully responsive on
iPad and desktop.

## 1. Tech stack & project setup

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Backend | Next.js Server Actions + Route Handlers |
| Database | MySQL via Prisma ORM 7 (`@prisma/adapter-mariadb` driver adapter) |
| PDF export | `jspdf` + `jspdf-autotable` |
| PWA | Web App Manifest (`app/manifest.ts`) + a hand-written offline service worker |

This repo is already scaffolded and all dependencies are installed. For
reference, this is how it was created:

```bash
npx create-next-app@latest grocery-planner \
  --typescript --tailwind --app --src-dir --import-alias "@/*"

cd grocery-planner
npm install prisma @prisma/client @prisma/adapter-mariadb mariadb dotenv server-only \
  jspdf jspdf-autotable
npm install -D tsx sharp
npx prisma init --datasource-provider mysql --output ../src/generated/prisma
```

### Local development

```bash
cp .env.example .env          # point DATABASE_URL at your MySQL instance
npm install
npm run db:migrate            # creates tables (prompts for a migration name first run)
npm run db:seed               # loads master data from prisma/data/master-data.json
npm run dev                   # http://localhost:3000
```

Useful scripts (see `package.json`):

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | `prisma generate` + production build |
| `npm run db:migrate` | Create/apply a migration locally |
| `npm run db:deploy` | Apply migrations in production (no prompts) |
| `npm run db:seed` | Seed categories, shops and items |
| `npm run db:import -- "./Grocery database.csv"` | Import the real spreadsheet (see below) |
| `npm run db:studio` | Prisma Studio, a GUI for the database |

### Importing "Grocery database.xlsx"

The seed script ships with a representative Tamil/English master list so the
app works out of the box. To load your actual spreadsheet:

1. In Excel/Numbers/Sheets, **File → Save As / Export → CSV (UTF-8)**.
2. Keep (or rename) the header row to include: `Grocery`, `Grocery.1`,
   `Type`, `Qty Type`, `From` (aliases like "English", "Category", "Unit
   Type", "Shop" are also recognized — see `prisma/import-csv.ts`).
3. Run:

   ```bash
   npm run db:import -- "./Grocery database.csv"
   ```

The importer is idempotent (safe to re-run), creates categories/shops on
demand, and reports anything it had to skip.

Items sold in inconsistent pack sizes (soaps, pastes, shampoos, ...) can be
marked for the quantity/unit editor by adding two optional columns to the
same CSV: `Unit` (pack size, e.g. `200`) and `Unit Type` (`g` | `ml` | `kg` |
`L` | blank). A row with a non-blank `Unit` is treated as marked, and its
value becomes the item's default pack size — see
`prisma/data/master-data.json`'s `unit`/`variableUnit` fields for the
current set (synced from a supplementary spreadsheet).

## 2. Prisma schema

`prisma/schema.prisma` models the spreadsheet 1:1:

- **`Category`** — the `Type` column (Tamil + English name).
- **`Shop`** — the `From` column ("Shop By").
- **`Item`** — master catalogue: `Grocery`/`Grocery.1` names, `unitType`
  (`KG | G | L | ML | RS | COUNT`, from `Qty Type`), default shop, default
  quantity, and `hasVariableUnit` — marks items sold in inconsistent pack
  sizes, which get a quantity/unit editor on the create/edit form and while
  shopping (see `src/lib/units.ts`'s `projectPrice` for how the price
  comparison stays fair when the size changes between purchases).
- **`GroceryList`** — one row per month (`monthKey = "YYYY-MM"`, unique),
  with `status: DRAFT | FINALIZED | COMPLETED`.
- **`GroceryListItem`** — a line on a list: quantity, unit snapshot, shop
  override, purchase state (`isPurchased`, `purchasePrice`,
  `previousPrice`).
- **`PriceHistory`** — append-only ledger of what was actually paid, used
  to power the "cheaper/dearer than last time" comparison and the History
  tab.

Prisma 7 uses driver adapters instead of a bundled query engine binary —
`src/lib/prisma.ts` wires up `@prisma/adapter-mariadb` (works against both
MySQL and MariaDB) behind a lazily-initialized Proxy, so `next build` never
needs a live database connection just to build, and caches a single client
instance across hot reloads.

## 3. The unit-aware stepper

`src/lib/units.ts` centralizes the exact stepper logic from the spec, and
`src/components/Stepper.tsx` is the iOS-style `+`/`−` control that uses it
(press-and-hold to repeat, tap the value to type an exact amount):

```ts
export const UNIT_STEP: Record<UnitType, number> = {
  G: 50,    // 50 → 100 → 150
  ML: 50,
  KG: 0.5,  // 0.5 → 1 → 1.5
  L: 0.5,
  RS: 10,   // ₹10 → ₹20
  COUNT: 1, // 1 → 2 → 3 (blank "Qty Type")
};
```

`increment` / `decrement` step, then round to the unit's display precision
(0 decimals for g/ml/Rs/count, 1 decimal for kg/L) so repeated taps never
drift into floating-point noise. The same module drives quantity display
(`formatQty`), the master-item unit picker, and the CSV importer's
`Qty Type → UnitType` mapping.

## 4. PDF generation

`src/lib/pdf.ts` (`buildGroceryPdf` / `downloadGroceryPdf`) renders the
traditional print sheet with `jspdf-autotable`:

```
[S.No] | [Item Name] | [Quantity] | [Unit] | [blank — Price]
```

- Grouped by shop when printing "All shops"; a single flat table when
  filtered to one shop.
- A blank "Total" line is left for hand totals at the till.
- Tamil names print automatically if you drop a base64-encoded Unicode
  font at `public/fonts/NotoSansTamil-Regular.base64.txt` (jsPDF's
  built-in fonts are Latin-only); otherwise it gracefully falls back to
  English-only rows.
- Invoked from `ExportPdfButton` on the finalized list screen, filtered to
  whatever shop chip is currently selected.

## 5. Deploying to Railway

1. **Push this repo to GitHub** (or connect your fork).
2. In Railway: **New Project → Deploy from GitHub repo**, pick this repo.
3. **Add a MySQL plugin**: New → Database → Add MySQL (not Postgres —
   the schema's `datasource` provider is `mysql`). Railway creates
   `DATABASE_URL` and friends on that service automatically.
4. On the **web service**, add an environment variable:
   - `DATABASE_URL` → reference the MySQL plugin's URL, e.g.
     `${{ MySQL.DATABASE_URL }}` in Railway's variable picker.
5. **Build & start commands** (Railway auto-detects Next.js, but to be
   explicit under Settings → Deploy):
   - Build: `npm run build` (this runs `prisma generate` first)
   - Start: `npm run start`
6. **Run migrations against the Railway database** once, either via
   Railway's shell (`railway run npm run db:deploy`) or by adding a
   **Release Command** of `npm run db:deploy` under Settings → Deploy —
   Railway runs it before each deploy goes live.
7. **Seed master data** the same way: `railway run npm run db:seed`, or
   `railway run npm run db:import -- "./Grocery database.csv"` for your
   real spreadsheet.
8. Railway assigns a public domain automatically (Settings → Networking →
   Generate Domain). Because the manifest's `start_url` is relative, no
   further config is needed for "Add to Home Screen" to work on that
   domain.

Local MySQL alternative for development, if you don't want to depend on
Railway while iterating:

```bash
docker run --name grocery-mysql -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=grocery -p 3306:3306 -d mysql:8
```

## App structure

```
prisma/
  schema.prisma          Database schema
  seed.ts                Seeds prisma/data/master-data.json (+ optional demo history)
  import-csv.ts           npm run db:import — loads the real spreadsheet export
  master-import.ts        Shared idempotent upsert logic used by both scripts
src/
  app/
    page.tsx               Home — current month card, previous lists
    lists/[id]/page.tsx     Draft editor / finalized+shopping views (mode switch)
    master/page.tsx         Master List tab — browse/search/edit the catalogue
    history/page.tsx        History tab — spend per month, biggest price moves
    items/[id]/page.tsx      Per-item price history
    manifest.ts              Web App Manifest
  components/
    Stepper.tsx              The unit-aware +/- control
    Sheet.tsx                iOS bottom sheet (used for add-item, edit, purchase)
    PriceDelta.tsx           Green/red up-down price comparison badge
    AppNav.tsx               Bottom tab bar (mobile) / sidebar (iPad & desktop)
    list/                    Draft editor, finalized list, shopping mode, PDF button
    master/                  Master catalogue browser + editor sheet
  lib/
    units.ts                 Stepper steps, formatting, Qty Type parsing
    pdf.ts                    Print-sheet PDF builder
    prisma.ts, queries.ts     DB client + read queries (Decimal → plain number)
    actions.ts                Server Actions (create/finalize lists, record purchases, …)
public/
  sw.js                      Offline shell service worker
  icons/                     Manifest icons (generated by scripts/generate-icons.mjs)
```

## PWA notes

- `app/manifest.ts` declares a standalone, portrait app named "Grocery".
- `public/sw.js` is a small hand-written service worker: network-first for
  pages (so list data is never stale while online) with a cached fallback,
  and cache-first for hashed static assets. It's registered by
  `ServiceWorkerRegistrar` in production builds only.
- Icons are generated from `public/icons/icon-source.png` via
  `node scripts/generate-icons.mjs` (requires the `sharp` dev dependency).
- `viewport-fit: cover` plus `env(safe-area-inset-*)` padding keep content
  clear of the iPhone notch/home indicator once installed to the home
  screen.
