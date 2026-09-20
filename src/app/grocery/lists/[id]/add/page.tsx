import { notFound, redirect } from "next/navigation";

import { AddItemsPage } from "@/components/list/AddItemsPage";
import { getCategories, getList, getMasterItems, getShops } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AddItemsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listId = Number(id);
  if (!Number.isInteger(listId)) notFound();

  const list = await getList(listId);
  if (!list) notFound();
  if (list.status !== "DRAFT") redirect(`/grocery/lists/${listId}`);

  const [items, shops, categories] = await Promise.all([
    getMasterItems(),
    getShops(),
    getCategories(),
  ]);

  return <AddItemsPage list={list} items={items} shops={shops} categories={categories} />;
}
