"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  IndianRupee,
  Mail,
  Phone,
  ShieldCheck,
  Target,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { MemberDialog } from "@/components/team/member-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/use-now";
import { useRole } from "@/hooks/use-role";
import { ROLE_LABELS } from "@/lib/constants";
import { canManageMember, isAdminRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import {
  formatDate,
  formatINR,
  formatPercent,
  getInitials,
  monthStartISO,
  toNumber,
} from "@/lib/utils";
import type {
  Incentive,
  Lead,
  MemberStats,
  Profile,
  Sale,
  SalaryConfig,
  SalaryMonthly,
  Target as TargetRecord,
  Task,
} from "@/types/database";

export function MemberDetail({ memberId }: { memberId: string }) {
  const { role, loading: roleLoading } = useRole();
  const isAdmin = isAdminRole(role);
  const [dialogOpen, setDialogOpen] = useState(false);
  const now = useNow();
  const month = now ? monthStartISO(now) : "";

  const memberQuery = useQuery({
    queryKey: ["profiles", "detail", memberId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", memberId)
        .maybeSingle();
      if (error) throw error;
      return (data as Profile | null) ?? null;
    },
  });

  const relatedQuery = useQuery({
    queryKey: ["profiles", "related", memberId, month],
    enabled: Boolean(memberQuery.data) && Boolean(month),
    queryFn: async () => {
      const supabase = createClient();
      const [stats, tasks, leads, config, salary, sales, incentives, target, profiles] =
        await Promise.all([
          supabase
            .from("member_stats")
            .select("*")
            .eq("user_id", memberId)
            .maybeSingle(),
          supabase
            .from("tasks")
            .select("*")
            .eq("assigned_to", memberId)
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("leads")
            .select("*")
            .eq("assigned_to", memberId)
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("salary_config")
            .select("*")
            .eq("user_id", memberId)
            .maybeSingle(),
          supabase
            .from("salary_monthly")
            .select("*")
            .eq("user_id", memberId)
            .eq("month", month)
            .maybeSingle(),
          supabase
            .from("sales")
            .select("*")
            .eq("sold_by", memberId)
            .order("sale_date", { ascending: false })
            .limit(10),
          supabase
            .from("incentives")
            .select("*")
            .eq("user_id", memberId)
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("targets")
            .select("*")
            .eq("user_id", memberId)
            .eq("month", month)
            .maybeSingle(),
          supabase.from("profiles").select("*").order("full_name"),
        ]);
      const error =
        stats.error ??
        tasks.error ??
        leads.error ??
        config.error ??
        salary.error ??
        sales.error ??
        incentives.error ??
        profiles.error;
      if (error) throw error;

      return {
        stats: (stats.data as MemberStats | null) ?? null,
        tasks: (tasks.data ?? []) as Task[],
        leads: (leads.data ?? []) as Lead[],
        config: (config.data as SalaryConfig | null) ?? null,
        salary: (salary.data as SalaryMonthly | null) ?? null,
        sales: (sales.data ?? []) as Sale[],
        incentives: (incentives.data ?? []) as Incentive[],
        target: (target.data as TargetRecord | null) ?? null,
        profiles: (profiles.data ?? []) as Profile[],
      };
    },
  });

  if (roleLoading || memberQuery.isLoading || !now) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (memberQuery.error) {
    return (
      <ErrorState
        message="This member could not be loaded."
        onRetry={() => void memberQuery.refetch()}
      />
    );
  }

  if (!memberQuery.data) {
    return (
      <EmptyState
        icon={UserRound}
        title="Member not found"
        description="The profile may have been removed."
        action={
          <Button asChild variant="outline">
            <Link href="/team">Back to team</Link>
          </Button>
        }
      />
    );
  }

  const member = memberQuery.data;
  const canView = isAdmin && (role === "owner" || canManageMember(role, member.role));
  if (!canView) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Profile access is restricted"
        description="You do not have permission to view this member."
        action={
          <Button asChild variant="outline">
            <Link href="/team">Back to team</Link>
          </Button>
        }
      />
    );
  }

  const stats = relatedQuery.data?.stats ?? null;
  const tasks = relatedQuery.data?.tasks ?? [];
  const leads = relatedQuery.data?.leads ?? [];
  const config = relatedQuery.data?.config ?? null;
  const salary = relatedQuery.data?.salary ?? null;
  const sales = relatedQuery.data?.sales ?? [];
  const incentives = relatedQuery.data?.incentives ?? [];
  const target = relatedQuery.data?.target ?? null;
  const profiles = relatedQuery.data?.profiles ?? [];
  const manager = profiles.find((item) => item.id === member.manager_id);
  const showSalary = role === "owner" || role === "manager";
  const monthKeys = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(now);
    date.setMonth(date.getMonth() - (5 - index));
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("en-IN", { month: "short" }),
    };
  });
  const chartData = monthKeys.map((item) => ({
    ...item,
    completed: tasks.filter(
      (task) =>
        task.completed_at && task.completed_at.slice(0, 7) === item.key,
    ).length,
  }));
  const chartMax = Math.max(1, ...chartData.map((item) => item.completed));
  const totalSales = sales.reduce(
    (sum, sale) => sum + toNumber(sale.total_amount),
    0,
  );
  const totalIncentives = incentives.reduce(
    (sum, item) => sum + toNumber(item.amount),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={member.full_name}
        description={member.designation || member.position || "Team member"}
        eyebrow="Team"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/team">
                <ArrowLeft className="size-4" />
                Back
              </Link>
            </Button>
            {canManageMember(role, member.role) ? (
              <Button onClick={() => setDialogOpen(true)}>Edit member</Button>
            ) : null}
          </>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="size-16">
            {member.avatar_url ? (
              <AvatarImage src={member.avatar_url} alt={member.full_name} />
            ) : null}
            <AvatarFallback className="bg-brand-gradient text-xl font-semibold text-white">
              {getInitials(member.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{member.full_name}</h2>
              <Badge variant="secondary">{ROLE_LABELS[member.role]}</Badge>
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
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {member.email ? (
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5" />
                  {member.email}
                </span>
              ) : null}
              {member.phone ? (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5" />
                  {member.phone}
                </span>
              ) : null}
              {member.joined_on ? (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" />
                  Joined {formatDate(member.joined_on)}
                </span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Tasks completed"
          value={stats?.tasks_completed ?? 0}
          hint={`${stats?.tasks_pending ?? 0} pending`}
          icon={BriefcaseBusiness}
          accent="green"
        />
        <StatCard
          title="Performance"
          value={formatPercent(stats?.performance_pct)}
          hint="All-time completion score"
          icon={ShieldCheck}
          accent="blue"
        />
        <StatCard
          title="Assigned leads"
          value={leads.length}
          hint="Recent workload"
          icon={Target}
          accent="teal"
        />
        <StatCard
          title="Target progress"
          value={formatPercent(salary?.target_pct)}
          hint={salary?.target_stage ?? "No target"}
          icon={IndianRupee}
          accent="orange"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance trend</CardTitle>
          <CardDescription>
            Tasks completed over the last six months.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-36 items-end gap-3">
            {chartData.map((item) => (
              <div
                key={item.key}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <span className="text-xs font-medium">{item.completed}</span>
                <div
                  className="w-full max-w-14 rounded-t-lg bg-brand-gradient"
                  style={{
                    height: `${Math.max(6, (item.completed / chartMax) * 100)}%`,
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent tasks</CardTitle>
            <CardDescription>Latest work assigned to this member.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No tasks assigned yet.
              </p>
            ) : (
              tasks.slice(0, 8).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.due_date ? formatDate(task.due_date) : "No due date"}
                    </p>
                  </div>
                  <StatusBadge status={task.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent leads</CardTitle>
            <CardDescription>Pipeline owned by this member.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {leads.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No leads assigned yet.
              </p>
            ) : (
              leads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {lead.client_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {lead.company ?? lead.item_name ?? "Lead"}
                    </p>
                  </div>
                  <StatusBadge status={lead.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales</CardTitle>
            <CardDescription>
              {sales.length} recent sale{sales.length === 1 ? "" : "s"} ·{" "}
              {formatINR(totalSales)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sales.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No sales recorded for this member.
              </p>
            ) : (
              sales.slice(0, 6).map((sale) => (
                <Link
                  key={sale.id}
                  href={`/sales/${sale.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {sale.client_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(sale.sale_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatINR(sale.total_amount)}
                    </p>
                    <StatusBadge status={sale.payment_status} />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Incentives</CardTitle>
            <CardDescription>
              {formatINR(totalIncentives)} across recent entries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {incentives.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No incentives earned yet.
              </p>
            ) : (
              incentives.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {item.source} incentive
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(item.month)}
                    </p>
                  </div>
                  <span className="text-sm font-medium">
                    {formatINR(item.amount)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Work details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Designation</p>
              <p className="mt-0.5 font-medium">
                {member.designation ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Position</p>
              <p className="mt-0.5 font-medium">{member.position ?? "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Dedicated work</p>
              <p className="mt-0.5 font-medium">
                {member.dedicated_work ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reporting manager</p>
              <p className="mt-0.5 font-medium">
                {manager?.full_name ?? "Not assigned"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Monthly target</p>
              <p className="mt-0.5 font-medium">
                {formatINR(target?.target_amount ?? salary?.target_amount)}
              </p>
            </div>
          </CardContent>
        </Card>

        {showSalary ? (
          <Card>
            <CardHeader>
              <CardTitle>Compensation</CardTitle>
              <CardDescription>Current month overview.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Base salary</span>
                <span className="font-medium">
                  {formatINR(config?.base_salary ?? salary?.base_salary)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sales incentive</span>
                <span className="font-medium">
                  {config
                    ? `${config.sales_incentive_percent}%`
                    : formatINR(salary?.sales_incentive)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">This month total</span>
                <span className="font-medium">
                  {formatINR(salary?.total_salary)}
                </span>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">Target</span>
                  <span>
                    {formatINR(salary?.achieved)} /{" "}
                    {formatINR(salary?.target_amount)}
                  </span>
                </div>
                <Progress
                  value={Math.min(toNumber(salary?.target_pct), 100)}
                  className="[&_[data-slot=progress-indicator]]:bg-brand-gradient"
                />
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-muted-foreground">Payout</span>
                <StatusBadge status={salary?.payout_status ?? "pending"} />
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {dialogOpen ? (
        <MemberDialog
          key={`edit-${member.id}`}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          member={member}
          salaryConfig={config}
          monthlyTarget={target?.target_amount ?? null}
          managers={profiles}
          actorRole={role ?? "employee"}
        />
      ) : null}
    </div>
  );
}
