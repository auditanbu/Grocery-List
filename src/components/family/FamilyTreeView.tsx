"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { AdminLoginButton } from "@/components/AdminLoginButton";
import { Sheet } from "@/components/Sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAdmin } from "@/lib/admin-context";
import {
  addChild,
  addParent,
  addRootMember,
  addSpouse,
  deleteMember,
  deleteRelationship,
  fetchFamilyMemberDetail,
  setRelationshipType,
  updateMember,
} from "@/lib/family/actions";
import type {
  FamilyMemberDetailDTO,
  FamilyMemberDTO,
  FamilyNodeDTO,
  FamilyTreeDTO,
  Gender,
  RelationType,
} from "@/lib/family/types";

type FamilyTreeViewProps = {
  tree: FamilyTreeDTO;
};

const GENDER_LABEL: Record<Gender, string> = {
  MALE: "Male",
  FEMALE: "Female",
  UNKNOWN: "Not set",
};

function displayName(member: FamilyMemberDTO): string {
  return member.isPlaceholder || !member.fullName.trim() ? "Unnamed" : member.fullName;
}

function initial(member: FamilyMemberDTO): string {
  const name = member.fullName.trim();
  return name ? name[0].toUpperCase() : "?";
}

function matchesQuery(node: FamilyNodeDTO, needle: string): boolean {
  if (node.fullName.toLowerCase().includes(needle)) return true;
  if (node.spouses.some((s) => s.fullName.toLowerCase().includes(needle))) return true;
  return node.children.some((child) => matchesQuery(child, needle));
}

function collectIds(node: FamilyNodeDTO, out: Set<number>) {
  out.add(node.id);
  for (const child of node.children) collectIds(child, out);
}

export function FamilyTreeView({ tree }: FamilyTreeViewProps) {
  const router = useRouter();
  const { isAdmin } = useAdmin();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const initialSet = new Set<number>();
    for (const root of tree.roots) {
      initialSet.add(root.id);
      for (const child of root.children) initialSet.add(child.id);
    }
    return initialSet;
  });
  const [manageId, setManageId] = useState<number | null>(null);
  const [addRootOpen, setAddRootOpen] = useState(false);

  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;
  const visibleRoots = useMemo(
    () => (searching ? tree.roots.filter((root) => matchesQuery(root, needle)) : tree.roots),
    [tree.roots, needle, searching],
  );

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<number>();
    for (const root of tree.roots) collectIds(root, all);
    setExpanded(all);
  };
  const collapseAll = () => setExpanded(new Set());

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 pt-2">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-wide text-ios-label-2">
            {tree.memberCount} {tree.memberCount === 1 ? "person" : "people"}
          </p>
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">Family Tree</h1>
        </div>
        <div className="flex flex-none items-center gap-2">
          <AdminLoginButton />
          <ThemeToggle />
        </div>
      </header>

      <div className="flex items-center gap-2">
        <div className="flex h-11 flex-1 items-center rounded-ios bg-ios-surface-2 px-3.5 ring-1 ring-inset ring-ios-separator focus-within:ring-2 focus-within:ring-ios-blue">
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 flex-none text-ios-label-3" aria-hidden>
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M20 20l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a name…"
            className="h-full w-full bg-transparent px-2.5 text-[15px] outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setAddRootOpen(true)}
          className="flex h-11 flex-none items-center justify-center gap-1.5 rounded-ios bg-ios-blue px-3.5 text-[14px] font-semibold text-white active:scale-[0.98]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
          </svg>
          New branch
        </button>
      </div>

      {!searching ? (
        <div className="flex items-center gap-2 px-1 text-[13px] font-medium text-ios-blue">
          <button type="button" onClick={expandAll} className="active:opacity-60">
            Expand all
          </button>
          <span className="text-ios-label-3">·</span>
          <button type="button" onClick={collapseAll} className="active:opacity-60">
            Collapse all
          </button>
        </div>
      ) : null}

      {visibleRoots.length === 0 ? (
        <p className="ios-card p-6 text-center text-[15px] text-ios-label-2">
          {searching ? `No one matches "${query.trim()}".` : "No family members yet — add the first one."}
        </p>
      ) : (
        <ul className="space-y-1">
          {visibleRoots.map((root) => (
            <MemberNode
              key={root.id}
              node={root}
              depth={0}
              expanded={expanded}
              forceExpand={searching}
              onToggle={toggle}
              onManage={setManageId}
              needle={needle}
            />
          ))}
        </ul>
      )}

      <AddPersonSheet
        open={addRootOpen}
        title="Add family member"
        subtitle="Starts a new, unconnected branch — link it up later if needed."
        onClose={() => setAddRootOpen(false)}
        onSubmit={(input) => addRootMember(input)}
        onSaved={() => {
          setAddRootOpen(false);
          router.refresh();
        }}
      />

      <ManageMemberSheet memberId={manageId} onClose={() => setManageId(null)} onManage={setManageId} />
    </div>
  );
}

function MemberNode({
  node,
  depth,
  expanded,
  forceExpand,
  onToggle,
  onManage,
  needle,
}: {
  node: FamilyNodeDTO;
  depth: number;
  expanded: Set<number>;
  forceExpand: boolean;
  onToggle: (id: number) => void;
  onManage: (id: number) => void;
  needle: string;
}) {
  const isExpanded = forceExpand || expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const highlighted = needle.length > 0 && node.fullName.toLowerCase().includes(needle);

  return (
    <li>
      <div className="flex items-start gap-1.5 py-1">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-ios-label-2 transition active:bg-ios-surface-2"
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
              aria-hidden
            >
              <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <span className="w-7 flex-none" />
        )}

        <div className="min-w-0 flex-1">
          <PersonPill member={node} highlighted={highlighted} onClick={() => onManage(node.id)} />

          {node.spouses.length > 0 ? (
            <div className="flex flex-col">
              {node.spouses.map((spouse) => (
                <div key={spouse.id} className="flex items-center gap-1.5">
                  <span className="pl-1 text-[13px] text-ios-label-3">m.</span>
                  <PersonPill
                    member={spouse}
                    highlighted={needle.length > 0 && spouse.fullName.toLowerCase().includes(needle)}
                    onClick={() => onManage(spouse.id)}
                    muted
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {isExpanded && hasChildren ? (
        <ul className="ml-3.5 space-y-1 border-l border-ios-separator pl-4">
          {node.children.map((child) => (
            <MemberNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              forceExpand={forceExpand}
              onToggle={onToggle}
              onManage={onManage}
              needle={needle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function PersonPill({
  member,
  onClick,
  highlighted,
  muted,
}: {
  member: FamilyMemberDTO;
  onClick: () => void;
  highlighted?: boolean;
  muted?: boolean;
}) {
  const placeholder = member.isPlaceholder || !member.fullName.trim();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-left transition active:scale-[0.98] ${
        highlighted ? "bg-ios-blue-soft ring-1 ring-inset ring-ios-blue" : muted ? "" : "hover:bg-ios-surface-2"
      }`}
    >
      <span
        className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-semibold ${
          placeholder ? "border border-dashed border-ios-label-3 bg-ios-surface-2 text-ios-label-3" : "bg-ios-blue-soft text-ios-blue"
        }`}
      >
        {initial(member)}
      </span>
      <span
        className={`text-[15px] ${muted ? "font-normal text-ios-label-2" : "font-medium"} ${
          placeholder ? "italic text-ios-label-3" : "text-ios-label"
        }`}
      >
        {displayName(member)}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Manage sheet — view details, edit, add relatives, fix/unlink relationships
// ---------------------------------------------------------------------------

type ManageMode = "view" | "edit" | "addSpouse" | "addChild" | "addParent";

function ManageMemberSheet({
  memberId,
  onClose,
  onManage,
}: {
  memberId: number | null;
  onClose: () => void;
  onManage: (id: number) => void;
}) {
  const router = useRouter();
  const { isAdmin } = useAdmin();
  const [detail, setDetail] = useState<FamilyMemberDetailDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ManageMode>("view");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (memberId == null) {
      setDetail(null);
      return;
    }
    setMode("view");
    setLoading(true);
    fetchFamilyMemberDetail(memberId).then((d) => {
      setDetail(d);
      setLoading(false);
    });
  }, [memberId]);

  const refresh = () => {
    if (memberId == null) return;
    fetchFamilyMemberDetail(memberId).then(setDetail);
    router.refresh();
  };

  const open = memberId != null;
  const title = detail ? displayName(detail.member) : "Loading…";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        mode === "addSpouse"
          ? "Add spouse"
          : mode === "addChild"
            ? "Add child"
            : mode === "addParent"
              ? "Add parent"
              : mode === "edit"
                ? "Edit details"
                : title
      }
    >
      {loading || !detail || memberId == null ? (
        <p className="py-8 text-center text-[14px] text-ios-label-2">Loading…</p>
      ) : mode === "view" ? (
        <MemberOverview
          detail={detail}
          isAdmin={isAdmin}
          pending={pending}
          onEdit={() => setMode("edit")}
          onAddSpouse={() => setMode("addSpouse")}
          onAddChild={() => setMode("addChild")}
          onAddParent={() => setMode("addParent")}
          onOpenOther={(id) => onManage(id)}
          onDeleteMember={() => {
            if (!window.confirm(`Remove ${displayName(detail.member)}? Their children stay in the tree.`)) return;
            startTransition(async () => {
              await deleteMember(detail.member.id);
              onClose();
              router.refresh();
            });
          }}
          onUnlink={(relId) => {
            startTransition(async () => {
              await deleteRelationship(relId);
              refresh();
            });
          }}
          onFixType={(relId, type) => {
            startTransition(async () => {
              await setRelationshipType(relId, type);
              refresh();
            });
          }}
        />
      ) : mode === "edit" ? (
        <EditMemberForm
          member={detail.member}
          onCancel={() => setMode("view")}
          onSaved={() => {
            setMode("view");
            refresh();
          }}
        />
      ) : (
        <RelativeForm
          mode={mode}
          detail={detail}
          onCancel={() => setMode("view")}
          onSaved={() => {
            setMode("view");
            refresh();
          }}
        />
      )}
    </Sheet>
  );
}

function MemberOverview({
  detail,
  isAdmin,
  pending,
  onEdit,
  onAddSpouse,
  onAddChild,
  onAddParent,
  onOpenOther,
  onDeleteMember,
  onUnlink,
  onFixType,
}: {
  detail: FamilyMemberDetailDTO;
  isAdmin: boolean;
  pending: boolean;
  onEdit: () => void;
  onAddSpouse: () => void;
  onAddChild: () => void;
  onAddParent: () => void;
  onOpenOther: (id: number) => void;
  onDeleteMember: () => void;
  onUnlink: (relationshipId: number) => void;
  onFixType: (relationshipId: number, type: RelationType) => void;
}) {
  const { member, relationships } = detail;
  const parents = relationships.filter((r) => r.type === "PARENT_OF" && r.direction === "TO");
  const children = relationships.filter((r) => r.type === "PARENT_OF" && r.direction === "FROM");
  const spouses = relationships.filter((r) => r.type === "SPOUSE_OF");

  return (
    <div className="space-y-5 pb-3">
      {member.isPlaceholder ? (
        <p className="rounded-ios bg-ios-blue-soft px-3.5 py-2.5 text-[13px] text-ios-blue">
          This person doesn&apos;t have a name yet — the original chart left this box blank.
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[14px]">
        <dt className="text-ios-label-2">Gender</dt>
        <dd className="text-right">{GENDER_LABEL[member.gender]}</dd>
        <dt className="text-ios-label-2">Birth year</dt>
        <dd className="text-right">{member.birthYear ?? "—"}</dd>
        {member.notes ? (
          <>
            <dt className="col-span-2 text-ios-label-2">Notes</dt>
            <dd className="col-span-2 whitespace-pre-wrap text-ios-label">{member.notes}</dd>
          </>
        ) : null}
      </dl>

      <button
        type="button"
        onClick={onEdit}
        className="h-10 w-full rounded-ios bg-ios-surface-2 text-[14px] font-medium text-ios-blue ring-1 ring-inset ring-ios-separator active:scale-[0.98]"
      >
        Edit details
      </button>

      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={onAddParent} className="flex h-16 flex-col items-center justify-center gap-1 rounded-ios bg-ios-surface-2 text-[12px] font-medium text-ios-label-2 ring-1 ring-inset ring-ios-separator active:scale-[0.98]">
          <PlusIcon /> Parent
        </button>
        <button type="button" onClick={onAddSpouse} className="flex h-16 flex-col items-center justify-center gap-1 rounded-ios bg-ios-surface-2 text-[12px] font-medium text-ios-label-2 ring-1 ring-inset ring-ios-separator active:scale-[0.98]">
          <PlusIcon /> Spouse
        </button>
        <button type="button" onClick={onAddChild} className="flex h-16 flex-col items-center justify-center gap-1 rounded-ios bg-ios-surface-2 text-[12px] font-medium text-ios-label-2 ring-1 ring-inset ring-ios-separator active:scale-[0.98]">
          <PlusIcon /> Child
        </button>
      </div>

      <RelationList label="Parents" entries={parents} isAdmin={isAdmin} onOpenOther={onOpenOther} onUnlink={onUnlink} onFixType={onFixType} />
      <RelationList label="Spouse" entries={spouses} isAdmin={isAdmin} onOpenOther={onOpenOther} onUnlink={onUnlink} onFixType={onFixType} />
      <RelationList label="Children" entries={children} isAdmin={isAdmin} onOpenOther={onOpenOther} onUnlink={onUnlink} onFixType={onFixType} />

      {isAdmin ? (
        <button
          type="button"
          disabled={pending}
          onClick={onDeleteMember}
          className="h-10 w-full rounded-ios bg-ios-red-soft text-[14px] font-medium text-ios-red active:scale-[0.98] disabled:opacity-50"
        >
          Remove {displayName(member)}
        </button>
      ) : null}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RelationList({
  label,
  entries,
  isAdmin,
  onOpenOther,
  onUnlink,
  onFixType,
}: {
  label: string;
  entries: { id: number; type: RelationType; direction: "FROM" | "TO"; otherMember: FamilyMemberDTO }[];
  isAdmin: boolean;
  onOpenOther: (id: number) => void;
  onUnlink: (relationshipId: number) => void;
  onFixType: (relationshipId: number, type: RelationType) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div>
      <p className="pb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ios-label-3">{label}</p>
      <ul className="divide-y divide-ios-separator overflow-hidden rounded-ios ring-1 ring-inset ring-ios-separator">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-2 px-3 py-2">
            <button
              type="button"
              onClick={() => onOpenOther(entry.otherMember.id)}
              className="min-w-0 flex-1 truncate text-left text-[14px] font-medium active:opacity-60"
            >
              {displayName(entry.otherMember)}
            </button>
            {isAdmin ? (
              <>
                <select
                  value={entry.type}
                  onChange={(event) => onFixType(entry.id, event.target.value as RelationType)}
                  className="h-8 flex-none rounded-full bg-ios-surface-2 px-2 text-[12px] ring-1 ring-inset ring-ios-separator"
                >
                  <option value="PARENT_OF">Parent/child</option>
                  <option value="SPOUSE_OF">Spouse</option>
                </select>
                <button
                  type="button"
                  onClick={() => onUnlink(entry.id)}
                  aria-label="Unlink"
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-ios-red active:bg-ios-red-soft"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

type MemberFormInput = {
  fullName: string;
  gender: Gender;
  birthYear: number | null;
  notes: string | null;
};

function PersonFields({
  value,
  onChange,
}: {
  value: MemberFormInput;
  onChange: (next: MemberFormInput) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-[13px] font-medium text-ios-label-2">Name</span>
        <input
          autoFocus
          type="text"
          value={value.fullName}
          onChange={(event) => onChange({ ...value, fullName: event.target.value })}
          placeholder="Full name"
          className="mt-1.5 h-11 w-full rounded-ios bg-ios-surface-2 px-3.5 text-[16px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
        />
      </label>

      <div>
        <p className="pb-1.5 text-[13px] font-medium text-ios-label-2">Gender</p>
        <div className="flex gap-2">
          {(["MALE", "FEMALE", "UNKNOWN"] as Gender[]).map((gender) => (
            <button
              key={gender}
              type="button"
              onClick={() => onChange({ ...value, gender })}
              className={`h-9 flex-1 rounded-full text-[13px] font-medium transition active:scale-[0.98] ${
                value.gender === gender
                  ? "bg-ios-blue text-white"
                  : "bg-ios-surface-2 text-ios-label-2 ring-1 ring-inset ring-ios-separator"
              }`}
            >
              {GENDER_LABEL[gender]}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-[13px] font-medium text-ios-label-2">Birth year (optional)</span>
        <input
          type="text"
          inputMode="numeric"
          value={value.birthYear ?? ""}
          onChange={(event) => {
            const digits = event.target.value.replace(/[^0-9]/g, "");
            onChange({ ...value, birthYear: digits ? Number(digits) : null });
          }}
          placeholder="e.g. 1958"
          className="mt-1.5 h-11 w-full rounded-ios bg-ios-surface-2 px-3.5 text-[16px] tabular-nums outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
        />
      </label>

      <label className="block">
        <span className="text-[13px] font-medium text-ios-label-2">Notes (optional)</span>
        <textarea
          value={value.notes ?? ""}
          onChange={(event) => onChange({ ...value, notes: event.target.value || null })}
          rows={3}
          className="mt-1.5 w-full rounded-ios bg-ios-surface-2 px-3.5 py-2.5 text-[15px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
        />
      </label>
    </div>
  );
}

function EditMemberForm({
  member,
  onCancel,
  onSaved,
}: {
  member: FamilyMemberDTO;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState<MemberFormInput>({
    fullName: member.isPlaceholder ? "" : member.fullName,
    gender: member.gender,
    birthYear: member.birthYear,
    notes: member.notes,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const result = await updateMember(member.id, value);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  };

  return (
    <div className="space-y-4 pb-3">
      <PersonFields value={value} onChange={setValue} />
      {error ? <p className="text-[14px] text-ios-red">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 flex-1 rounded-ios bg-ios-surface-2 text-[15px] font-medium text-ios-label-2 ring-1 ring-inset ring-ios-separator active:scale-[0.98]"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="h-11 flex-1 rounded-ios bg-ios-blue text-[15px] font-semibold text-white active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function RelativeForm({
  mode,
  detail,
  onCancel,
  onSaved,
}: {
  mode: Extract<ManageMode, "addSpouse" | "addChild" | "addParent">;
  detail: FamilyMemberDetailDTO;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState<MemberFormInput>({ fullName: "", gender: "UNKNOWN", birthYear: null, notes: null });
  const spouseOptions = detail.relationships.filter((r) => r.type === "SPOUSE_OF").map((r) => r.otherMember);
  const [coParentId, setCoParentId] = useState<number | null>(spouseOptions[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const result =
        mode === "addSpouse"
          ? await addSpouse(detail.member.id, value)
          : mode === "addParent"
            ? await addParent(detail.member.id, value)
            : await addChild(detail.member.id, coParentId, value);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  };

  return (
    <div className="space-y-4 pb-3">
      <p className="text-[13px] text-ios-label-2">
        {mode === "addSpouse"
          ? `Marries ${displayName(detail.member)}.`
          : mode === "addParent"
            ? `Becomes a parent of ${displayName(detail.member)}.`
            : `Becomes a child of ${displayName(detail.member)}.`}
      </p>

      {mode === "addChild" && spouseOptions.length > 0 ? (
        <label className="block">
          <span className="text-[13px] font-medium text-ios-label-2">Other parent (optional)</span>
          <select
            value={coParentId ?? ""}
            onChange={(event) => setCoParentId(event.target.value ? Number(event.target.value) : null)}
            className="mt-1.5 h-11 w-full rounded-ios bg-ios-surface-2 px-3.5 text-[15px] outline-none ring-1 ring-inset ring-ios-separator"
          >
            <option value="">Not specified</option>
            {spouseOptions.map((spouse) => (
              <option key={spouse.id} value={spouse.id}>
                {displayName(spouse)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <PersonFields value={value} onChange={setValue} />
      {error ? <p className="text-[14px] text-ios-red">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 flex-1 rounded-ios bg-ios-surface-2 text-[15px] font-medium text-ios-label-2 ring-1 ring-inset ring-ios-separator active:scale-[0.98]"
        >
          Back
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="h-11 flex-1 rounded-ios bg-ios-blue text-[15px] font-semibold text-white active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add"}
        </button>
      </div>
    </div>
  );
}

function AddPersonSheet({
  open,
  title,
  subtitle,
  onClose,
  onSubmit,
  onSaved,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit: (input: MemberFormInput) => Promise<{ ok: true; data?: unknown } | { ok: false; error: string }>;
  onSaved: () => void;
}) {
  const [value, setValue] = useState<MemberFormInput>({ fullName: "", gender: "UNKNOWN", birthYear: null, notes: null });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setValue({ fullName: "", gender: "UNKNOWN", birthYear: null, notes: null });
      setError(null);
    }
  }, [open]);

  const save = () => {
    startTransition(async () => {
      const result = await onSubmit(value);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="flex h-12 w-full items-center justify-center rounded-ios bg-ios-blue text-[17px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add"}
        </button>
      }
    >
      <div className="space-y-4 pb-3">
        <PersonFields value={value} onChange={setValue} />
        {error ? <p className="text-[14px] text-ios-red">{error}</p> : null}
      </div>
    </Sheet>
  );
}
