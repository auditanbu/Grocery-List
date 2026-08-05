import type { VehicleType } from "@/generated/prisma/enums";

export type { VehicleType };

export type FuelEntryDTO = {
  id: number;
  vehicleType: VehicleType;
  amount: number;
  refueledAt: string;
  latitude: number | null;
  longitude: number | null;
};

export type FuelSummaryDTO = {
  monthKey: string;
  spent: number;
  budget: number | null;
  remaining: number | null;
  entries: FuelEntryDTO[];
};
