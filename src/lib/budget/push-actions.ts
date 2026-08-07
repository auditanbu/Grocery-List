"use server";

import { isAdminSession } from "../admin";
import { prisma } from "../prisma";
import { sendToAll } from "./push";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
  label?: string | null;
};

/**
 * Deliberately NOT admin-gated: every family member needs reminders on their
 * own device, and read access to the module is open anyway. Kept in its own
 * file so the budget's admin-only action surface stays obviously separate.
 */
export async function savePushSubscription(
  input: PushSubscriptionInput,
): Promise<ActionResult> {
  const endpoint = input.endpoint?.trim();
  if (!endpoint || !endpoint.startsWith("https://")) return fail("Invalid subscription.");
  if (endpoint.length > 512) return fail("That browser's subscription is too long to store.");
  if (!input.p256dh || !input.auth) return fail("Invalid subscription keys.");
  if (input.p256dh.length > 255 || input.auth.length > 255) return fail("Invalid subscription keys.");

  const data = {
    p256dh: input.p256dh,
    auth: input.auth,
    userAgent: input.userAgent?.slice(0, 255) || null,
    label: input.label?.slice(0, 64) || null,
    lastSeenAt: new Date(),
    failureCount: 0,
  };

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, ...data },
    update: data,
  });

  return { ok: true };
}

/** Not admin-gated, for the same reason as savePushSubscription. */
export async function deletePushSubscription(endpoint: string): Promise<ActionResult> {
  if (!endpoint) return { ok: true };
  // deleteMany rather than delete: a stale endpoint should be a no-op, not a crash.
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return { ok: true };
}

/** Admin only — a verification aid, not part of the reminder flow. */
export async function sendTestNotification(): Promise<ActionResult<{ delivered: number }>> {
  if (!(await isAdminSession())) return fail("Admin only.");

  const delivered = await sendToAll({
    title: "Family Budget",
    body: "Reminders are working on this device.",
    url: "/budget",
    tag: "budget-test",
  });

  return { ok: true, data: { delivered } };
}
