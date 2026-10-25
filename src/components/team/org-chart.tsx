"use client";

import {
  ChevronDown,
  ChevronRight,
  ListChecks,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { RoleBadge } from "@/components/shared/role-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatPercent, getInitials, toNumber } from "@/lib/utils";
import type { TeamNode } from "@/lib/team-hierarchy";
import type { MemberStats } from "@/types/database";

const ROLE_ACCENTS: Record<TeamNode["role"], string> = {
  owner: "border-l-brand-orange",
  manager: "border-l-brand-blue",
  employee: "border-l-brand-teal",
  intern: "border-l-brand-green",
};

function OrgBranch({
  node,
  statsMap,
  collapsed,
  onToggle,
}: {
  node: TeamNode;
  statsMap: Map<string, MemberStats>;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
}) {
  const stats = statsMap.get(node.id);
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);

  return (
    <div className="relative">
      <div
        className={`relative flex flex-col gap-3 rounded-xl border border-l-4 bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center ${ROLE_ACCENTS[node.role]}`}
      >
        <Avatar className="size-11 shrink-0">
          {node.avatar_url ? (
            <AvatarImage src={node.avatar_url} alt={node.full_name} />
          ) : null}
          <AvatarFallback className="bg-brand-gradient text-sm font-semibold text-white">
            {getInitials(node.full_name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/team/${node.id}`}
              className="truncate font-semibold hover:underline"
            >
              {node.full_name}
            </Link>
            <RoleBadge role={node.role} />
            {node.role !== "owner" && !node.manager_id ? (
              <Badge
                variant="outline"
                className="border-brand-orange/30 bg-brand-orange/10 text-brand-orange"
              >
                Unplaced
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[node.designation, node.position, node.dedicated_work]
              .filter(Boolean)
              .join(" · ") || "Team member"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <ListChecks className="size-3.5" />
              {stats?.tasks_completed ?? 0} done · {stats?.tasks_pending ?? 0}{" "}
              pending
            </span>
            {hasChildren ? (
              <span className="flex items-center gap-1">
                <UsersRound className="size-3.5" />
                {node.children.length} direct report
                {node.children.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:w-40">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex justify-between text-[0.68rem]">
              <span className="text-muted-foreground">Performance</span>
              <span className="font-medium">
                {formatPercent(stats?.performance_pct)}
              </span>
            </div>
            <Progress
              value={Math.min(toNumber(stats?.performance_pct), 100)}
              className="[&_[data-slot=progress-indicator]]:bg-brand-gradient"
            />
          </div>
          {hasChildren ? (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={
                isCollapsed
                  ? `Expand ${node.full_name}'s reports`
                  : `Collapse ${node.full_name}'s reports`
              }
              onClick={() => onToggle(node.id)}
            >
              {isCollapsed ? (
                <ChevronRight className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </Button>
          ) : null}
        </div>
      </div>

      {hasChildren && !isCollapsed ? (
        <div className="relative mt-3 ml-5 space-y-3 border-l pl-5 sm:ml-8 sm:pl-6">
          {node.children.map((child) => (
            <div
              key={child.id}
              className="relative before:absolute before:top-7 before:-left-5 before:h-px before:w-5 before:bg-border sm:before:-left-6 sm:before:w-6"
            >
              <OrgBranch
                node={child}
                statsMap={statsMap}
                collapsed={collapsed}
                onToggle={onToggle}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function OrgChart({
  nodes,
  statsMap,
}: {
  nodes: TeamNode[];
  statsMap: Map<string, MemberStats>;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (nodes.length === 0) return null;

  return (
    <div className="space-y-4 overflow-x-auto">
      {nodes.map((node) => (
        <OrgBranch
          key={node.id}
          node={node}
          statsMap={statsMap}
          collapsed={collapsed}
          onToggle={toggle}
        />
      ))}
    </div>
  );
}
