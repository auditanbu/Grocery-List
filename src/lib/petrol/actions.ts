"use server";

import { revalidatePath } from "next/cache";

import { isAdminSession } from "../admin";
import { prisma } from "../prisma";
import type { VehicleType } from "./types";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

export async function createFuelEntry(input: {
  vehicleType: VehicleType;
  amount: number;
  /** ISO datetime string, e.g. from an `<input type="datetime-local">`. */
  refueledAt: string;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<ActionResult<{ id: number }>> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return fail("Enter a valid amount.");

  const refueledAt = new Date(input.refueledAt);
  if (Number.isNaN(refueledAt.getTime())) return fail("Enter a valid date and time.");

  const entry = await prisma.fuelEntry.create({
    data: {
      vehicleType: input.vehicleType,
      amount: Math.round(input.amount * 100) / 100,
      refueledAt,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    },
  });

  revalidatePath("/petrol");
  return { ok: true, data: { id: entry.id } };
}

/** Admin only — a logged refuel is a shared spending record. */
export async function deleteFuelEntry(id: number): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");
  await prisma.fuelEntry.delete({ where: { id } });
  revalidatePath("/petrol");
  return { ok: true };
}

/** Admin only — the household budget shouldn't move without a deliberate choice. */
export async function setFuelBudget(amount: number): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");
  if (!Number.isFinite(amount) || amount < 0) return fail("Enter a valid amount.");

  const existing = await prisma.fuelBudget.findFirst({ orderBy: { id: "desc" } });
  if (existing) {
    await prisma.fuelBudget.update({ where: { id: existing.id }, data: { amount } });
  } else {
    await prisma.fuelBudget.create({ data: { amount } });
  }

  revalidatePath("/petrol");
  return { ok: true };
}
