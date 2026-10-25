"use client";

import { useEffect, useState } from "react";

import type { Role } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

export type UseRoleResult = {
  role: Role | null;
  loading: boolean;
  isOwner: boolean;
  isManager: boolean;
  isEmployee: boolean;
  isIntern: boolean;
  canManage: boolean;
};

export function useRole(): UseRoleResult {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      if (
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (!cancelled && profile?.role) {
          setRole(profile.role as Role);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadRole();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    role,
    loading,
    isOwner: role === "owner",
    isManager: role === "manager",
    isEmployee: role === "employee",
    isIntern: role === "intern",
    canManage: role === "owner" || role === "manager",
  };
}
