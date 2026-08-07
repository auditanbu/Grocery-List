/*
 * Browser-side push helpers. Client-safe by construction — never imports
 * web-push or anything marked "server-only".
 */

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * VAPID keys are URL-safe base64; PushManager wants raw bytes. Backed by an
 * explicit ArrayBuffer so the result is a BufferSource `subscribe()` accepts —
 * a bare `new Uint8Array(n)` is typed over ArrayBufferLike, which isn't.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * `navigator.serviceWorker.ready` never resolves when no worker is registered,
 * and ServiceWorkerRegistrar only registers in production builds — so waiting
 * on it in dev would hang the button forever.
 */
async function readyRegistration(timeoutMs = 5000): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await readyRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export type SubscribeResult =
  | { ok: true; endpoint: string; p256dh: string; auth: string }
  | { ok: false; error: string };

/**
 * Must be called straight from a click handler — both Safari and Chrome
 * require a user gesture for Notification.requestPermission().
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<SubscribeResult> {
  if (!pushSupported()) {
    return {
      ok: false,
      error:
        "This browser can't show reminders. On iPhone, add the app to your Home Screen first.",
    };
  }

  const permission = await Notification.requestPermission();
  if (permission === "denied") {
    // The prompt will not reappear, so point at settings rather than retrying.
    return { ok: false, error: "Notifications are blocked. Allow them in your browser settings." };
  }
  if (permission !== "granted") return { ok: false, error: "Notification permission wasn't granted." };

  const registration = await readyRegistration();
  if (!registration) {
    return { ok: false, error: "Reminders need the installed app (a production build)." };
  }

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    const json = subscription.toJSON();
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!json.endpoint || !p256dh || !auth) {
      return { ok: false, error: "The browser returned an incomplete subscription." };
    }

    return { ok: true, endpoint: json.endpoint, p256dh, auth };
  } catch {
    return { ok: false, error: "Couldn't subscribe to notifications on this device." };
  }
}

/** Returns the endpoint it removed, so the caller can delete the server row. */
export async function unsubscribeFromPush(): Promise<string | null> {
  const subscription = await currentSubscription();
  if (!subscription) return null;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  return endpoint;
}
