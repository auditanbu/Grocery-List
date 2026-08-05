import { PetrolView } from "@/components/petrol/PetrolView";
import { monthKeyOf } from "@/lib/dates";
import { getFuelSummary } from "@/lib/petrol/queries";

export const dynamic = "force-dynamic";

export default async function PetrolPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const monthKey = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : monthKeyOf();
  const summary = await getFuelSummary(monthKey);

  return <PetrolView summary={summary} />;
}
