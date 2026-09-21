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

/** A spouse as seen from their partner's card — the person plus the year they married. */
export type FamilySpouseDTO = FamilyMemberDTO & {
  marriageYear: number | null;
};

/** A member with their spouse(s) and children resolved, for rendering the tree. */
export type FamilyNodeDTO = FamilyMemberDTO & {
  spouses: FamilySpouseDTO[];
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
  /** Year of marriage on a SPOUSE_OF edge; always null on a PARENT_OF one. */
  marriageYear: number | null;
  otherMember: FamilyMemberDTO;
};

export type FamilyMemberDetailDTO = {
  member: FamilyMemberDTO;
  relationships: FamilyRelationshipDTO[];
};
