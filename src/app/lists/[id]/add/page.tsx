import { notFound, redirect } from "next/navigation";

import { AddItemsPage } from "@/components/list/AddItemsPage";
import { getList, getMasterItems, getShops } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AddItemsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listId = Number(id);
  if (!Number.isInteger(listId)) notFound();

  const list = await getList(listId);
  if (!list) notFound();
  if (list.status !== "DRAFT") redirect(`/lists/${listId}`);

  const [items, shops] = await Promise.all([getMasterItems(), getShops()]);

  return <AddItemsPage list={list} items={items} shops={shops} />;
}
