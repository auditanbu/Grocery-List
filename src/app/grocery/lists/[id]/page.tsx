import { notFound } from "next/navigation";

import { ListScreen } from "@/components/list/ListScreen";
import { getList } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listId = Number(id);
  if (!Number.isInteger(listId)) notFound();

  const list = await getList(listId);
  if (!list) notFound();

  return <ListScreen list={list} />;
}
