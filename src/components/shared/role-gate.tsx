"use client";

import type { ReactNode } from "react";

import { useRole } from "@/hooks/use-role";
import type { Role } from "@/lib/constants";

type RoleGateProps = {
  allow: readonly Role[];
  children: ReactNode;
  fallback?: ReactNode;
};

export function RoleGate({ allow, children, fallback = null }: RoleGateProps) {
  const { role, loading } = useRole();

  if (loading) return null;

  return <>{role && allow.includes(role) ? children : fallback}</>;
}
