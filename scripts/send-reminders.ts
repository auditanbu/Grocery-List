/*
 * Daily reminder trigger.
 *
 * Railway's cron runs a service command on a schedule rather than making an
 * HTTP request, so this script is the bridge: it POSTs the reminder endpoint
 * with the shared secret. Any external scheduler (cron-job.org, GitHub
 * Actions) can call that URL directly instead and skip this entirely.
 *
 *   npm run cron:reminders
 */
import "dotenv/config";

const appUrl = process.env.APP_URL;
const secret = process.env.CRON_SECRET;

if (!appUrl) {
  console.error("APP_URL is not set.");
  process.exit(1);
}
if (!secret) {
  console.error("CRON_SECRET is not set.");
  process.exit(1);
}

const url = `${appUrl.replace(/\/$/, "")}/api/budget/reminders`;

const response = await fetch(url, {
  method: "POST",
  headers: { "x-cron-secret": secret },
});

const body = await response.text();
console.log(`${response.status} ${body}`);
process.exit(response.ok ? 0 : 1);
