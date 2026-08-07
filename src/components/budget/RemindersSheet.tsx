"use client";

import { useEffect, useState, useTransition } from "react";

import { Sheet } from "@/components/Sheet";
import { useAdmin } from "@/lib/admin-context";
import { deletePushSubscription, savePushSubscription, sendTestNotification } from "@/lib/budget/push-actions";
import {
  currentSubscription,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/budget/push-client";

/**
 * Per-device reminder opt-in. Deliberately open to every family member, not
 * just the admin — reminders are useless if only one person can receive them.
 */
export function RemindersSheet({
  open,
  onClose,
  pushConfigured,
  vapidPublicKey,
}: {
  open: boolean;
  onClose: () => void;
  pushConfigured: boolean;
  vapidPublicKey: string | null;
}) {
  const { isAdmin } = useAdmin();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    setMessage(null);
    if (!pushSupported()) {
      setSubscribed(false);
      return;
    }
    currentSubscription().then((subscription) => setSubscribed(subscription !== null));
  }, [open]);

  const enable = () => {
    if (!vapidPublicKey) {
      setError("Reminders aren't configured on the server yet.");
      return;
    }
    setError(null);
    // Must run straight off the click — the permission prompt needs the gesture.
    subscribeToPush(vapidPublicKey).then((result) => {
      if (!result.ok) {
        setError(result.error);
        return;
      }
      startTransition(async () => {
        const saved = await savePushSubscription({
          endpoint: result.endpoint,
          p256dh: result.p256dh,
          auth: result.auth,
          userAgent: typeof navigator === "undefined" ? null : navigator.userAgent,
        });
        if (!saved.ok) {
          setError(saved.error);
          return;
        }
        setSubscribed(true);
        setMessage("Reminders are on for this device.");
      });
    });
  };

  const disable = () => {
    setError(null);
    unsubscribeFromPush().then((endpoint) => {
      startTransition(async () => {
        if (endpoint) await deletePushSubscription(endpoint);
        setSubscribed(false);
        setMessage("Reminders are off for this device.");
      });
    });
  };

  const supported = typeof window === "undefined" ? true : pushSupported();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Reminders"
      subtitle="Get a notification when a bill is due"
    >
      <div className="space-y-4">
        {!pushConfigured ? (
          <p className="rounded-ios bg-ios-orange/10 px-3 py-2.5 text-[14px] text-ios-orange">
            Push notifications aren&rsquo;t configured on the server yet. The due and overdue
            alerts on the budget screen still work.
          </p>
        ) : null}

        {!supported ? (
          <p className="rounded-ios bg-ios-surface-2 px-3 py-2.5 text-[14px] text-ios-label-2">
            This browser can&rsquo;t show reminders. On iPhone, open the Share menu and choose
            &ldquo;Add to Home Screen&rdquo;, then turn reminders on from the installed app.
          </p>
        ) : (
          <button
            type="button"
            onClick={subscribed ? disable : enable}
            disabled={pending || !pushConfigured}
            className={`flex h-12 w-full items-center justify-center rounded-ios text-[17px] font-semibold transition active:scale-[0.98] disabled:opacity-50 ${
              subscribed
                ? "bg-ios-surface-2 text-ios-label ring-1 ring-inset ring-ios-separator"
                : "bg-ios-blue text-white"
            }`}
          >
            {subscribed ? "Turn off on this device" : "Turn on for this device"}
          </button>
        )}

        <p className="text-[13px] text-ios-label-2">
          Each device turns reminders on separately. On iPhone the app must be added to the Home
          Screen first (iOS 16.4 or later).
        </p>

        {isAdmin && pushConfigured ? (
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                const result = await sendTestNotification();
                if (!result.ok) setError(result.error);
                else
                  setMessage(
                    result.data.delivered === 0
                      ? "No devices are subscribed yet."
                      : `Sent to ${result.data.delivered} device${result.data.delivered === 1 ? "" : "s"}.`,
                  );
              })
            }
            disabled={pending}
            className="text-[14px] font-medium text-ios-blue active:opacity-60 disabled:opacity-50"
          >
            Send a test notification
          </button>
        ) : null}

        {message ? <p className="text-[14px] text-ios-green">{message}</p> : null}
        {error ? <p className="text-[14px] text-ios-red">{error}</p> : null}
      </div>
    </Sheet>
  );
}
