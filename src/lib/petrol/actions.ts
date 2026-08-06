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

type FuelEntryInput = {
  vehicleId: number;
  amount: number;
  /** UTC ISO datetime string, already resolved from the browser's local timezone. */
  refueledAt: string;
  latitude?: number | null;
  longitude?: number | null;
  locationLabel?: string | null;
};

export async function createFuelEntry(input: FuelEntryInput): Promise<ActionResult<{ id: number }>> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return fail("Enter a valid amount.");
  if (!Number.isFinite(input.vehicleId)) return fail("Choose a vehicle.");

  const refueledAt = new Date(input.refueledAt);
  if (Number.isNaN(refueledAt.getTime())) return fail("Enter a valid date and time.");

  const entry = await prisma.fuelEntry.create({
    data: {
      vehicleId: input.vehicleId,
      amount: Math.round(input.amount * 100) / 100,
      refueledAt,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      locationLabel: input.locationLabel ?? null,
    },
  });

  revalidatePath("/petrol");
  return { ok: true, data: { id: entry.id } };
}

export async function updateFuelEntry(id: number, input: FuelEntryInput): Promise<ActionResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return fail("Enter a valid amount.");
  if (!Number.isFinite(input.vehicleId)) return fail("Choose a vehicle.");

  const refueledAt = new Date(input.refueledAt);
  if (Number.isNaN(refueledAt.getTime())) return fail("Enter a valid date and time.");

  await prisma.fuelEntry.update({
    where: { id },
    data: {
      vehicleId: input.vehicleId,
      amount: Math.round(input.amount * 100) / 100,
      refueledAt,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      locationLabel: input.locationLabel ?? null,
    },
  });

  revalidatePath("/petrol");
  return { ok: true };
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

type VehicleInput = {
  name: string;
  type: VehicleType;
  registrationNumber?: string | null;
  /** yyyy-mm-dd, or null/empty to clear. */
  insuranceRenewal?: string | null;
};

function parseInsuranceRenewal(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Admin only — vehicle setup (name, registration, insurance) is household admin data. */
export async function createVehicle(input: VehicleInput): Promise<ActionResult<{ id: number }>> {
  if (!(await isAdminSession())) return fail("Admin only.");
  const name = input.name.trim();
  if (!name) return fail("Enter a vehicle name.");

  const vehicle = await prisma.vehicle.create({
    data: {
      name,
      type: input.type,
      registrationNumber: input.registrationNumber?.trim() || null,
      insuranceRenewal: parseInsuranceRenewal(input.insuranceRenewal) ?? null,
    },
  });

  revalidatePath("/petrol");
  return { ok: true, data: { id: vehicle.id } };
}

/** Admin only — see createVehicle. */
export async function updateVehicle(id: number, input: VehicleInput): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");
  const name = input.name.trim();
  if (!name) return fail("Enter a vehicle name.");

  await prisma.vehicle.update({
    where: { id },
    data: {
      name,
      type: input.type,
      registrationNumber: input.registrationNumber?.trim() || null,
      insuranceRenewal: parseInsuranceRenewal(input.insuranceRenewal) ?? null,
    },
  });

  revalidatePath("/petrol");
  return { ok: true };
}
