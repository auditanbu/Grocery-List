import type { Gender, RelationType } from "@/generated/prisma/enums";

export type { Gender, RelationType };

export type FamilyMemberDTO = {
  id: number;
  fullName: string;
  gender: Gender;
  birthYear: number | null;
  notes: string | null;
  isPlaceholder: boolean;
};

/** A member with their spouse(s) and children resolved, for rendering the tree. */
export type FamilyNodeDTO = FamilyMemberDTO & {
  spouses: FamilyMemberDTO[];
  children: FamilyNodeDTO[];
};

export type FamilyTreeDTO = {
  roots: FamilyNodeDTO[];
  memberCount: number;
};

/** One of a member's relationships, from that member's point of view. */
export type FamilyRelationshipDTO = {
  id: number;
  type: RelationType;
  /** "FROM": this member is the parent/spouse in the edge. "TO": this member is the child/spouse. */
  direction: "FROM" | "TO";
  otherMember: FamilyMemberDTO;
};

export type FamilyMemberDetailDTO = {
  member: FamilyMemberDTO;
  relationships: FamilyRelationshipDTO[];
};
