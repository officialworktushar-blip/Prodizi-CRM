import type { Role } from "@/lib/constants";
import type { Profile } from "@/types/database";

export type TeamNode = Profile & {
  children: TeamNode[];
  depth: number;
};

const ROLE_RANK: Record<Role, number> = {
  owner: 0,
  manager: 1,
  employee: 2,
  intern: 3,
};

export function getAssigneeIds(profiles: Profile[], userId: string) {
  const candidates = new Map(profiles.map((member) => [member.id, member]));
  const visited = new Set<string>();
  const queue = [userId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    for (const member of profiles) {
      if (member.manager_id === current && !visited.has(member.id)) {
        queue.push(member.id);
      }
    }
  }

  return Array.from(visited).filter((id) => candidates.has(id));
}

export function buildTeamTree(
  profiles: Profile[],
  rootId?: string | null,
): TeamNode[] {
  const byManager = new Map<string, Profile[]>();
  const ids = new Set(profiles.map((member) => member.id));

  for (const member of profiles) {
    const managerId = member.manager_id;
    if (!managerId || !ids.has(managerId) || managerId === member.id) continue;
    const list = byManager.get(managerId) ?? [];
    list.push(member);
    byManager.set(managerId, list);
  }

  for (const list of byManager.values()) {
    list.sort((a, b) => {
      const roleDiff = ROLE_RANK[a.role] - ROLE_RANK[b.role];
      return roleDiff !== 0 ? roleDiff : a.full_name.localeCompare(b.full_name);
    });
  }

  const build = (
    member: Profile,
    depth: number,
    seen: Set<string>,
  ): TeamNode => {
    const nextSeen = new Set(seen).add(member.id);
    const children = (byManager.get(member.id) ?? [])
      .filter((child) => !nextSeen.has(child.id))
      .map((child) => build(child, depth + 1, nextSeen));

    return { ...member, depth, children };
  };

  if (rootId) {
    const root = profiles.find((member) => member.id === rootId);
    return root ? [build(root, 0, new Set())] : [];
  }

  const roots = profiles.filter(
    (member) => !member.manager_id || !ids.has(member.manager_id),
  );
  return roots
    .sort((a, b) => {
      const roleDiff = ROLE_RANK[a.role] - ROLE_RANK[b.role];
      return roleDiff !== 0 ? roleDiff : a.full_name.localeCompare(b.full_name);
    })
    .map((member) => build(member, 0, new Set()));
}

export function getDirectReports(profiles: Profile[], userId: string) {
  return profiles
    .filter((member) => member.manager_id === userId && member.id !== userId)
    .sort((a, b) => {
      const roleDiff = ROLE_RANK[a.role] - ROLE_RANK[b.role];
      return roleDiff !== 0 ? roleDiff : a.full_name.localeCompare(b.full_name);
    });
}

export function getFlatDownline(
  profiles: Profile[],
  userId: string,
  includeSelf = true,
) {
  const ids = new Set(getAssigneeIds(profiles, userId));
  return profiles
    .filter(
      (member) => ids.has(member.id) && (includeSelf || member.id !== userId),
    )
    .sort((a, b) => {
      const roleDiff = ROLE_RANK[a.role] - ROLE_RANK[b.role];
      return roleDiff !== 0 ? roleDiff : a.full_name.localeCompare(b.full_name);
    });
}

export function getReportingChain(profiles: Profile[], userId: string) {
  const profileMap = new Map(profiles.map((member) => [member.id, member]));
  const chain: Profile[] = [];
  const visited = new Set<string>([userId]);
  let current = profileMap.get(userId)?.manager_id ?? null;

  while (current && !visited.has(current)) {
    visited.add(current);
    const manager = profileMap.get(current);
    if (!manager) break;
    chain.push(manager);
    current = manager.manager_id;
  }

  return chain;
}

export function isInDownline(
  profiles: Profile[],
  actorId: string,
  targetId: string,
) {
  return (
    actorId === targetId || getAssigneeIds(profiles, actorId).includes(targetId)
  );
}

export function getScopedMembers(
  profiles: Profile[],
  actor: Pick<Profile, "id" | "role"> | null | undefined,
) {
  if (!actor) return [];
  if (actor.role === "owner") return profiles;
  return getFlatDownline(profiles, actor.id, true);
}

export function getAssignableMembers(
  profiles: Profile[],
  actor: Pick<Profile, "id" | "role"> | null | undefined,
) {
  return getScopedMembers(profiles, actor).filter((member) => member.is_active);
}

export function canAssignTo(
  profiles: Profile[],
  actor: Pick<Profile, "id" | "role"> | null | undefined,
  targetId: string,
) {
  if (!actor) return false;
  if (actor.role === "owner") {
    return profiles.some(
      (member) => member.id === targetId && member.is_active,
    );
  }
  return (
    actor.id === targetId ||
    (isInDownline(profiles, actor.id, targetId) &&
      Boolean(profiles.find((member) => member.id === targetId)?.is_active))
  );
}

export function getUnplacedMembers(profiles: Profile[]) {
  const ids = new Set(profiles.map((member) => member.id));
  return profiles.filter(
    (member) =>
      member.role !== "owner" &&
      (!member.manager_id || !ids.has(member.manager_id)),
  );
}

export function getValidManagerRoles(role: Role): Role[] {
  if (role === "manager") return ["owner"];
  if (role === "employee") return ["owner", "manager"];
  if (role === "intern") return ["owner", "manager", "employee"];
  return [];
}

export function getManagerCandidates({
  profiles,
  actor,
  targetRole,
  editingId,
}: {
  profiles: Profile[];
  actor: Pick<Profile, "id" | "role"> | null | undefined;
  targetRole: Role;
  editingId?: string | null;
}) {
  if (!actor || targetRole === "owner") return [];

  const validRoles = new Set(getValidManagerRoles(targetRole));
  const excluded = new Set<string>();

  if (editingId) {
    excluded.add(editingId);
    for (const id of getAssigneeIds(profiles, editingId)) {
      excluded.add(id);
    }
  }

  return profiles
    .filter((member) => {
      if (!member.is_active) return false;
      if (excluded.has(member.id)) return false;
      if (!validRoles.has(member.role)) return false;
      if (actor.role === "owner") return true;
      return (
        member.id === actor.id ||
        member.role === "owner" ||
        member.manager_id === actor.id
      );
    })
    .sort((a, b) => {
      const roleDiff = ROLE_RANK[a.role] - ROLE_RANK[b.role];
      return roleDiff !== 0 ? roleDiff : a.full_name.localeCompare(b.full_name);
    });
}

export function isRoleAllowedForActor(actorRole: Role, targetRole: Role) {
  if (actorRole === "owner") return targetRole !== "owner";
  if (actorRole === "manager") {
    return targetRole === "employee" || targetRole === "intern";
  }
  return false;
}
