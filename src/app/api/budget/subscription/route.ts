import { savePushSubscription } from "@/lib/budget/push-actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Chrome rotates push endpoints and fires `pushsubscriptionchange` in the
 * service worker. A worker cannot invoke a Server Action, so it re-registers
 * through this endpoint instead — without it, a rotated endpoint silently
 * stops receiving reminders until the user next opens the app.
 *
 * Unauthenticated for the same reason savePushSubscription is: reminders are
 * per-device and open to every family member.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const result = await savePushSubscription({
    endpoint: body.endpoint ?? "",
    p256dh: body.keys?.p256dh ?? "",
    auth: body.keys?.auth ?? "",
    userAgent: request.headers.get("user-agent"),
  });

  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ ok: true });
}
