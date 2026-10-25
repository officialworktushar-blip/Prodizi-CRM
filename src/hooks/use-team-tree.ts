"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { useRole } from "@/hooks/use-role";
import {
  buildTeamTree,
  canAssignTo as canAssignToMember,
  getAssignableMembers,
  getDirectReports,
  getFlatDownline,
  getManagerCandidates,
  getReportingChain,
  getScopedMembers,
  getUnplacedMembers,
} from "@/lib/team-hierarchy";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

export type UseTeamTreeResult = {
  members: Profile[];
  allMembers: Profile[];
  activeMembers: Profile[];
  assignableMembers: Profile[];
  flatDownline: Profile[];
  tree: ReturnType<typeof buildTeamTree>;
  unplacedMembers: Profile[];
  directReports: (userId: string) => Profile[];
  getReportingChain: (userId: string) => Profile[];
  canAssignTo: (userId: string) => boolean;
  getManagerCandidates: (
    targetRole: Profile["role"],
    editingId?: string | null,
  ) => Profile[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
};

export function useTeamTree(): UseTeamTreeResult {
  const { profile, role } = useRole();
  const query = useQuery({
    queryKey: ["profiles", "team-tree"],
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const allMembers = useMemo(() => query.data ?? [], [query.data]);

  const members = useMemo(
    () => getScopedMembers(allMembers, profile),
    [allMembers, profile],
  );

  const activeMembers = useMemo(
    () => members.filter((member) => member.is_active),
    [members],
  );

  const assignableMembers = useMemo(
    () => getAssignableMembers(allMembers, profile),
    [allMembers, profile],
  );

  const flatDownline = useMemo(
    () => (profile ? getFlatDownline(members, profile.id, true) : []),
    [members, profile],
  );

  const tree = useMemo(() => {
    if (!profile) return [];

    if (role === "owner") {
      const ids = new Set(members.map((member) => member.id));
      const placed = members.filter(
        (member) =>
          member.role === "owner" ||
          (member.manager_id && ids.has(member.manager_id)),
      );
      return buildTeamTree(placed, null);
    }

    return buildTeamTree(members, profile.id);
  }, [members, profile, role]);

  const unplacedMembers = useMemo(
    () => (role === "owner" ? getUnplacedMembers(members) : []),
    [members, role],
  );

  const directReports = useCallback(
    (userId: string) => getDirectReports(members, userId),
    [members],
  );

  const reportingChain = useCallback(
    (userId: string) => getReportingChain(members, userId),
    [members],
  );

  const canAssignTo = useCallback(
    (userId: string) => canAssignToMember(allMembers, profile, userId),
    [allMembers, profile],
  );

  const managerCandidates = useCallback(
    (targetRole: Profile["role"], editingId?: string | null) =>
      getManagerCandidates({
        profiles: members,
        actor: profile,
        targetRole,
        editingId,
      }),
    [members, profile],
  );

  return {
    members,
    allMembers,
    activeMembers,
    assignableMembers,
    flatDownline,
    tree,
    unplacedMembers,
    directReports,
    getReportingChain: reportingChain,
    canAssignTo,
    getManagerCandidates: managerCandidates,
    loading: query.isLoading,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}
