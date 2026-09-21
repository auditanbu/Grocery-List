import "server-only";

import { prisma } from "../prisma";
import type {
  FamilyMemberDetailDTO,
  FamilyMemberDTO,
  FamilyNodeDTO,
  FamilyRelationshipDTO,
  FamilySpouseDTO,
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
  const spouseMap = new Map<number, { spouseId: number; marriageYear: number | null }[]>();

  for (const rel of relationships) {
    if (rel.type === "PARENT_OF") {
      if (!parentToChildren.has(rel.fromMemberId)) parentToChildren.set(rel.fromMemberId, []);
      parentToChildren.get(rel.fromMemberId)!.push({ childId: rel.toMemberId, sortOrder: rel.sortOrder });
      hasParent.add(rel.toMemberId);
    } else {
      if (!spouseMap.has(rel.fromMemberId)) spouseMap.set(rel.fromMemberId, []);
      if (!spouseMap.has(rel.toMemberId)) spouseMap.set(rel.toMemberId, []);
      spouseMap.get(rel.fromMemberId)!.push({ spouseId: rel.toMemberId, marriageYear: rel.marriageYear });
      spouseMap.get(rel.toMemberId)!.push({ spouseId: rel.fromMemberId, marriageYear: rel.marriageYear });
    }
  }

  const visited = new Set<number>();

  function buildNode(memberId: number): FamilyNodeDTO {
    visited.add(memberId);
    const spouseLinks = spouseMap.get(memberId) ?? [];
    const spouseIds = spouseLinks.map((link) => link.spouseId);
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

    const spouses: FamilySpouseDTO[] = spouseLinks.map((link) => ({
      ...memberById.get(link.spouseId)!,
      marriageYear: link.marriageYear,
    }));

    return {
      ...memberById.get(memberId)!,
      spouses,
      children: childIds.map((id) => buildNode(id)),
    };
  }

  // A root candidate is anyone with no recorded parent. Two more rules pick
  // which half of a couple anchors the card, since buildNode folds the other
  // half in underneath as "m. <name>" and marks them visited:
  //
  //  1. Bloodline wins. If a spouse has parents on file, that spouse anchors
  //     and the couple renders under their parent — otherwise the pair would
  //     be lifted out of the family they belong to, and the parent's card
  //     would lose the child (visited already claimed them).
  //  2. Otherwise the husband anchors, so the male name reads first.
  //
  // Anyone still unvisited after that (only reachable if hand-entered data
  // loops a parent back on itself) is added at the end rather than dropped.
  const spouseIdsOf = (id: number) => (spouseMap.get(id) ?? []).map((link) => link.spouseId);
  const candidateRootIds = members
    .map((m) => m.id)
    .filter((id) => {
      if (hasParent.has(id)) return false;
      const spouseIds = spouseIdsOf(id);
      if (spouseIds.some((spouseId) => hasParent.has(spouseId))) return false;
      if (memberById.get(id)!.gender === "MALE") return true;
      return !spouseIds.some((spouseId) => memberById.get(spouseId)!.gender === "MALE");
    });

  const roots: FamilyNodeDTO[] = [];
  for (const id of candidateRootIds) {
    if (visited.has(id)) continue;
    roots.push(buildNode(id));
  }
  for (const member of members) {
    if (visited.has(member.id)) continue;
    roots.push(buildNode(member.id));
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
      marriageYear: rel.type === "SPOUSE_OF" ? rel.marriageYear : null,
      otherMember: toMemberDTO(rel.toMember),
    })),
    ...member.relationshipsTo.map((rel): FamilyRelationshipDTO => ({
      id: rel.id,
      type: rel.type,
      direction: "TO",
      marriageYear: rel.type === "SPOUSE_OF" ? rel.marriageYear : null,
      otherMember: toMemberDTO(rel.fromMember),
    })),
  ];

  return { member: toMemberDTO(member), relationships };
}
