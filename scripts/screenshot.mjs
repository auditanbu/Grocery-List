/**
 * Screenshots the running app at phone and desktop width.
 *
 * Exists so a change can be *seen* before it is pushed — in a cloud dev
 * session there is no browser pointed at localhost, so the alternative is
 * merging to production and looking at the live site.
 *
 *   node scripts/screenshot.mjs                       # the default screens
 *   node scripts/screenshot.mjs out/ /petrol:petrol   # specific ones
 *
 * Each target is `path` or `path:label`; the label names the file. The
 * current month's list page is discovered from the home page, so it does
 * not have to be passed by id.
 */
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";

/** Playwright is a dev tool, not a dependency of the app — find it wherever it lives. */
async function loadPlaywright() {
  for (const spec of ["playwright", "playwright-core"]) {
    try {
      return await import(spec);
    } catch {
      /* try the next one */
    }
  }
  const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
  return import(pathToFileURL(join(globalRoot, "playwright", "index.mjs")).href);
}

/** The current month's list, if there is one — its id is not knowable up front. */
async function discoverListPath() {
  try {
    const html = await (await fetch(`${BASE}/grocery`)).text();
    const match = html.match(/\/grocery\/lists\/(\d+)/);
    return match ? `/grocery/lists/${match[1]}:list` : null;
  } catch {
    return null;
  }
}

const outDir = process.argv[2] ?? "./shots";
const passed = process.argv.slice(3);
const targets = (
  passed.length
    ? passed
    : [
        "/grocery:grocery",
        (await discoverListPath()) ?? "/grocery:grocery",
        "/grocery/master:master-list",
        "/grocery/history:history",
        "/petrol:petrol",
      ]
).map((target) => {
  const at = target.lastIndexOf(":");
  return at > 0
    ? { path: target.slice(0, at), label: target.slice(at + 1) }
    : { path: target, label: target.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "root" };
});

const { chromium, devices } = await loadPlaywright();
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const failures = [];

// A tall viewport rather than `fullPage`. The app pins its search field and
// tab bar to the bottom of the screen, and a full-page capture stretches the
// image past the viewport those are pinned to — they end up stranded in the
// middle of the picture. A tall window shows the same amount of list with
// everything where it actually sits. FULL_PAGE=1 overrides it.
const fullPage = process.env.FULL_PAGE === "1";
const tall = (height) => (fullPage ? undefined : height);

for (const [view, options] of [
  [
    "phone",
    {
      ...devices["iPhone 14 Pro"],
      viewport: { ...devices["iPhone 14 Pro"].viewport, height: tall(1180) ?? 852 },
    },
  ],
  ["desktop", { viewport: { width: 1280, height: tall(1400) ?? 900 }, deviceScaleFactor: 2 }],
]) {
  const context = await browser.newContext({
    ...options,
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  });
  const page = await context.newPage();

  for (const { path, label } of targets) {
    const file = `${outDir}/${label}-${view}.png`;
    try {
      const response = await page.goto(BASE + path, {
        waitUntil: "networkidle",
        timeout: 45_000,
      });
      // Let the iOS-style transitions settle so nothing is caught mid-fade.
      await page.waitForTimeout(400);
      await page.screenshot({ path: file, fullPage });
      const status = response?.status() ?? 0;
      if (status >= 400) failures.push(`${path} returned ${status}`);
      console.log(`${status}  ${path}  ->  ${file}`);
    } catch (error) {
      failures.push(`${path}: ${error.message}`);
      console.error(`ERR  ${path}  ${error.message}`);
    }
  }

  await context.close();
}

await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} screen(s) failed:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
