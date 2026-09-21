import { PrismaClient } from "../src/generated/prisma/client.js";
import { RelationType } from "../src/generated/prisma/enums.js";

/** One person extracted from the source chart. */
export type FamilyMemberRow = {
  /** Stable id of the source SmartArt shape — see the module doc comment below. */
  key: string;
  fullName: string;
  isPlaceholder: boolean;
};

/** One directed edge extracted from the source chart. */
export type FamilyRelationshipRow = {
  type: RelationType;
  fromKey: string;
  toKey: string;
  sortOrder: number;
};

export type FamilyTreeData = {
  root: string;
  members: FamilyMemberRow[];
  relationships: FamilyRelationshipRow[];
};

/**
 * `prisma/data/family-tree.json` was extracted from "Family_tree.xlsx",
 * which holds the tree as a PowerPoint/Excel SmartArt org chart (not a
 * spreadsheet table) — Excel stores each shape's text in
 * `xl/diagrams/data1.xml` and parent/child links in that file's `cxnLst`.
 * Every shape got a stable `modelId` (a GUID), preserved here as `key` /
 * `importKey`, which is what makes re-running this script safe: existing
 * rows are matched and updated by that id rather than by name, since
 * several people in this family share a first name.
 *
 * The chart only distinguishes one relationship shape type ("assistant",
 * used for the root couple's two wives) from a plain subordinate shape —
 * every other link is imported as PARENT_OF as authored, including
 * chains that likely represent a spouse rather than a child. Use the
 * family tree UI's relationship editor to correct any of those after
 * import; nothing here is guessed beyond what the chart states.
 */

/**
 * Idempotent import: safe to re-run if `family-tree.json` changes. Members
 * are matched by their stable `importKey`; relationships are matched by
 * their (from, to, type) triple.
 */
export async function importFamilyTree(prisma: PrismaClient, data: FamilyTreeData) {
  const idByKey = new Map<string, number>();
  let membersCreated = 0;
  let membersUpdated = 0;

  for (const member of data.members) {
    const existing = await prisma.familyMember.findUnique({
      where: { importKey: member.key },
      select: { id: true },
    });

    const record = await prisma.familyMember.upsert({
      where: { importKey: member.key },
      update: {
        fullName: member.fullName,
        isPlaceholder: member.isPlaceholder,
      },
      create: {
        importKey: member.key,
        fullName: member.fullName,
        isPlaceholder: member.isPlaceholder,
      },
    });
    idByKey.set(member.key, record.id);
    if (existing) membersUpdated++;
    else membersCreated++;
  }

  let relationshipsCreated = 0;
  let relationshipsUpdated = 0;

  for (const rel of data.relationships) {
    const fromMemberId = idByKey.get(rel.fromKey);
    const toMemberId = idByKey.get(rel.toKey);
    if (!fromMemberId || !toMemberId) continue;

    const existing = await prisma.familyRelationship.findUnique({
      where: { fromMemberId_toMemberId_type: { fromMemberId, toMemberId, type: rel.type } },
      select: { id: true },
    });

    await prisma.familyRelationship.upsert({
      where: { fromMemberId_toMemberId_type: { fromMemberId, toMemberId, type: rel.type } },
      update: { sortOrder: rel.sortOrder },
      create: { fromMemberId, toMemberId, type: rel.type, sortOrder: rel.sortOrder },
    });

    if (existing) relationshipsUpdated++;
    else relationshipsCreated++;
  }

  return {
    members: { created: membersCreated, updated: membersUpdated },
    relationships: { created: relationshipsCreated, updated: relationshipsUpdated },
  };
}
