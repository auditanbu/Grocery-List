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
| `npm run db:audit-prices` | List price-history rows that look like testing leftovers |
| `npm run db:studio` | Prisma Studio, a GUI for the database |

### Seeing a change without deploying

Production runs on Coolify off `main`, so "merge and look at the live site"
is the slowest possible way to review a change — and it reviews it after it
is already live. `scripts/preview.sh` brings the whole thing up from nothing
and photographs it instead:

```bash
./scripts/preview.sh                     # DB, migrations, demo data, dev server, screenshots
./scripts/preview.sh /petrol:petrol      # just one screen
```

It writes `shots/<screen>-phone.png` and `shots/<screen>-desktop.png` (both
gitignored), starting a local MariaDB and installing dependencies only if
they are missing, so re-running it after an edit just re-takes the pictures.
It refuses to run unless `DATABASE_URL` points at localhost — the demo lists
it seeds must never reach the Coolify database.

This is what makes a cloud coding session reviewable: there is no browser
pointed at `localhost:3000` in one, so the screenshots are the only way to
see a change before it is pushed. On your own machine `npm run dev` and a
browser are still the faster loop.

`scripts/screenshot.mjs` can be pointed at any running instance on its own:

```bash
BASE_URL=https://grocery.example.com node scripts/screenshot.mjs ./shots
```

Screens are given as `path:label`; with none passed it shoots the grocery
home, the current month's list (found by id from the home page), the master
list, history and petrol. `FULL_PAGE=1` captures the entire scroll height
instead of a tall window, at the cost of misplacing the pinned search field
and tab bar.

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

Items sold by the packet (soaps, pastes, shampoos, ...) carry a **pack
size**, added through two optional columns on the same CSV: `Unit` (the
size, e.g. `200`) and `Unit Type` (`g` | `ml` | `kg` | `L` | blank). A row
with a non-blank `Unit` is treated as packaged: the item becomes countable
at one pack, and `200 g` lands in `sizeValue`/`sizeUnit` rather than in the
quantity — see `prisma/data/master-data.json`'s `unit`/`variableUnit`
fields for the current set (synced from a supplementary spreadsheet).

## 2. Prisma schema

`prisma/schema.prisma` models the spreadsheet 1:1:

- **`Category`** — the `Type` column (Tamil + English name).
- **`Shop`** — the `From` column ("Shop By").
- **`Item`** — master catalogue: `Grocery`/`Grocery.1`/Tanglish names,
  `unitType`
  (`KG | G | L | ML | RS | COUNT`, from `Qty Type`), default shop, default
  quantity, and `sizeValue`/`sizeUnit` — the **pack size**, what one of the
  item comes in (a 200 g tube of paste). Only countable items carry one:
  the quantity then counts packs and the size says how big each is. Null
  means the item is sold loose and its quantity is already the measure
  (2 kg of dal).
- **`GroceryList`** — one row per month (`monthKey = "YYYY-MM"`, unique),
  with `status: DRAFT | FINALIZED | COMPLETED`.
- **`GroceryListItem`** — a line on a list: quantity, unit and pack-size
  snapshot (`sizeValue`/`sizeUnit` — the size is re-typed while shopping
  when the shop only has 150 g), shop override, purchase state
  (`isPurchased`, `purchasePrice`, `previousPrice`, and the
  `previousQuantity`/`previousSize*` the comparison needs).
- **`PriceHistory`** — append-only ledger of what was actually paid, at
  which quantity and pack size, used to power the "cheaper/dearer than last
  time" comparison and the History tab.
- **`FamilyMember`** / **`FamilyRelationship`** — the Family Tree module
  (see §6): one row per person, and a directed `PARENT_OF` or `SPOUSE_OF`
  edge between two of them.

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
- **The size rides with the name** as a pill (`SizePill`), on every screen
  that lists items — the draft editor, the finalized list, the shopping
  view. The name alone does not say which tin is meant, and the size is
  what you match against the shelf. A chip rather than part of the name
  string so a long name truncates and the size still does not, and so a
  screen showing two names (the draft editor) carries one pill for the row
  rather than a suffix on each. The figure on the right of a row is then
  just the pack count — repeating the size there reads as a different
  number. The purchase sheet, whose title is plain text, appends it with
  `formatNameWithSize` instead, and follows the size *actually bought*, so
  correcting it to 150 g re-titles the sheet you are typing the price into.
  The sheet opens with the cursor already in the price field (a ref, not
  `autoFocus` — the sheet is portalled and reuses the same input from one
  item to the next, so nothing remounts for that attribute to fire on), and
  shows the last three prices paid, with *See all* for the rest.
  Loose items have no size and are untouched: their quantity is already the
  measure.
- **Quantity is editable inline.** Every un-bought row carries the same
  unit-aware stepper the draft editor uses, so "actually, make it 2 kg" is
  one tap rather than a trip back through *Edit list*. Changes are
  optimistic and reconciled against the server (`updateListItem`, which
  accepts `FINALIZED` lists and refuses only `COMPLETED` ones). Once an
  item is checked off the row's stepper drops away — its quantity is then
  the purchase sheet's business, because changing it has to re-price the
  item too.
- **The purchase sheet corrects the size and the quantity** from one
  **Size & quantity** row: two pills, size then quantity, each opening its
  own editor underneath. They are kept apart because they go wrong for
  different reasons — the shop only had the 150 g tube (size), or you
  grabbed two (quantity) — but at the shelf you usually change neither, so
  neither takes up room until tapped. The size pill is there for anything
  counted in packs whether or not a size has ever been filled in (it reads
  *Add size* then): the item nobody has sized yet is exactly the one you
  are holding when you notice it is a 650 ml bottle, and a size filled in
  where the master item has **none** seeds the master too
  (`updateListItem`), so next month's list starts with it. Never an
  overwrite — a master item that already has a size keeps it, because then
  the row really is the one-off. Items measured in g/ml/kg/L carry their
  amount in the quantity and have no size to set.
  Saving applies both through `updateListItem` before `recordPurchase`, so
  the price you type is recorded against what actually went in the basket,
  and the `PriceHistory` row snapshots quantity *and* size together.
- **The purchase sheet also moves the row to another shop.** A row's shop
  is a copy of the master item's default, taken when it was added
  (`addListItem`), so changing that default later leaves lists already made
  untouched — deliberately, since a finalized list is a plan you are walking
  through, not a view of the catalogue. The cost was that a row whose shop
  had since changed was stranded: the shop picker lived in `DraftEditor`,
  which only renders for drafts. `PurchaseSheet` now carries a **Bought at**
  row, so it can be corrected in the aisle and the price is recorded against
  the shop it was really bought from. It sits at the foot of the sheet,
  under the price history: the copied shop is usually already right, so it
  is the one field here you rarely touch. `updateListItem` refuses a move
  that would collide with the same item already on the list under the target
  shop, naming that shop.
- **The price and its button sit one row under the quantity**, which is the
  order the questions come at the shelf: how much did you take, what did it
  cost, done. The ₹ field and *Mark as bought* share that row — entering a
  price and confirming it is one motion — and Enter saves as well as the
  button does. Under them is only what informs the number: the shelf-price
  chip, the live delta, and the tappable rate line. (A *same as last time*
  pill that copied the old price in used to sit there; it went unused and
  is gone.) The sheet's
  pinned footer is left for *Uncheck item*, and on an un-bought row there
  is no footer at all.
- **The shelf prices one, the list counts eight.** A sticker saying ₹34 a
  soap, with 8 on the list, used to mean doing ₹272 in your head at the
  shelf — and a slip there lands in `PriceHistory`, where every later
  comparison reads it as a real price move. So the shelf figure is typed as
  it is read and a chip under the field offers the product:
  "₹34.00 each = ₹272.00 for 8 packs", one tap to fill it in. Weighed rows
  get the other half — "₹60.00/kg = ₹90.00 for 1.5 kg" — quoted against
  whichever basis the rate line is set to, so cycling that to 100 g makes
  the chip read "₹42.00/100 g = ₹105.00 for 250 g", the way the shop quotes
  it. `totalFromShelfPrice` (`src/lib/units.ts`) does the arithmetic on
  `projectPrice`; the chip hides once tapped, so it can never offer to
  multiply its own answer, and comes back the moment the field is edited by
  hand. What is saved is unchanged — the total for the row — and RS-priced
  rows, whose quantity is already rupees, get no chip.
- **Every comparison runs on packs × size** (`totalAmount` in
  `src/lib/units.ts`, then `projectPrice`). ₹95 for one 150 g tube against
  ₹95 for one 200 g tube is dearer, not "same as last time", and the per-kg
  figure under the price pill says by how much. The History tab's **biggest price
  moves** runs on the same figures, and is ranked by them: comparing the
  raw rupees made ₹690 for two packets against ₹340 for one look like a
  103% hike rather than the ₹5 a packet it is, and floated every such row
  to the top of the list. Each of those rows names the amount the price was
  paid for ("₹690.00 for 2 × 500 g" — a price with no amount against it
  says nothing) and **opens in place** (`PriceMoves`): the last three
  purchases unfold under it, with *Show all* going on to the item's own
  page for the full record. One row at a time, since two open rows push the
  rest of the comparison off-screen. The entries are fetched per item on
  first open through `getItemPriceHistory` and kept, so re-opening a row
  does not blink — the same shape the draft editor's price-history
  expander already uses.
- **A stray price can be taken out**, from the item's own page
  (*Show all*), admin-only and confirmed: `deletePriceEntry`. Price history
  is append-only otherwise, and stays that way — this is the one door, for
  the rows left behind by trying the app out, which otherwise sit in
  "biggest price moves" forever pretending to be real moves. A price
  recorded **on a list** is refused, because the list row still says what
  was paid for it; unchecking the item there removes both together
  (`undoPurchase`), which is the only way the two stay in step. The same
  rows can be found and deleted from a terminal with
  `npm run db:audit-prices -- --delete-ids 41,57`.
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

## 7. Deploying to Coolify

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

   It is read at request time, so it is never baked into the image and
   changing it only needs a restart, not a rebuild.
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

### Migrating an existing Railway deployment

1. Dump from Railway and restore into the Coolify database *before* the
   first deploy, so `prisma migrate deploy` sees the schema as current:

   ```bash
   mysqldump --single-transaction --no-tablespaces <railway-url> > grocery.sql
   mysql <coolify-url> < grocery.sql
   ```

2. Verify the restore: `_prisma_migrations` should list every directory in
   `prisma/migrations`, and row counts on `Item`, `GroceryList`,
   `PriceHistory` and `FuelEntry` should match the old database. On the
   first boot the entrypoint then finds nothing to apply.
3. There is no dual-write, so anything entered on Railway after the dump is
   lost — do the cutover in a quiet window and keep Railway running for a
   day or two as a fallback.
Local MySQL alternative for development, if you don't want to depend on a
remote database while iterating:

```bash
docker run --name grocery-mysql -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=grocery -p 3306:3306 -d mysql:8
```

## 6. Family Tree module

Browse and grow a genealogy tree at `/family`. The initial tree was
imported from `Family_tree.xlsx` — not a normal spreadsheet table, but a
PowerPoint/Excel **SmartArt org chart** used to draw a family tree, so it
had to be parsed differently from the grocery CSV:

- Excel stores each SmartArt shape's text and its parent/child links in
  `xl/diagrams/data1.xml` inside the `.xlsx` (a hierarchy of `<pt>` shapes
  connected by `<cxn>` edges), not in worksheet cells.
- That XML was parsed once to produce `prisma/data/family-tree.json` — a
  flat list of members (keyed by the shape's stable `modelId` GUID) and
  `PARENT_OF` / `SPOUSE_OF` edges between them, in the same order the tree
  is walked from its root.
- `prisma/import-family-tree.ts` loads that JSON idempotently (matched by
  the GUID, stored as `FamilyMember.importKey`, so re-seeding updates
  existing rows instead of creating duplicates — several people in this
  family share a first name, so matching by name alone wouldn't work) and
  runs as part of `npm run db:seed`.
- The chart only distinguished spouses from children for the root couple
  (via a SmartArt "assistant" shape); every other link was imported as
  `PARENT_OF` exactly as authored. A box the original chart left blank
  imports as an unnamed placeholder member. Use the "Fix" control in a
  person's relationship list (admin only) to reclassify a relationship the
  import guessed wrong, or the "Unlink" button to remove it — both are
  everyday edits, not schema changes.

From there the tree is meant to grow: any visitor can add a spouse, child,
or parent from a person's card, or start an unconnected "New branch";
`src/lib/family/queries.ts`'s `getFamilyTree` walks the `FamilyMember` /
`FamilyRelationship` graph into nested nodes for the UI, resolving each
person's spouse(s) alongside them and their children below.

## App structure

```
prisma/
  schema.prisma          Database schema
  seed.ts                Seeds prisma/data/master-data.json + family-tree.json (+ optional demo history)
  import-csv.ts           npm run db:import — loads the real spreadsheet export
  master-import.ts        Shared idempotent upsert logic used by both scripts
  audit-prices.ts         npm run db:audit-prices — finds test rows in price history
  price-audit.ts          Which rows count as suspect, kept free of the database
  import-family-tree.ts   Idempotent import of prisma/data/family-tree.json
  data/family-tree.json   Members + relationships extracted from Family_tree.xlsx's SmartArt
src/
  app/
    page.tsx               Home — current month card, previous lists
    lists/[id]/page.tsx     Draft editor / finalized+shopping views (mode switch)
    master/page.tsx         Master List tab — browse/search/edit the catalogue
    history/page.tsx        History tab — spend per month, biggest price moves
    items/[id]/page.tsx      Per-item price history
    api/health/route.ts      Liveness probe for the container health check
    family/page.tsx          Family Tree module
    manifest.ts              Web App Manifest
  components/
    Stepper.tsx              The unit-aware +/- control
    Sheet.tsx                iOS bottom sheet (used for add-item, edit, purchase)
    PriceDelta.tsx           Green/red up-down price comparison badge
    AppNav.tsx               Bottom tab bar (mobile) / sidebar (iPad & desktop)
    list/                    Draft editor, finalized list, shopping mode, PDF button,
                             ShopAddSheet (add an item mid-shop)
    master/                  Master catalogue browser + editor sheet
    family/                  Collapsible tree view, member editor, relationship fixer
  lib/
    units.ts                 Stepper steps, formatting, Qty Type parsing
    tanglish.ts               Tamil → Latin transliteration (Tanglish fallback)
    language.tsx              Tamil/Tanglish/English toggle + displayName()
    pdf.ts                    Print-sheet PDF builder
    prisma.ts, queries.ts     DB client + read queries (Decimal → plain number)
    actions.ts                Server Actions (create/finalize lists, record purchases, …)
    dates.ts                  monthKey helpers and label formatting
    family/                   Family Tree queries, types, and Server Actions
scripts/
  generate-icons.mjs         Manifest icon generator (node, needs sharp)
public/
  sw.js                      Offline shell service worker
  icons/                     Manifest icons (generated by scripts/generate-icons.mjs)
Dockerfile                   Production image (see §7)
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
