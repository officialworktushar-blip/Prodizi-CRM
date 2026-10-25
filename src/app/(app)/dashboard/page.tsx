"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  addMonths,
  format,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import {
  ArrowUpRight,
  CalendarCheck,
  IndianRupee,
  ListChecks,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import {
  BRAND_COLORS,
  LEAD_STATUS_LABELS,
  ROLE_LABELS,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import {
  formatCompactINR,
  formatINR,
  formatPercent,
  getInitials,
  monthStartISO,
  toNumber,
} from "@/lib/utils";
import type { Lead, Sale } from "@/types/database";

type LeadRow = Pick<
  Lead,
  "id" | "status" | "created_at" | "updated_at" | "expected_value"
>;
type SaleRow = Pick<
  Sale,
  | "id"
  | "total_amount"
  | "received_amount"
  | "remaining_amount"
  | "payment_status"
  | "sale_date"
  | "sold_by"
>;

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      {label ? <p className="mb-1 font-medium">{label}</p> : null}
      {payload.map((item) => (
        <p key={item.name} className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-muted-foreground">{item.name}:</span>
          <span className="font-medium">{formatINR(item.value ?? 0)}</span>
        </p>
      ))}
    </div>
  );
}

function AdminDashboard() {
  const { profile } = useRole();
  const now = useNow();
  const query = useQuery({
    queryKey: ["dashboard", "admin"],
    queryFn: async () => {
      const supabase = createClient();
      const monthStart = startOfMonth(new Date());
      const monthStartIso = monthStart.toISOString();
      const nextMonthIso = addMonths(monthStart, 1).toISOString();
      const todayStartIso = startOfDay(new Date()).toISOString();

      const [leadsResult, salesResult, tasksResult, statsResult] =
        await Promise.all([
          supabase
            .from("leads")
            .select("id,status,created_at,updated_at,expected_value"),
          supabase
            .from("sales")
            .select(
              "id,total_amount,received_amount,remaining_amount,payment_status,sale_date,sold_by",
            ),
          supabase
            .from("tasks")
            .select("id,status,completed_at")
            .eq("status", "completed")
            .gte("completed_at", todayStartIso),
          supabase
            .from("member_stats")
            .select("*")
            .order("performance_pct", { ascending: false }),
        ]);

      const error =
        leadsResult.error ??
        salesResult.error ??
        tasksResult.error ??
        statsResult.error;
      if (error) throw error;

      return {
        leads: (leadsResult.data ?? []) as LeadRow[],
        sales: (salesResult.data ?? []) as SaleRow[],
        tasksCompletedToday: tasksResult.data?.length ?? 0,
        stats: statsResult.data ?? [],
        monthStartIso,
        nextMonthIso,
      };
    },
  });

  if (query.isLoading || !now) return <DashboardSkeleton />;
  if (query.error) {
    return (
      <ErrorState
        message="The dashboard could not be loaded."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const {
    leads,
    sales,
    tasksCompletedToday,
    stats,
    monthStartIso,
    nextMonthIso,
  } = query.data!;

  const confirmedThisMonth = leads.filter(
    (lead) =>
      lead.status === "confirmed" &&
      lead.updated_at >= monthStartIso &&
      lead.updated_at < nextMonthIso,
  ).length;

  const revenueThisMonth = sales
    .filter(
      (sale) =>
        sale.sale_date >= monthStartIso.slice(0, 10) &&
        sale.sale_date < nextMonthIso.slice(0, 10),
    )
    .reduce((sum, sale) => sum + toNumber(sale.total_amount), 0);

  const pendingPayments = sales
    .filter((sale) => sale.payment_status !== "paid")
    .reduce(
      (sum, sale) =>
        sum +
        toNumber(
          sale.remaining_amount ??
            toNumber(sale.total_amount) - toNumber(sale.received_amount),
        ),
      0,
    );

  const averagePerformance =
    stats.length > 0
      ? stats.reduce((sum, row) => sum + toNumber(row.performance_pct), 0) /
        stats.length
      : 0;

  const leadStatusData = Object.entries(LEAD_STATUS_LABELS)
    .map(([status, label]) => ({
      status,
      name: label,
      value: leads.filter((lead) => lead.status === status).length,
    }))
    .filter((item) => item.value > 0);

  const revenueData = Array.from({ length: 6 }).map((_, index) => {
    const month = subMonths(startOfMonth(now), 5 - index);
    const key = format(month, "yyyy-MM");
    return {
      month: format(month, "MMM"),
      revenue: sales
        .filter((sale) => sale.sale_date.startsWith(key))
        .reduce((sum, sale) => sum + toNumber(sale.total_amount), 0),
    };
  });

  const statusColors: Record<string, string> = {
    upcoming: BRAND_COLORS.teal,
    pending: BRAND_COLORS.orange,
    ongoing: BRAND_COLORS.blue,
    confirmed: BRAND_COLORS.green,
    cancelled: BRAND_COLORS.red,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good to see you, ${profile?.full_name.split(" ")[0] ?? "there"}`}
        description="Company performance, revenue and pipeline in one view."
        eyebrow="Overview"
        actions={
          <Badge variant="secondary" className="h-7 px-3">
            {profile ? ROLE_LABELS[profile.role] : "Member"}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Total leads"
          value={leads.length}
          hint={`${leadStatusData.find((item) => item.status === "ongoing")?.value ?? 0} ongoing`}
          icon={Target}
          accent="blue"
        />
        <StatCard
          title="Confirmed this month"
          value={confirmedThisMonth}
          hint="Converted opportunities"
          icon={CalendarCheck}
          accent="green"
        />
        <StatCard
          title="Revenue this month"
          value={formatINR(revenueThisMonth)}
          hint="Total value of new sales"
          icon={IndianRupee}
          accent="teal"
        />
        <StatCard
          title="Pending payments"
          value={formatINR(pendingPayments)}
          hint={`${sales.filter((sale) => sale.payment_status !== "paid").length} sales awaiting collection`}
          icon={Wallet}
          accent="orange"
        />
        <StatCard
          title="Tasks completed today"
          value={tasksCompletedToday}
          hint="Across the whole team"
          icon={ListChecks}
          accent="green"
        />
        <StatCard
          title="Average team performance"
          value={formatPercent(averagePerformance)}
          hint={`${stats.length} active members`}
          icon={TrendingUp}
          accent="blue"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Revenue by month</CardTitle>
            <CardDescription>Last six months of sales value.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} margin={{ left: 4, right: 8 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    stroke="var(--muted-foreground)"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    width={64}
                    stroke="var(--muted-foreground)"
                    tickFormatter={(value) => formatCompactINR(Number(value))}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: "var(--muted)" }}
                  />
                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    fill={BRAND_COLORS.blue}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Leads by status</CardTitle>
            <CardDescription>Current pipeline distribution.</CardDescription>
          </CardHeader>
          <CardContent>
            {leadStatusData.length === 0 ? (
              <EmptyState
                icon={Target}
                title="No leads yet"
                description="Add your first lead to see the pipeline."
                className="border-0 bg-transparent py-8"
              />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={leadStatusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={88}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {leadStatusData.map((entry) => (
                        <Cell
                          key={entry.status}
                          fill={
                            statusColors[entry.status] ?? BRAND_COLORS.blue
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [
                        `${Number(value ?? 0)} leads`,
                        String(name ?? ""),
                      ]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => (
                        <span className="text-xs text-muted-foreground">
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Top performers</CardTitle>
            <CardDescription>
              Ranked by task completion performance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No performance data yet"
                description="Performance appears once tasks are completed."
                className="border-0 bg-transparent py-8"
              />
            ) : (
              stats.slice(0, 5).map((member, index) => (
                <Link
                  key={member.user_id}
                  href={`/team/${member.user_id}`}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50"
                >
                  <span className="w-5 text-center text-xs font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <Avatar className="size-9">
                    {member.avatar_url ? (
                      <AvatarImage
                        src={member.avatar_url}
                        alt={member.full_name ?? ""}
                      />
                    ) : null}
                    <AvatarFallback className="bg-brand-gradient text-xs font-semibold text-white">
                      {getInitials(member.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.full_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.designation ??
                        member.position ??
                        (member.role ? ROLE_LABELS[member.role] : "Team member")}
                    </p>
                  </div>
                  <div className="w-28 shrink-0">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Performance</span>
                      <span className="font-medium">
                        {formatPercent(member.performance_pct)}
                      </span>
                    </div>
                    <Progress
                      value={toNumber(member.performance_pct)}
                      className="[&_[data-slot=progress-indicator]]:bg-brand-gradient"
                    />
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground" />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Team snapshot</CardTitle>
            <CardDescription>Tasks completed and pending.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.slice(0, 6).map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-muted text-[0.65rem] font-semibold">
                      {getInitials(member.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{member.full_name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary" className="font-mono">
                    {member.tasks_completed ?? 0}
                  </Badge>
                  <span className="text-xs text-muted-foreground">done</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">
                    {member.tasks_pending ?? 0} pending
                  </span>
                </div>
              </div>
            ))}
            {stats.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No team data yet.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmployeeDashboard() {
  const { profile, role } = useRole();
  const query = useQuery({
    queryKey: ["dashboard", "employee", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const supabase = createClient();
      const userId = profile!.id;
      const today = format(new Date(), "yyyy-MM-dd");
      const month = monthStartISO();

      const [tasksResult, leadsResult, targetResult, salaryResult] =
        await Promise.all([
          supabase
            .from("tasks")
            .select("*")
            .eq("assigned_to", userId)
            .eq("due_date", today)
            .order("created_at", { ascending: false }),
          supabase
            .from("leads")
            .select("id,status,client_name")
            .eq("assigned_to", userId),
          supabase
            .from("target_progress")
            .select("*")
            .eq("user_id", userId)
            .eq("month", month)
            .maybeSingle(),
          supabase
            .from("salary_monthly")
            .select("*")
            .eq("user_id", userId)
            .eq("month", month)
            .maybeSingle(),
        ]);

      const error =
        tasksResult.error ??
        leadsResult.error ??
        targetResult.error ??
        salaryResult.error;
      if (error) throw error;

      return {
        tasks: tasksResult.data ?? [],
        leads: leadsResult.data ?? [],
        target: targetResult.data,
        salary: salaryResult.data,
      };
    },
  });

  if (query.isLoading) return <DashboardSkeleton />;
  if (query.error) {
    return (
      <ErrorState
        message="Your dashboard could not be loaded."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const { tasks, leads, target, salary } = query.data!;
  const completedTasks = tasks.filter(
    (task) => task.status === "completed",
  ).length;
  const incentiveTotal =
    toNumber(salary?.task_incentive) +
    toNumber(salary?.sales_incentive) +
    toNumber(salary?.manual_incentive);
  const targetPct = toNumber(target?.pct);
  const leadStatusData = Object.entries(LEAD_STATUS_LABELS).map(
    ([status, label]) => ({
      status,
      name: label,
      value: leads.filter((lead) => lead.status === status).length,
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${profile?.full_name.split(" ")[0] ?? "there"}`}
        description="Your work, pipeline and earnings for today."
        eyebrow="My workspace"
        actions={
          <Badge variant="secondary" className="h-7 px-3">
            {role ? ROLE_LABELS[role] : "Member"}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="My tasks today"
          value={tasks.length}
          hint={`${completedTasks} completed`}
          icon={ListChecks}
          accent="blue"
        />
        <StatCard
          title="My leads"
          value={leads.length}
          hint={`${leads.filter((lead) => lead.status === "confirmed").length} confirmed`}
          icon={Target}
          accent="teal"
        />
        <StatCard
          title="Target progress"
          value={formatPercent(targetPct)}
          hint={target?.stage ?? "No target set"}
          icon={TrendingUp}
          accent="orange"
        />
        <StatCard
          title="Incentive this month"
          value={formatINR(incentiveTotal)}
          hint={`${formatINR(salary?.sales_incentive)} from sales`}
          icon={Wallet}
          accent="green"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Today&apos;s tasks</CardTitle>
            <CardDescription>Work assigned to you for today.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No tasks for today"
                description="Enjoy the clear runway, or add a task for yourself."
                className="border-0 bg-transparent py-8"
                action={
                  <Link
                    href="/tasks"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Go to tasks
                  </Link>
                }
              />
            ) : (
              tasks.slice(0, 6).map((task) => (
                <Link
                  key={task.id}
                  href="/tasks"
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {task.description || "No description"}
                    </p>
                  </div>
                  <StatusBadge status={task.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Target progress</CardTitle>
            <CardDescription>Current month achievement.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-semibold tracking-tight">
                  {formatPercent(targetPct)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatINR(target?.achieved)} of{" "}
                  {formatINR(target?.target_amount)}
                </p>
              </div>
              <Badge variant="outline" className="capitalize">
                {target?.stage ?? "No target"}
              </Badge>
            </div>
            <Progress
              value={Math.min(targetPct, 100)}
              className="h-2 [&_[data-slot=progress-indicator]]:bg-brand-gradient"
            />
            <div className="rounded-xl border bg-muted/40 p-3">
              <p className="text-xs font-medium">Incentive breakdown</p>
              <div className="mt-2 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Task incentives</span>
                  <span>{formatINR(salary?.task_incentive)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sales incentives</span>
                  <span>{formatINR(salary?.sales_incentive)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Manual</span>
                  <span>{formatINR(salary?.manual_incentive)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t pt-1.5 font-medium">
                  <span>Total</span>
                  <span>{formatINR(incentiveTotal)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My leads by status</CardTitle>
            <CardDescription>Where your pipeline stands.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {leadStatusData.map((item) => {
              const pct =
                leads.length > 0
                  ? Math.round((item.value / leads.length) * 100)
                  : 0;
              return (
                <div key={item.status} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                  <Progress
                    value={pct}
                    className="h-1.5 [&_[data-slot=progress-indicator]]:bg-brand-blue"
                  />
                </div>
              );
            })}
            {leads.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No leads assigned yet.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Salary summary</CardTitle>
            <CardDescription>This month at a glance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base salary</span>
              <span className="font-medium">
                {formatINR(salary?.base_salary)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Incentives</span>
              <span className="font-medium">{formatINR(incentiveTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bonus</span>
              <span className="font-medium">{formatINR(salary?.bonus)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deduction</span>
              <span className="font-medium">
                {formatINR(salary?.deduction)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Total</span>
              <span>{formatINR(salary?.total_salary)}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                Payout status
              </span>
              <StatusBadge status={salary?.payout_status ?? "pending"} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { role, loading, error, profile } = useRole();

  if (loading) return <DashboardSkeleton />;
  if (error) {
    return (
      <ErrorState message="We could not verify your profile. Please sign in again." />
    );
  }
  if (!profile) {
    return (
      <EmptyState
        icon={Users}
        title="Profile not found"
        description="Your account is signed in but has no profile record. Contact an owner."
      />
    );
  }

  return role === "owner" || role === "manager" ? (
    <AdminDashboard />
  ) : (
    <EmployeeDashboard />
  );
}
