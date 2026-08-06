import type { VehicleType } from "@/generated/prisma/enums";

export type { VehicleType };

export type VehicleDTO = {
  id: number;
  name: string;
  type: VehicleType;
  registrationNumber: string | null;
  /** ISO date string (yyyy-mm-dd), or null if not set. */
  insuranceRenewal: string | null;
};

export type FuelEntryDTO = {
  id: number;
  vehicleId: number;
  vehicleName: string;
  vehicleType: VehicleType;
  amount: number;
  refueledAt: string;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
};

export type FuelSummaryDTO = {
  monthKey: string;
  spent: number;
  budget: number | null;
  remaining: number | null;
  entries: FuelEntryDTO[];
  vehicles: VehicleDTO[];
};
