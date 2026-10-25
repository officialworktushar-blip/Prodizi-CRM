"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BriefcaseBusiness,
  GitBranch,
  LayoutGrid,
  List,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { RoleBadge } from "@/components/shared/role-badge";
import { StatCard } from "@/components/shared/stat-card";
import { MemberDialog } from "@/components/team/member-dialog";
import { OrgChart } from "@/components/team/org-chart";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/use-now";
import { useRole } from "@/hooks/use-role";
import { useTeamTree } from "@/hooks/use-team-tree";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/constants";
import { canManageMember, isAdminRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import type { TeamNode } from "@/lib/team-hierarchy";
import {
  formatPercent,
  getInitials,
  monthStartISO,
  toNumber,
} from "@/lib/utils";
import type {
  MemberStats,
  Profile,
  SalaryConfig,
  Target,
} from "@/types/database";

function filterNodes(
  nodes: TeamNode[],
  predicate: (member: Profile) => boolean,
): TeamNode[] {
  return nodes.flatMap((node) => {
    const children = filterNodes(node.children, predicate);
    if (!predicate(node) && children.length === 0) return [];
    return [{ ...node, children }];
  });
}

export default function TeamPage() {
  const { profile, role, loading: roleLoading, error: roleError } = useRole();
  const {
    members,
    tree,
    unplacedMembers,
    loading: treeLoading,
    error: treeError,
    refetch: refetchTree,
  } = useTeamTree();
  const isAdmin = isAdminRole(role);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [view, setView] = useState<"org" | "list">("org");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Profile | null>(null);
  const now = useNow();
  const month = now ? monthStartISO(now) : "";

  const statsQuery = useQuery({
    queryKey: ["member-stats", "team"],
    enabled: isAdmin,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("member_stats").select("*");
      if (error) throw error;
      return (data ?? []) as MemberStats[];
    },
  });

  const salaryQuery = useQuery({
    queryKey: ["salary", "configs"],
    enabled: role === "owner",
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("salary_config").select("*");
      if (error) throw error;
      return (data ?? []) as SalaryConfig[];
    },
  });

  const targetQuery = useQuery({
    queryKey: ["targets", "team", month],
    enabled: role === "owner" && Boolean(month),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("targets")
        .select("*")
        .eq("month", month);
      if (error) throw error;
      return (data ?? []) as Target[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (member: Profile) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !member.is_active })
        .eq("id", member.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member access updated");
      void queryClient.invalidateQueries({ queryKey: ["profiles"] });
      void queryClient.invalidateQueries({ queryKey: ["member-stats"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Update failed");
    },
  });

  const stats = useMemo(() => statsQuery.data ?? [], [statsQuery.data]);
  const statsMap = useMemo(
    () =>
      new Map(
        stats
          .filter((item) => item.user_id)
          .map((item) => [item.user_id as string, item]),
      ),
    [stats],
  );
  const salaryMap = useMemo(
    () => new Map((salaryQuery.data ?? []).map((item) => [item.user_id, item])),
    [salaryQuery.data],
  );
  const targetMap = useMemo(
    () =>
      new Map(
        (targetQuery.data ?? []).map((item) => [
          item.user_id,
          item.target_amount,
        ]),
      ),
    [targetQuery.data],
  );

  const scopedStats = useMemo(
    () =>
      stats.filter(
        (item) => item.user_id && members.some((m) => m.id === item.user_id),
      ),
    [members, stats],
  );

  const matchesFilters = useCallback(
    (member: Profile) => {
      if (roleFilter !== "all" && member.role !== roleFilter) return false;
      const needle = search.trim().toLowerCase();
      if (!needle) return true;
      return [
        member.full_name,
        member.email,
        member.phone,
        member.designation,
        member.position,
        member.dedicated_work,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle));
    },
    [roleFilter, search],
  );

  const filteredMembers = useMemo(
    () => members.filter(matchesFilters),
    [matchesFilters, members],
  );
  const filteredTree = useMemo(
    () => filterNodes(tree, matchesFilters),
    [matchesFilters, tree],
  );
  const filteredUnplaced = useMemo(
    () => unplacedMembers.filter(matchesFilters),
    [matchesFilters, unplacedMembers],
  );

  const averagePerformance =
    scopedStats.length > 0
      ? scopedStats.reduce(
          (sum, item) => sum + toNumber(item.performance_pct),
          0,
        ) / scopedStats.length
      : 0;

  if (roleLoading || treeLoading || !now) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (roleError || treeError) {
    return (
      <ErrorState
        message="We could not load your team."
        onRetry={refetchTree}
      />
    );
  }

  if (!profile) {
    return (
      <EmptyState
        icon={Users}
        title="Profile not found"
        description="Contact an owner to set up your profile."
      />
    );
  }

  if (!isAdmin) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Team access is restricted"
        description="Only owners and managers can manage team members."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    );
  }

  const openCreate = () => {
    setEditingMember(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Reporting hierarchy, workload and performance in one view."
        eyebrow="People"
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add member
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Team members"
          value={members.length}
          hint={`${members.filter((member) => member.is_active).length} active`}
          icon={Users}
          accent="blue"
        />
        <StatCard
          title="Managers & owners"
          value={
            members.filter(
              (member) => member.role === "owner" || member.role === "manager",
            ).length
          }
          hint="Leadership"
          icon={BriefcaseBusiness}
          accent="teal"
        />
        <StatCard
          title="Average performance"
          value={formatPercent(averagePerformance)}
          hint="Across your visible team"
          icon={ShieldCheck}
          accent="green"
        />
        <StatCard
          title="Open tasks"
          value={scopedStats.reduce(
            (sum, item) => sum + toNumber(item.tasks_pending),
            0,
          )}
          hint="Pending across the team"
          icon={Mail}
          accent="orange"
        />
      </div>

      {unplacedMembers.length > 0 ? (
        <Card className="border-brand-orange/30 bg-brand-orange/5">
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-brand-orange" />
                <div>
                  <p className="text-sm font-medium">
                    {unplacedMembers.length} member
                    {unplacedMembers.length === 1 ? "" : "s"} not placed in the
                    hierarchy
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Assign a reporting manager so they appear in the org chart.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {unplacedMembers.map((member) => (
                <Button
                  key={member.id}
                  variant="outline"
                  size="sm"
                  className="gap-2 bg-card"
                  onClick={() => {
                    setEditingMember(member);
                    setDialogOpen(true);
                  }}
                >
                  <Avatar className="size-5">
                    <AvatarFallback className="text-[0.55rem]">
                      {getInitials(member.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  {member.full_name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, designation or work..."
                className="pl-9"
              />
            </div>
            <Select
              value={roleFilter}
              onValueChange={(value) => setRoleFilter(value as "all" | Role)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLES.filter(
                  (item) => item !== "owner" || role === "owner",
                ).map((item) => (
                  <SelectItem key={item} value={item}>
                    {ROLE_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex rounded-lg border p-0.5">
              <Button
                variant={view === "org" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("org")}
                aria-label="Org chart view"
              >
                <GitBranch className="size-4" />
                Org chart
              </Button>
              <Button
                variant={view === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("list")}
                aria-label="List view"
              >
                {view === "list" ? (
                  <List className="size-4" />
                ) : (
                  <LayoutGrid className="size-4" />
                )}
                List
              </Button>
            </div>
          </div>

          {view === "org" ? (
            filteredTree.length === 0 ? (
              <EmptyState
                icon={GitBranch}
                title="No matching members"
                description="Try a different role or search term."
              />
            ) : (
              <OrgChart nodes={filteredTree} statsMap={statsMap} />
            )
          ) : filteredMembers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No matching members"
              description="Try a different role or search term."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredMembers.map((member) => {
                const memberStats = statsMap.get(member.id);
                const manager = members.find(
                  (item) => item.id === member.manager_id,
                );
                const canManage = canManageMember(role, member.role);
                return (
                  <div
                    key={member.id}
                    className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="size-11">
                        {member.avatar_url ? (
                          <AvatarImage
                            src={member.avatar_url}
                            alt={member.full_name}
                          />
                        ) : null}
                        <AvatarFallback className="bg-brand-gradient text-sm font-semibold text-white">
                          {getInitials(member.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/team/${member.id}`}
                          className="truncate font-medium hover:underline"
                        >
                          {member.full_name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {member.designation ||
                            member.position ||
                            "Team member"}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <RoleBadge role={member.role} />
                          {!member.is_active ? (
                            <Badge variant="outline">Inactive</Badge>
                          ) : null}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Member actions"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={!canManage}
                            onClick={() => {
                              setEditingMember(member);
                              setDialogOpen(true);
                            }}
                          >
                            Edit member
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!canManage || member.id === profile.id}
                            onClick={() => toggleMutation.mutate(member)}
                          >
                            {member.is_active
                              ? "Deactivate access"
                              : "Reactivate access"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <p className="text-xs text-muted-foreground">
                        Reports to{" "}
                        <span className="font-medium text-foreground">
                          {manager?.full_name ?? "Unplaced"}
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.dedicated_work || "No dedicated work set"}
                      </p>
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          {memberStats?.tasks_completed ?? 0} done ·{" "}
                          {memberStats?.tasks_pending ?? 0} pending
                        </span>
                        <span className="font-medium">
                          {formatPercent(memberStats?.performance_pct)}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(
                          toNumber(memberStats?.performance_pct),
                          100,
                        )}
                        className="[&_[data-slot=progress-indicator]]:bg-brand-gradient"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredUnplaced.length > 0 && view === "org" ? (
            <div className="space-y-2 rounded-xl border border-dashed border-brand-orange/40 bg-brand-orange/5 p-3">
              <p className="text-sm font-medium text-brand-orange">
                Unplaced members in this filter
              </p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {filteredUnplaced.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm hover:bg-muted/50"
                    onClick={() => {
                      setEditingMember(member);
                      setDialogOpen(true);
                    }}
                  >
                    <Avatar className="size-7">
                      <AvatarFallback className="text-[0.65rem]">
                        {getInitials(member.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate">
                      {member.full_name}
                    </span>
                    <RoleBadge role={member.role} />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <MemberDialog
        key={`${dialogOpen ? (editingMember?.id ?? "new") : "closed"}`}
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setEditingMember(null);
        }}
        member={editingMember}
        salaryConfig={
          editingMember ? (salaryMap.get(editingMember.id) ?? null) : null
        }
        monthlyTarget={
          editingMember ? (targetMap.get(editingMember.id) ?? null) : null
        }
        profiles={members}
        actorId={profile.id}
        actorRole={role ?? "employee"}
      />
    </div>
  );
}
