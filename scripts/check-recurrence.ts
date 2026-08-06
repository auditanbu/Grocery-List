/*
 * Sanity checks for the Family Budget recurrence maths — the module's
 * riskiest logic, and this repo has no test framework. Run with:
 *   npx tsx scripts/check-recurrence.ts
 */
import {
  addDaysToDateKey,
  daysInMonth,
  firstWeekdayOfMonth,
  isDateKey,
  todayDateKey,
} from "../src/lib/dates";
import {
  addMonthsClamped,
  nextOccurrenceOnOrAfter,
  occurrencesBetween,
  recurrenceLabel,
} from "../src/lib/budget/recurrence";
import type { RecurrenceRule } from "../src/lib/budget/recurrence";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}\n         expected ${b}\n         actual   ${a}`);
  }
}

const rule = (over: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  recurrence: "MONTHLY",
  intervalMonths: null,
  anchorDate: "2026-01-15",
  endDate: null,
  ...over,
});

console.log("\ndate keys");
check("isDateKey rejects 30 Feb", isDateKey("2026-02-30"), false);
check("isDateKey rejects 29 Feb in a common year", isDateKey("2027-02-29"), false);
check("isDateKey accepts 29 Feb in a leap year", isDateKey("2028-02-29"), true);
check("isDateKey rejects junk", isDateKey("not-a-date"), false);
check("daysInMonth Feb 2028", daysInMonth(2028, 2), 29);
check("daysInMonth Feb 2027", daysInMonth(2027, 2), 28);
check("addDays across a year end", addDaysToDateKey("2026-12-31", 1), "2027-01-01");
check("addDays backwards", addDaysToDateKey("2026-01-01", -1), "2025-12-31");
check("1 Aug 2026 is a Saturday", firstWeekdayOfMonth("2026-08"), 6);

console.log("\nmonth clamping");
check("31 Jan + 1 clamps to Feb", addMonthsClamped("2026-01-31", 1), "2026-02-28");
check("31 Jan + 2 returns to 31", addMonthsClamped("2026-01-31", 2), "2026-03-31");
check("31 Jan + 3 clamps to 30", addMonthsClamped("2026-01-31", 3), "2026-04-30");
check("29 Feb + 12 in a common year", addMonthsClamped("2028-02-29", 12), "2029-02-28");
check("crosses a year boundary", addMonthsClamped("2026-11-15", 3), "2027-02-15");

console.log("\nmonthly series does not drift after clamping");
check(
  "31 Jan monthly, five months",
  occurrencesBetween(rule({ anchorDate: "2026-01-31" }), "2026-01-01", "2026-05-31"),
  ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"],
);

console.log("\nintervals");
check(
  "every 2 months",
  occurrencesBetween(
    rule({ recurrence: "EVERY_2_MONTHS", anchorDate: "2026-01-10" }),
    "2026-01-01",
    "2026-07-31",
  ),
  ["2026-01-10", "2026-03-10", "2026-05-10", "2026-07-10"],
);
check(
  "quarterly",
  occurrencesBetween(
    rule({ recurrence: "QUARTERLY", anchorDate: "2026-02-01" }),
    "2026-01-01",
    "2026-12-31",
  ),
  ["2026-02-01", "2026-05-01", "2026-08-01", "2026-11-01"],
);
check(
  "custom every 4 months",
  occurrencesBetween(
    rule({ recurrence: "CUSTOM_MONTHS", intervalMonths: 4, anchorDate: "2026-01-20" }),
    "2026-01-01",
    "2026-12-31",
  ),
  ["2026-01-20", "2026-05-20", "2026-09-20"],
);
check(
  "yearly",
  occurrencesBetween(
    rule({ recurrence: "YEARLY", anchorDate: "2026-06-05" }),
    "2026-01-01",
    "2029-12-31",
  ),
  ["2026-06-05", "2027-06-05", "2028-06-05", "2029-06-05"],
);

console.log("\none-off");
check(
  "produces exactly one date, in window",
  occurrencesBetween(rule({ recurrence: "ONE_OFF", anchorDate: "2026-03-09" }), "2026-01-01", "2026-12-31"),
  ["2026-03-09"],
);
check(
  "produces nothing outside the window",
  occurrencesBetween(rule({ recurrence: "ONE_OFF", anchorDate: "2026-03-09" }), "2026-04-01", "2026-12-31"),
  [],
);

console.log("\nwindow and end-date boundaries");
check(
  "nothing before the anchor",
  occurrencesBetween(rule({ anchorDate: "2026-06-01" }), "2026-01-01", "2026-05-31"),
  [],
);
check(
  "endDate truncates the series",
  occurrencesBetween(rule({ anchorDate: "2026-01-15", endDate: "2026-03-15" }), "2026-01-01", "2026-12-31"),
  ["2026-01-15", "2026-02-15", "2026-03-15"],
);
check(
  "a mid-series window is not missing its first date",
  occurrencesBetween(rule({ anchorDate: "2020-01-15" }), "2026-08-01", "2026-08-31"),
  ["2026-08-15"],
);
check(
  "a far-future window still resolves",
  occurrencesBetween(rule({ anchorDate: "2026-01-15" }), "2031-03-01", "2031-03-31"),
  ["2031-03-15"],
);
check(
  "inverted window yields nothing",
  occurrencesBetween(rule(), "2026-12-31", "2026-01-01"),
  [],
);
check(
  "CUSTOM_MONTHS with a missing interval degrades to one-off, not a hang",
  occurrencesBetween(
    rule({ recurrence: "CUSTOM_MONTHS", intervalMonths: null, anchorDate: "2026-01-15" }),
    "2026-01-01",
    "2026-12-31",
  ),
  ["2026-01-15"],
);

console.log("\nnext due");
check("next on or after", nextOccurrenceOnOrAfter(rule({ anchorDate: "2026-01-15" }), "2026-08-20"), "2026-09-15");
check("today counts as next", nextOccurrenceOnOrAfter(rule({ anchorDate: "2026-01-15" }), "2026-08-15"), "2026-08-15");
check(
  "an ended series has no next",
  nextOccurrenceOnOrAfter(rule({ anchorDate: "2026-01-15", endDate: "2026-03-15" }), "2026-08-01"),
  null,
);

console.log("\nlabels");
check("preset", recurrenceLabel(rule({ recurrence: "HALF_YEARLY" })), "Half-yearly");
check("custom", recurrenceLabel(rule({ recurrence: "CUSTOM_MONTHS", intervalMonths: 4 })), "Every 4 months");

console.log("\nIndian civil date on a UTC server");
check("late UTC evening is already tomorrow in IST", todayDateKey(new Date("2026-08-06T19:00:00Z")), "2026-08-07");
check("just before the IST rollover", todayDateKey(new Date("2026-08-06T18:29:00Z")), "2026-08-06");
check("UTC midday", todayDateKey(new Date("2026-08-06T12:00:00Z")), "2026-08-06");

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
