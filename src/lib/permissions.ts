import type { Role } from "@/lib/constants";

export function isAdminRole(role: Role | null | undefined) {
  return role === "owner" || role === "manager";
}

export function canManageMember(
  actorRole: Role | null | undefined,
  targetRole: Role | null | undefined,
) {
  if (actorRole === "owner") return true;
  if (actorRole === "manager") {
    return targetRole === "employee" || targetRole === "intern";
  }
  return false;
}

export function canEditSalaryConfig(role: Role | null | undefined) {
  return role === "owner";
}

export function canAssignWork(role: Role | null | undefined) {
  return isAdminRole(role);
}

export function canManageTargets(role: Role | null | undefined) {
  return role === "owner";
}

export function canSeeAllRecords(role: Role | null | undefined) {
  return isAdminRole(role);
}

export function canManageSale(role: Role | null | undefined) {
  return isAdminRole(role);
}

export function canEditLead(
  role: Role | null | undefined,
  userId: string | null | undefined,
  lead: { assigned_to: string | null; created_by: string | null },
) {
  if (isAdminRole(role)) return true;
  return Boolean(userId && (lead.assigned_to === userId || lead.created_by === userId));
}

export function canEditTask(
  role: Role | null | undefined,
  userId: string | null | undefined,
  task: { assigned_to: string | null; created_by: string | null },
) {
  if (isAdminRole(role)) return true;
  return Boolean(userId && (task.assigned_to === userId || task.created_by === userId));
}
