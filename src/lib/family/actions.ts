"use server";

import { revalidatePath } from "next/cache";

import { isAdminSession } from "../admin";
import { prisma } from "../prisma";
import { getFamilyMemberDetail } from "./queries";
import type { FamilyMemberDetailDTO, Gender, RelationType } from "./types";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

type MemberInput = {
  fullName: string;
  gender?: Gender;
  birthYear?: number | null;
  notes?: string | null;
};

function validateMemberInput(input: MemberInput): string | null {
  if (!input.fullName.trim()) return "Enter a name.";
  if (input.birthYear != null && (!Number.isInteger(input.birthYear) || input.birthYear < 1800 || input.birthYear > new Date().getFullYear())) {
    return "Enter a valid birth year.";
  }
  return null;
}

function memberData(input: MemberInput) {
  return {
    fullName: input.fullName.trim(),
    gender: input.gender ?? "UNKNOWN",
    birthYear: input.birthYear ?? null,
    notes: input.notes?.trim() || null,
    isPlaceholder: false,
  };
}

/** Next sortOrder among a parent's existing children, so a new child lands at the end. */
async function nextChildSortOrder(parentId: number): Promise<number> {
  const max = await prisma.familyRelationship.aggregate({
    where: { fromMemberId: parentId, type: "PARENT_OF" },
    _max: { sortOrder: true },
  });
  return (max._max.sortOrder ?? -1) + 1;
}

/** Client components can't import server-only queries directly — this exposes the read as an action. */
export async function fetchFamilyMemberDetail(id: number): Promise<FamilyMemberDetailDTO | null> {
  return getFamilyMemberDetail(id);
}

/** A new, unconnected person — the start of a new branch in the tree. */
export async function addRootMember(input: MemberInput): Promise<ActionResult<{ id: number }>> {
  const error = validateMemberInput(input);
  if (error) return fail(error);

  const member = await prisma.familyMember.create({ data: memberData(input) });
  revalidatePath("/family");
  return { ok: true, data: { id: member.id } };
}

/**
 * Adds a child of `parentId`. If `coParentId` is given (one of parentId's
 * existing spouses), the child is linked to both, so it renders once under
 * the couple instead of twice.
 */
export async function addChild(
  parentId: number,
  coParentId: number | null,
  input: MemberInput,
): Promise<ActionResult<{ id: number }>> {
  const error = validateMemberInput(input);
  if (error) return fail(error);

  const parent = await prisma.familyMember.findUnique({ where: { id: parentId }, select: { id: true } });
  if (!parent) return fail("Parent not found.");

  const sortOrder = await nextChildSortOrder(parentId);

  const child = await prisma.familyMember.create({ data: memberData(input) });
  await prisma.familyRelationship.create({
    data: { type: "PARENT_OF", fromMemberId: parentId, toMemberId: child.id, sortOrder },
  });
  if (coParentId) {
    const coParent = await prisma.familyMember.findUnique({ where: { id: coParentId }, select: { id: true } });
    if (coParent) {
      await prisma.familyRelationship.create({
        data: { type: "PARENT_OF", fromMemberId: coParentId, toMemberId: child.id, sortOrder },
      });
    }
  }

  revalidatePath("/family");
  return { ok: true, data: { id: child.id } };
}

/** Adds a spouse of `memberId`. */
export async function addSpouse(memberId: number, input: MemberInput): Promise<ActionResult<{ id: number }>> {
  const error = validateMemberInput(input);
  if (error) return fail(error);

  const member = await prisma.familyMember.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!member) return fail("Member not found.");

  const spouse = await prisma.familyMember.create({ data: memberData(input) });
  await prisma.familyRelationship.create({
    data: { type: "SPOUSE_OF", fromMemberId: memberId, toMemberId: spouse.id, sortOrder: 0 },
  });

  revalidatePath("/family");
  return { ok: true, data: { id: spouse.id } };
}

/** Adds a parent of `childId` — extends the tree upward. */
export async function addParent(childId: number, input: MemberInput): Promise<ActionResult<{ id: number }>> {
  const error = validateMemberInput(input);
  if (error) return fail(error);

  const child = await prisma.familyMember.findUnique({ where: { id: childId }, select: { id: true } });
  if (!child) return fail("Member not found.");

  const parent = await prisma.familyMember.create({ data: memberData(input) });
  await prisma.familyRelationship.create({
    data: { type: "PARENT_OF", fromMemberId: parent.id, toMemberId: childId, sortOrder: 0 },
  });

  revalidatePath("/family");
  return { ok: true, data: { id: parent.id } };
}

export async function updateMember(id: number, input: MemberInput): Promise<ActionResult> {
  const error = validateMemberInput(input);
  if (error) return fail(error);

  await prisma.familyMember.update({ where: { id }, data: memberData(input) });
  revalidatePath("/family");
  return { ok: true };
}

/** Admin only — removes the person and every relationship attached to them; their children stay in the tree as a new branch. */
export async function deleteMember(id: number): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");
  await prisma.familyMember.delete({ where: { id } });
  revalidatePath("/family");
  return { ok: true };
}

/** Admin only — unlinks two people without deleting either of them. */
export async function deleteRelationship(id: number): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");
  await prisma.familyRelationship.delete({ where: { id } });
  revalidatePath("/family");
  return { ok: true };
}

/** Admin only — corrects a relationship the import guessed wrong (e.g. a spouse imported as a child). */
export async function setRelationshipType(id: number, type: RelationType): Promise<ActionResult> {
  if (!(await isAdminSession())) return fail("Admin only.");
  try {
    await prisma.familyRelationship.update({ where: { id }, data: { type } });
  } catch {
    return fail("That relationship already exists between these two people.");
  }
  revalidatePath("/family");
  return { ok: true };
}
