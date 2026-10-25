"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  LayoutGrid,
  List,
  Mail,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { MemberDialog } from "@/components/team/member-dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRole } from "@/hooks/use-role";
import {
  ROLES,
  ROLE_LABELS,
  type Role,
} from "@/lib/constants";
import { canManageMember, isAdminRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
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

export default function TeamPage() {
  const { profile, role, loading: roleLoading, error: roleError } = useRole();
  const isAdmin = isAdminRole(role);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Profile | null>(null);

  const profilesQuery = useQuery({
    queryKey: ["profiles", "team"],
    enabled: isAdmin,
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
      const { data, error } = await supabase
        .from("salary_config")
        .select("*");
      if (error) throw error;
      return (data ?? []) as SalaryConfig[];
    },
  });

  const targetQuery = useQuery({
    queryKey: ["targets", "team", monthStartISO()],
    enabled: role === "owner",
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("targets")
        .select("*")
        .eq("month", monthStartISO());
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

  const members = useMemo(
    () => profilesQuery.data ?? [],
    [profilesQuery.data],
  );
  const stats = useMemo(() => statsQuery.data ?? [], [statsQuery.data]);
  const statsMap = useMemo(
    () => new Map(stats.map((item) => [item.user_id, item])),
    [stats],
  );
  const salaryMap = useMemo(
    () => new Map((salaryQuery.data ?? []).map((item) => [item.user_id, item])),
    [salaryQuery.data],
  );
  const targetMap = useMemo(
    () =>
      new Map(
        (targetQuery.data ?? []).map((item) => [item.user_id, item.target_amount]),
      ),
    [targetQuery.data],
  );

  const filteredMembers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return members.filter((member) => {
      if (roleFilter !== "all" && member.role !== roleFilter) return false;
      if (!needle) return true;
      return [
        member.full_name,
        member.email,
        member.phone,
        member.designation,
        member.position,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle));
    });
  }, [members, roleFilter, search]);

  const averagePerformance =
    stats.length > 0
      ? stats.reduce((sum, item) => sum + toNumber(item.performance_pct), 0) /
        stats.length
      : 0;

  if (roleLoading) {
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

  if (roleError) {
    return <ErrorState message="We could not verify your profile." />;
  }

  if (!profile) {
    return (
      <EmptyState
        icon={UserRound}
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="People, roles, workload and performance."
        eyebrow="People"
        actions={
          <Button
            onClick={() => {
              setEditingMember(null);
              setDialogOpen(true);
            }}
          >
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
              (member) =>
                member.role === "owner" || member.role === "manager",
            ).length
          }
          hint="Leadership"
          icon={BriefcaseBusiness}
          accent="teal"
        />
        <StatCard
          title="Average performance"
          value={formatPercent(averagePerformance)}
          hint="Across all members"
          icon={ShieldCheck}
          accent="green"
        />
        <StatCard
          title="Open tasks"
          value={stats.reduce(
            (sum, item) => sum + toNumber(item.tasks_pending),
            0,
          )}
          hint="Pending across the team"
          icon={Mail}
          accent="orange"
        />
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email or designation..."
                className="pl-9"
              />
            </div>
            <Select
              value={roleFilter}
              onValueChange={(value) =>
                setRoleFilter(value as "all" | Role)
              }
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {ROLE_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex rounded-lg border p-0.5">
              <Button
                variant={view === "grid" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setView("grid")}
                aria-label="Grid view"
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button
                variant={view === "table" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setView("table")}
                aria-label="Table view"
              >
                <List className="size-4" />
              </Button>
            </div>
          </div>

          {profilesQuery.error ? (
            <ErrorState
              message="Team members could not be loaded."
              onRetry={() => void profilesQuery.refetch()}
            />
          ) : profilesQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredMembers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No matching members"
              description="Try a different role or search term."
            />
          ) : view === "grid" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredMembers.map((member) => {
                const memberStats = statsMap.get(member.id);
                return (
                  <Link
                    key={member.id}
                    href={`/team/${member.id}`}
                    className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
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
                        <p className="truncate font-medium">
                          {member.full_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {member.designation || member.position || "Team member"}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {ROLE_LABELS[member.role]}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Position</p>
                        <p className="truncate font-medium">
                          {member.position || "Not set"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Work</p>
                        <p className="truncate font-medium">
                          {member.dedicated_work || "Not set"}
                        </p>
                      </div>
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
                        value={toNumber(memberStats?.performance_pct)}
                        className="[&_[data-slot=progress-indicator]]:bg-brand-gradient"
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1020px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Position / Work</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Tasks</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => {
                    const memberStats = statsMap.get(member.id);
                    const canManage = canManageMember(role, member.role);
                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <Link
                            href={`/team/${member.id}`}
                            className="flex items-center gap-3"
                          >
                            <Avatar className="size-9">
                              {member.avatar_url ? (
                                <AvatarImage
                                  src={member.avatar_url}
                                  alt={member.full_name}
                                />
                              ) : null}
                              <AvatarFallback className="bg-brand-gradient text-xs font-semibold text-white">
                                {getInitials(member.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {member.full_name}
                                {member.id === profile.id ? (
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    (you)
                                  </span>
                                ) : null}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {member.designation ||
                                  member.position ||
                                  member.dedicated_work ||
                                  "Team member"}
                              </p>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {ROLE_LABELS[member.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">
                            {member.position || "—"}
                          </p>
                          <p className="max-w-[180px] truncate text-xs text-muted-foreground">
                            {member.dedicated_work || "No dedicated work"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs">
                            {member.email ? (
                              <p className="flex max-w-[190px] items-center gap-1.5 truncate">
                                <Mail className="size-3 shrink-0 text-muted-foreground" />
                                {member.email}
                              </p>
                            ) : null}
                            {member.phone ? (
                              <p className="flex items-center gap-1.5">
                                <Phone className="size-3 text-muted-foreground" />
                                {member.phone}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">
                            {memberStats?.tasks_completed ?? 0} done
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {memberStats?.tasks_pending ?? 0} pending
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="w-28">
                            <div className="mb-1 flex justify-between text-xs">
                              <span className="text-muted-foreground">
                                Score
                              </span>
                              <span className="font-medium">
                                {formatPercent(memberStats?.performance_pct)}
                              </span>
                            </div>
                            <Progress
                              value={toNumber(memberStats?.performance_pct)}
                              className="[&_[data-slot=progress-indicator]]:bg-brand-gradient"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              member.is_active
                                ? "border-brand-green/25 bg-brand-green/10 text-brand-green"
                                : "border-brand-red/25 bg-brand-red/10 text-brand-red"
                            }
                          >
                            {member.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Member actions"
                              >
                                <span className="text-lg leading-none">···</span>
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
                                disabled={
                                  !canManage ||
                                  member.id === profile.id
                                }
                                onClick={() => toggleMutation.mutate(member)}
                              >
                                {member.is_active
                                  ? "Deactivate access"
                                  : "Reactivate access"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
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
          editingMember ? salaryMap.get(editingMember.id) ?? null : null
        }
        monthlyTarget={
          editingMember ? targetMap.get(editingMember.id) ?? null : null
        }
        managers={members}
        actorRole={role ?? "employee"}
      />
    </div>
  );
}
