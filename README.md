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
| Notifications | Web Push (`web-push` + VAPID) via the service worker |
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
   Type", "Shop" are also recognized — see `prisma/import-csv.ts`). An
   optional `Tanglish` column carries the Tamil name in Latin script
   ("Kadalai Paruppu"); rows that leave it blank get one transliterated
   from their Tamil name.
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
- **`Item`** — master catalogue: `Grocery`/`Grocery.1`/Tanglish names,
  `unitType`
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

The Family Budget module adds `BudgetCategory`, `BudgetExpense` (the recurrence
rule), `BudgetOccurrence` (sparse — only touched dates), `BudgetReminder` (the
push dedupe log) and `PushSubscription`. See §7 for why occurrences are derived
rather than materialized.

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

## 4. Three display languages

Every item carries three names, and one app-wide toggle
(`src/lib/language.tsx`, `LanguageToggle`) cycles between them:

| Code | Field | Example |
|---|---|---|
| `ta` | `Item.nameTa` | கடலை பருப்பு |
| `tl` | `Item.nameTl` | Kadalai Paruppu |
| `en` | `Item.nameEn` | Bengal gram |

`nameTl` ("Tanglish") is the Tamil name written in Latin script — for
anyone who speaks Tamil but reads the script slowly. It is deliberately not
the same thing as `nameEn`, which is a *translation* and isn't what you'd
say at the shop.

`displayName(item, language)` picks which name leads and which trails as
the caption; Tanglish falls back to the Tamil name when an item hasn't been
given one, so a half-filled catalogue still reads sensibly.

Filling the field in:

- The 106 spreadsheet items ship with hand-written Tanglish names in
  `prisma/data/master-data.json` (`tanglish`), applied by `npm run db:seed`
  / `db:resync` / `db:import`.
- Anything typed in later gets one transliterated from its Tamil name by
  `src/lib/tanglish.ts` — rule-based Tamil → Latin, with the voicing
  conventions people actually write (கடலை is "kadalai", not "katalai";
  பருப்பு keeps its doubled "pp").
- The Master List screen shows a **Needs Tanglish** filter chip, an
  editable field on the item form, and (for admins) a **Fill Tanglish
  names** button that runs `fillTanglishNames()` over the catalogue.

## 5. The shopping screen

`ShoppingView` is what you actually hold in the shop, so it stays usable
once the list has been finalized and reality starts diverging from the plan:

- **Search** narrows the list as you type — Tamil, Tanglish, English,
  category or shop name — on top of the shop and category chips.
- **Quantity is editable inline.** Every un-bought row carries the same
  unit-aware stepper the draft editor uses, so "actually, make it 2 kg" is
  one tap rather than a trip back through *Edit list*. Changes are
  optimistic and reconciled against the server (`updateListItem`, which
  accepts `FINALIZED` lists and refuses only `COMPLETED` ones). Once an
  item is checked off its quantity belongs to the purchase sheet, which
  re-prices it, so the stepper drops away.
- **Add item** (`ShopAddSheet`) covers what never made the list. It
  searches the master catalogue server-side, and anything genuinely new can
  be created on the spot — Tamil / Tanglish / English name, category, unit,
  shop — which saves it to the master list and adds it to this one.
  `addListItem` therefore allows `DRAFT` *and* `FINALIZED` lists: reopening
  a finalized list just to add one item would throw away the shopping
  progress.

## 6. PDF generation

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
- Follows the display-language toggle. Tamil takes the html2canvas path
  (jsPDF cannot shape Tamil); English *and* Tanglish are both Latin script,
  so they take the crisp vector `jspdf-autotable` path.

## 7. Family Budget module

`/budget` tracks recurring household bills — rent, EB, insurance, internet,
mobile — on a calendar and a list, covering both past and upcoming dates.
Only an admin (unlocked with the app's PIN, see `src/lib/admin.ts`) can add or
change anything; every other family member has read-only access. The client
only hides the controls — every mutating Server Action re-checks the admin
cookie server-side.

### Occurrences are derived, not stored

`BudgetExpense` is a **rule**, not a list of dates: an anchor date plus an
interval in months (`ONE_OFF`, `MONTHLY`, `EVERY_2_MONTHS`, `QUARTERLY`,
`HALF_YEARLY`, `YEARLY`, or `CUSTOM_MONTHS` with its own "every N months").
Due dates are computed on read by `src/lib/budget/recurrence.ts`, so:

- the calendar works arbitrarily far forward and back with no generator job
  and no horizon to run past;
- editing a rule needs no reconciliation of already-generated rows.

`BudgetOccurrence` is therefore **sparse** — a row exists only once someone has
touched that date (paid it, skipped it, or overridden its amount). Reads take
the union of rule-generated dates and stored rows, so a row whose date the rule
no longer produces still appears, flagged as *moved*, and editing a schedule
can never silently erase payment history.

Occurrence k is always `anchorDate + k * interval` months, computed from the
anchor rather than by stepping off occurrence k−1, and clamped to short months.
A bill due on the 31st therefore gives 31 Jan → 28 Feb → **31** Mar → 30 Apr,
instead of collapsing to the 28th forever. `scripts/check-recurrence.ts`
(`npx tsx scripts/check-recurrence.ts`) asserts this and ~35 other cases.

### Dates are civil strings

Due dates are `"YYYY-MM-DD"` `CHAR(10)` columns, extending the existing
`monthKey` convention rather than using `DATE`/`DateTime`. They sort and range
lexicographically, and nothing round-trips through a `Date` whose timezone
could shift it a day. The only place the real clock is read is
`todayDateKey()` in `src/lib/dates.ts`, which applies India's fixed +5:30 so
"today" is correct even though the container runs UTC.

### Reminders

Two independent channels, so the module is useful even with nothing configured:

1. **In-app alerts** — overdue and due-in-7-days banners on `/budget`. Always
   on, every device, no setup.
2. **Web push** — a notification on the due date, plus a heads-up
   `reminderLeadDays` beforehand (default 2).

Push setup:

```bash
npx web-push generate-vapid-keys     # -> VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
```

Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and `CRON_SECRET`
on the web service. Each family member then opens `/budget` → the bell icon →
**Turn on for this device**. Subscribing is deliberately *not* admin-gated —
reminders are useless if only one person can receive them.

> **On iPhone, web push only works once the app is added to the Home Screen**
> (iOS 16.4+). In a normal Safari tab the API is absent and the sheet says so.
> The in-app alerts still work there.

`POST /api/budget/reminders` runs the daily sweep, authenticated with the
`x-cron-secret` header (an unset `CRON_SECRET` returns 503 — it never falls
open). `GET` on the same URL is always a dry run, which is a safe way to see
what would fire. The sweep is **idempotent**: it writes a `BudgetReminder` row
before sending, and that row's unique key on `(expenseId, dueDate, kind)` means
a re-run sends nothing. Dead endpoints (HTTP 404/410) are pruned automatically.

Trigger it once a day, any of these ways:

- **Coolify scheduled task** (recommended) — on the application, add a
  Scheduled Task with frequency `30 3 * * *` (09:00 IST) and command:

  ```bash
  curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" \
    http://127.0.0.1:3000/api/budget/reminders
  ```

  It runs inside the app container, so the request never leaves the host and
  needs no `APP_URL`. `curl` is installed by the Dockerfile for exactly this.
- **`npm run cron:reminders`** — the same thing over the public URL, for a
  scheduler that runs outside the container. Needs `APP_URL` and `CRON_SECRET`.
- **External scheduler** (free) — cron-job.org or a GitHub Actions
  `schedule` workflow POSTing the URL with the `x-cron-secret` header.

## 8. Deploying to Coolify

The app ships a `Dockerfile`, so Coolify builds and runs it the same way on
any host. Three files do the work:

| File | Role |
|---|---|
| `Dockerfile` | Two-stage build; installs `curl`, runs as the `node` user |
| `docker-entrypoint.sh` | `prisma migrate deploy`, then `npm run start` |
| `src/app/api/health/route.ts` | Liveness probe for the health check |

The image keeps the full `node_modules` rather than using Next's
`output: "standalone"`, because the container needs the `prisma` CLI to run
migrations on boot and `tsx` to run `db:import` / `db:seed` from Coolify's
terminal. See the comment at the top of the `Dockerfile`.

### Steps

1. **Create the database** — New Resource → **MySQL** (not Postgres; the
   schema's `datasource` provider is `mysql`). Note the generated user,
   password, database name, and the **internal** hostname.
2. **Create the application** — New Resource → Public/Private Repository,
   point it at this repo, and set **Build Pack: Dockerfile**. Coolify picks
   up the `Dockerfile` at the repo root; leave the port at `3000`.
3. **Environment variables** on the application:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `mysql://<user>:<pass>@<internal-host>:3306/<db>` |
   | `APP_URL` | `https://your-domain` |
   | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | see §7 |
   | `CRON_SECRET` | any random string |

   Mark the two VAPID secrets and `CRON_SECRET` as secret values. All of
   them are read at request time, so none is baked into the image and
   changing one only needs a restart, not a rebuild.
4. **Domain** — set it in Coolify (Configuration → Domains) and point an `A`
   record at the host. Coolify's proxy issues the Let's Encrypt certificate.
   Because the manifest's `start_url` is relative, "Add to Home Screen"
   works on the new domain with no further config.
5. **Health check** — path `/api/health`, port `3000`. The endpoint returns
   200 whenever the process is alive and reports the database separately in
   its body; see the comment in the route for why it does not fail on a
   database outage.
6. **Deploy.** Migrations apply automatically — `docker-entrypoint.sh` runs
   `prisma migrate deploy` before the server starts, and aborts the boot if
   the database is unreachable, so a bad `DATABASE_URL` fails the deploy
   instead of going live broken. There is no separate release command to
   configure.
7. **Seed master data** from the application's terminal in Coolify:
   `npm run db:seed`, or `npm run db:import -- "./Grocery database.csv"`
   for the real spreadsheet.
8. **Reminders** — add the scheduled task described in §7.

### Migrating an existing Railway deployment

1. Dump from Railway and restore into the Coolify database *before* the
   first deploy, so `prisma migrate deploy` sees the schema as current:

   ```bash
   mysqldump --single-transaction --no-tablespaces <railway-url> > grocery.sql
   mysql <coolify-url> < grocery.sql
   ```

2. Verify the restore: `_prisma_migrations` should list every directory in
   `prisma/migrations`, and row counts on `Item`, `GroceryList`,
   `PriceHistory` and `BudgetExpense` should match the old database. On the
   first boot the entrypoint then finds nothing to apply.
3. There is no dual-write, so anything entered on Railway after the dump is
   lost — do the cutover in a quiet window and keep Railway running for a
   day or two as a fallback.
4. **A new domain resets web push.** Service worker registrations and the
   `PushSubscription` rows behind them are bound to an origin, so every
   family member must re-add the app to their Home Screen and re-enable
   reminders (`/budget` → bell → **Turn on for this device**). The rows
   pointing at the old origin are dead weight; they are pruned automatically
   after five consecutive send failures, or can be cleared in one go:

   ```sql
   DELETE FROM PushSubscription;
   ```

Local MySQL alternative for development, if you don't want to depend on a
remote database while iterating:

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
    budget/page.tsx          Family Budget — calendar + list, ?month=YYYY-MM
    budget/expenses/page.tsx  Manage the recurring expense rules (admin)
    api/budget/reminders/route.ts    Daily reminder sweep (x-cron-secret)
    api/budget/subscription/route.ts Re-register a rotated push endpoint
    api/health/route.ts      Liveness probe for the container health check
    manifest.ts              Web App Manifest
  components/
    Stepper.tsx              The unit-aware +/- control
    Sheet.tsx                iOS bottom sheet (used for add-item, edit, purchase)
    PriceDelta.tsx           Green/red up-down price comparison badge
    AppNav.tsx               Bottom tab bar (mobile) / sidebar (iPad & desktop)
    list/                    Draft editor, finalized list, shopping mode, PDF button,
                             ShopAddSheet (add an item mid-shop)
    master/                  Master catalogue browser + editor sheet
    budget/                  Calendar grid, list view, expense + payment sheets
  lib/
    units.ts                 Stepper steps, formatting, Qty Type parsing
    tanglish.ts               Tamil → Latin transliteration (Tanglish fallback)
    language.tsx              Tamil/Tanglish/English toggle + displayName()
    pdf.ts                    Print-sheet PDF builder
    prisma.ts, queries.ts     DB client + read queries (Decimal → plain number)
    actions.ts                Server Actions (create/finalize lists, record purchases, …)
    dates.ts                  monthKey + "YYYY-MM-DD" civil-date helpers
    budget/                   recurrence.ts (rule maths), queries, actions,
                              push.ts / push-client.ts, reminders.ts
scripts/
  check-recurrence.ts        Assertions for the recurrence maths (npx tsx)
  send-reminders.ts          Daily cron trigger (npm run cron:reminders)
public/
  sw.js                      Offline shell service worker + push handlers
  icons/                     Manifest icons (generated by scripts/generate-icons.mjs)
Dockerfile                   Production image (see §8)
docker-entrypoint.sh         Applies migrations, then starts the server
.dockerignore                Keeps host node_modules/.next/.env out of the build
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
