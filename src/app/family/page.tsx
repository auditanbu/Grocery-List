import { FamilyTreeView } from "@/components/family/FamilyTreeView";
import { getFamilyTree } from "@/lib/family/queries";

export const dynamic = "force-dynamic";

export default async function FamilyPage() {
  const tree = await getFamilyTree();
  return <FamilyTreeView tree={tree} />;
}
