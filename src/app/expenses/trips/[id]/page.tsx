import { notFound } from "next/navigation";

import { TripView } from "@/components/expenses/TripView";
import { getTripDetail } from "@/lib/expenses/queries";

export const dynamic = "force-dynamic";

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId)) notFound();

  const trip = await getTripDetail(tripId);
  if (!trip) notFound();

  return <TripView trip={trip} />;
}
