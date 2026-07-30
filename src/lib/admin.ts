import "server-only";

import { cookies } from "next/headers";

/** Family/public members need no PIN; admin unlocks with this one. */
export const ADMIN_PIN = "4321";

export const ADMIN_COOKIE = "grocery_admin";
/**
 * Not a secret env var — this is a small family app behind a 4-digit PIN,
 * so a fixed token is enough to stop the cookie being guessed/typed by
 * hand while staying simple. Real access control still happens server-side
 * in every admin-only action.
 */
const ADMIN_TOKEN = "b3e9f2f0c7a3e1c9d20a";
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // stays signed in until logout

export async function isAdminSession(): Promise<boolean> {
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === ADMIN_TOKEN;
}

export async function setAdminCookie(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, ADMIN_TOKEN, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
