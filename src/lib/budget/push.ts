import "server-only";

import webpush from "web-push";

import { prisma } from "../prisma";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  /** Collapses duplicates on the device even if the server sends twice. */
  tag: string;
};

let configured = false;

/**
 * False when no VAPID keys are set. The app has to run fine without them —
 * local development, and `next build`, which must never require env vars (the
 * same reasoning that shaped the lazy client in src/lib/prisma.ts).
 */
function configure(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@example.com",
      publicKey,
      privateKey,
    );
    configured = true;
  }
  return true;
}

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/** Consecutive failures before a subscription is considered dead. */
const MAX_FAILURES = 5;

/**
 * Sends to every stored subscription and prunes dead endpoints. Returns how
 * many accepted the payload.
 */
export async function sendToAll(payload: PushPayload): Promise<number> {
  if (!configure()) return 0;

  const subscriptions = await prisma.pushSubscription.findMany();
  if (subscriptions.length === 0) return 0;

  const body = JSON.stringify(payload);
  let delivered = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
        );
        delivered += 1;
        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: { lastSeenAt: new Date(), failureCount: 0 },
        });
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;

        // The push service is telling us authoritatively that this endpoint
        // is gone — there is nothing to retry.
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription
            .delete({ where: { id: subscription.id } })
            .catch(() => undefined);
          return;
        }

        // Rate limited: not the subscription's fault, leave it alone.
        if (statusCode === 429) return;

        const failureCount = subscription.failureCount + 1;
        if (failureCount >= MAX_FAILURES) {
          await prisma.pushSubscription
            .delete({ where: { id: subscription.id } })
            .catch(() => undefined);
        } else {
          await prisma.pushSubscription
            .update({ where: { id: subscription.id }, data: { failureCount } })
            .catch(() => undefined);
        }
      }
    }),
  );

  return delivered;
}
