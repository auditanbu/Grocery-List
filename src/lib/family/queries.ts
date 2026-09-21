import "server-only";

import { prisma } from "../prisma";
import type {
  FamilyMemberDetailDTO,
  FamilyMemberDTO,
  FamilyNodeDTO,
  FamilyRelationshipDTO,
  FamilyTreeDTO,
} from "./types";

function toMemberDTO(row: {
  id: number;
  fullName: string;
  gender: FamilyMemberDTO["gender"];
  birthYear: number | null;
  notes: string | null;
  isPlaceholder: boolean;
}): FamilyMemberDTO {
  return {
    id: row.id,
    fullName: row.fullName,
    gender: row.gender,
    birthYear: row.birthYear,
    notes: row.notes,
    isPlaceholder: row.isPlaceholder,
  };
}

/**
 * The whole tree, as one node per person with their spouse(s) attached and
 * children nested below. A person normally has a single root ancestor, but
 * the shape supports several disconnected trees (e.g. a second family
 * branch added later with no link to the first).
 */
export async function getFamilyTree(): Promise<FamilyTreeDTO> {
  const [members, relationships] = await Promise.all([
    prisma.familyMember.findMany({ orderBy: { id: "asc" } }),
    prisma.familyRelationship.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const memberById = new Map(members.map((m) => [m.id, toMemberDTO(m)]));
  const parentToChildren = new Map<number, { childId: number; sortOrder: number }[]>();
  const hasParent = new Set<number>();
  const spouseMap = new Map<number, number[]>();

  for (const rel of relationships) {
    if (rel.type === "PARENT_OF") {
      if (!parentToChildren.has(rel.fromMemberId)) parentToChildren.set(rel.fromMemberId, []);
      parentToChildren.get(rel.fromMemberId)!.push({ childId: rel.toMemberId, sortOrder: rel.sortOrder });
      hasParent.add(rel.toMemberId);
    } else {
      if (!spouseMap.has(rel.fromMemberId)) spouseMap.set(rel.fromMemberId, []);
      if (!spouseMap.has(rel.toMemberId)) spouseMap.set(rel.toMemberId, []);
      spouseMap.get(rel.fromMemberId)!.push(rel.toMemberId);
      spouseMap.get(rel.toMemberId)!.push(rel.fromMemberId);
    }
  }

  const visited = new Set<number>();

  function buildNode(memberId: number): FamilyNodeDTO {
    visited.add(memberId);
    const spouseIds = spouseMap.get(memberId) ?? [];
    for (const spouseId of spouseIds) visited.add(spouseId);

    // Children of the couple: union of this member's and their spouse(s)'
    // own PARENT_OF children, so a child with two parents in the tree only
    // appears once, under the couple.
    const childSortOrder = new Map<number, number>();
    for (const parentId of [memberId, ...spouseIds]) {
      for (const { childId, sortOrder } of parentToChildren.get(parentId) ?? []) {
        if (!childSortOrder.has(childId)) childSortOrder.set(childId, sortOrder);
      }
    }
    const childIds = [...childSortOrder.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id)
      .filter((id) => !visited.has(id));

    return {
      ...memberById.get(memberId)!,
      spouses: spouseIds.map((id) => memberById.get(id)!),
      children: childIds.map((id) => buildNode(id)),
    };
  }

  // A root candidate is anyone with no recorded parent. Processed in order
  // (oldest-inserted first) so that when a couple both qualify — neither
  // has a parent on file — whichever was added first becomes the anchor
  // card and its spouse is folded in underneath, instead of each showing
  // up as its own tree. `visited` (populated as a side effect of
  // buildNode) is what actually prevents the second one from duplicating.
  const candidateRootIds = members.map((m) => m.id).filter((id) => !hasParent.has(id));
  const roots: FamilyNodeDTO[] = [];
  for (const id of candidateRootIds) {
    if (visited.has(id)) continue;
    roots.push(buildNode(id));
  }

  return { roots, memberCount: members.length };
}

/** A single member plus every relationship they're part of, for the edit/relationships sheet. */
export async function getFamilyMemberDetail(id: number): Promise<FamilyMemberDetailDTO | null> {
  const member = await prisma.familyMember.findUnique({
    where: { id },
    include: {
      relationshipsFrom: { include: { toMember: true }, orderBy: { sortOrder: "asc" } },
      relationshipsTo: { include: { fromMember: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!member) return null;

  const relationships: FamilyRelationshipDTO[] = [
    ...member.relationshipsFrom.map((rel): FamilyRelationshipDTO => ({
      id: rel.id,
      type: rel.type,
      direction: "FROM",
      otherMember: toMemberDTO(rel.toMember),
    })),
    ...member.relationshipsTo.map((rel): FamilyRelationshipDTO => ({
      id: rel.id,
      type: rel.type,
      direction: "TO",
      otherMember: toMemberDTO(rel.fromMember),
    })),
  ];

  return { member: toMemberDTO(member), relationships };
}
