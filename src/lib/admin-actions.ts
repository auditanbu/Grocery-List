"use server";

import { ADMIN_PIN, clearAdminCookie, setAdminCookie } from "./admin";
import type { ActionResult } from "./actions";

export async function adminLogin(pin: string): Promise<ActionResult> {
  if (pin.trim() !== ADMIN_PIN) return { ok: false, error: "Wrong PIN." };
  await setAdminCookie();
  return { ok: true };
}

export async function adminLogout(): Promise<ActionResult> {
  await clearAdminCookie();
  return { ok: true };
}
