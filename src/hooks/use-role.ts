"use client";

import { useQuery } from "@tanstack/react-query";

import type { Role } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

async function fetchProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function useProfile() {
  const query = useQuery({
    queryKey: ["current-profile"],
    queryFn: fetchProfile,
    staleTime: 60_000,
    retry: false,
  });

  return {
    profile: query.data ?? null,
    email: query.data?.email ?? null,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export type UseRoleResult = {
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  error: Error | null;
  isOwner: boolean;
  isManager: boolean;
  isEmployee: boolean;
  isIntern: boolean;
  canManage: boolean;
  refetch: () => void;
};

export function useRole(): UseRoleResult {
  const { profile, loading, error, refetch } = useProfile();
  const role = (profile?.role as Role | undefined) ?? null;

  return {
    profile,
    role,
    loading,
    error,
    isOwner: role === "owner",
    isManager: role === "manager",
    isEmployee: role === "employee",
    isIntern: role === "intern",
    canManage: role === "owner" || role === "manager",
    refetch: () => void refetch(),
  };
}
