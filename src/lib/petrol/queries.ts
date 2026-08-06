import "server-only";

import { prisma } from "../prisma";
import type { FuelEntryDTO, FuelSummaryDTO, VehicleDTO } from "./types";

type DecimalLike = { toNumber(): number } | number | null | undefined;

function num(value: DecimalLike): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

function monthRange(monthKey: string): { start: Date; end: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
}

/** The single, currently-set monthly limit — null until someone sets one. */
export async function getFuelBudget(): Promise<number | null> {
  const budget = await prisma.fuelBudget.findFirst({ orderBy: { id: "desc" } });
  return budget ? num(budget.amount) : null;
}

export async function getVehicles(): Promise<VehicleDTO[]> {
  const rows = await prisma.vehicle.findMany({ orderBy: { id: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    registrationNumber: row.registrationNumber,
    insuranceRenewal: row.insuranceRenewal ? row.insuranceRenewal.toISOString().slice(0, 10) : null,
  }));
}

export async function getFuelEntries(monthKey: string): Promise<FuelEntryDTO[]> {
  const { start, end } = monthRange(monthKey);
  const rows = await prisma.fuelEntry.findMany({
    where: { refueledAt: { gte: start, lt: end } },
    orderBy: { refueledAt: "desc" },
    include: { vehicle: true },
  });

  return rows.map((row) => ({
    id: row.id,
    vehicleId: row.vehicleId,
    vehicleName: row.vehicle.name,
    vehicleType: row.vehicle.type,
    amount: num(row.amount),
    refueledAt: row.refueledAt.toISOString(),
    latitude: row.latitude !== null ? num(row.latitude) : null,
    longitude: row.longitude !== null ? num(row.longitude) : null,
    locationLabel: row.locationLabel,
  }));
}

export async function getFuelSummary(monthKey: string): Promise<FuelSummaryDTO> {
  const [entries, budget, vehicles] = await Promise.all([
    getFuelEntries(monthKey),
    getFuelBudget(),
    getVehicles(),
  ]);
  const spent = entries.reduce((sum, entry) => sum + entry.amount, 0);

  return {
    monthKey,
    spent,
    budget,
    remaining: budget !== null ? budget - spent : null,
    entries,
    vehicles,
  };
}

/** Every month that has at least one entry, most recent first — powers a simple history list. */
export async function getFuelMonths(): Promise<string[]> {
  const rows = await prisma.fuelEntry.findMany({
    select: { refueledAt: true },
    orderBy: { refueledAt: "desc" },
  });
  const months = new Set<string>();
  for (const row of rows) {
    const d = row.refueledAt;
    months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return [...months];
}
