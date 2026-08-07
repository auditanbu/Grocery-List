import { createHash, timingSafeEqual } from "node:crypto";

import { runReminderSweep } from "@/lib/budget/reminders";

export const dynamic = "force-dynamic";
// web-push signs VAPID tokens with Node's crypto.
export const runtime = "nodejs";

/**
 * Hash both sides before comparing: timingSafeEqual throws when the buffers
 * differ in length, which would itself leak the secret's length.
 */
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function authorize(request: Request): Response | null {
  const expected = process.env.CRON_SECRET;
  // Fail closed — an unset secret must never mean "open to everyone".
  if (!expected) {
    return Response.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (!provided || !secretMatches(provided, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

/** Runs the sweep for real. Safe to call repeatedly — sends are deduped. */
export async function POST(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const result = await runReminderSweep({ dryRun });
  return Response.json(result);
}

/** Always a dry run — a safe way to see what would fire, with no side effects. */
export async function GET(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;

  const result = await runReminderSweep({ dryRun: true });
  return Response.json(result);
}
