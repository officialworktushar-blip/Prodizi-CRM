"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  BadgeIndianRupee,
  CalendarDays,
  CheckCircle2,
  Download,
  IndianRupee,
  MoreHorizontal,
  Printer,
  Search,
  Settings2,
  Sparkles,
  Target as TargetIcon,
  UserRound,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { ManualIncentiveDialog } from "@/components/salary/manual-incentive-dialog";
import { PayoutDialog } from "@/components/salary/payout-dialog";
import { SalaryConfigDialog } from "@/components/salary/salary-config-dialog";
import { SalarySlipDialog } from "@/components/salary/salary-slip-dialog";
import { TargetDialog } from "@/components/salary/target-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useNow } from "@/hooks/use-now";
import { useRole } from "@/hooks/use-role";
import { useTeamTree } from "@/hooks/use-team-tree";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { isAdminRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { getFlatDownline } from "@/lib/team-hierarchy";
import {
  formatDate,
  formatINR,
  formatPercent,
  todayISO,
  toNumber,
} from "@/lib/utils";
import type {
  Incentive,
  SalaryConfig,
  SalaryMonthly,
  SalaryPayout,
  Target,
} from "@/types/database";

export default function SalaryPage() {
  const { profile, role, loading: roleLoading, error: roleError } = useRole();
  const { members, loading: treeLoading } = useTeamTree();
  const queryClient = useQueryClient();
  const isAdmin = isAdminRole(role);
  const isOwner = role === "owner";
  const now = useNow();
  const [monthOverride, setMonth] = useState<string | null>(null);
  const month = monthOverride ?? (now ? format(now, "yyyy-MM") : "");
  const [search, setSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState("all");
  const [payoutRow, setPayoutRow] = useState<SalaryMonthly | null>(null);
  const [manualRow, setManualRow] = useState<SalaryMonthly | null>(null);
  const [slipRow, setSlipRow] = useState<SalaryMonthly | null>(null);
  const [configRow, setConfigRow] = useState<SalaryMonthly | null>(null);
  const [targetRow, setTargetRow] = useState<SalaryMonthly | null>(null);

  const monthDate = month ? `${month}-01` : "";

  const salaryQuery = useQuery({
    queryKey: ["salary", "monthly", month, profile?.id, role],
    enabled: Boolean(profile?.id) && Boolean(month) && !treeLoading,
    queryFn: async () => {
      const supabase = createClient();
      if (!isAdmin) {
        const { data, error } = await supabase
          .from("salary_monthly")
          .select("*")
          .eq("user_id", profile!.id)
          .eq("month", monthDate)
          .maybeSingle();
        if (error) throw error;
        return (data ? [data] : []) as SalaryMonthly[];
      }

      let query = supabase
        .from("salary_monthly")
        .select("*")
        .eq("month", monthDate);
      if (role === "manager") {
        const ids = members.map((member) => member.id);
        if (ids.length === 0) return [];
        query = query.in("user_id", ids);
      }
      const { data, error } = await query.order("full_name");
      if (error) throw error;
      return (data ?? []) as SalaryMonthly[];
    },
  });

  const payoutsQuery = useQuery({
    queryKey: ["salary-payouts", month, isAdmin ? "team" : profile?.id],
    enabled: Boolean(profile?.id) && Boolean(month) && !treeLoading,
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from("salary_payouts")
        .select("*")
        .eq("month", monthDate);
      if (!isAdmin) {
        query = query.eq("user_id", profile!.id);
      } else if (role === "manager") {
        const ids = members.map((member) => member.id);
        if (ids.length === 0) return [];
        query = query.in("user_id", ids);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as SalaryPayout[];
    },
  });

  const incentivesQuery = useQuery({
    queryKey: ["incentives", "member", profile?.id, month],
    enabled: Boolean(profile?.id) && Boolean(month) && !isAdmin,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("incentives")
        .select("*")
        .eq("user_id", profile!.id)
        .eq("month", monthDate)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Incentive[];
    },
  });

  const configsQuery = useQuery({
    queryKey: ["salary", "configs"],
    enabled: isOwner,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("salary_config").select("*");
      if (error) throw error;
      return (data ?? []) as SalaryConfig[];
    },
  });

  const targetsQuery = useQuery({
    queryKey: ["targets", month],
    enabled: isOwner && Boolean(month),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("targets")
        .select("*")
        .eq("month", monthDate);
      if (error) throw error;
      return (data ?? []) as Target[];
    },
  });

  const rows = useMemo(() => salaryQuery.data ?? [], [salaryQuery.data]);
  const row = rows[0] ?? null;

  const payoutMap = useMemo(
    () =>
      new Map((payoutsQuery.data ?? []).map((item) => [item.user_id, item])),
    [payoutsQuery.data],
  );
  const configMap = useMemo(
    () =>
      new Map((configsQuery.data ?? []).map((item) => [item.user_id, item])),
    [configsQuery.data],
  );
  const targetMap = useMemo(
    () =>
      new Map((targetsQuery.data ?? []).map((item) => [item.user_id, item])),
    [targetsQuery.data],
  );

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let result = rows;
    if (isAdmin && memberFilter !== "all" && memberFilter !== "team") {
      const ids = new Set([
        memberFilter,
        ...getFlatDownline(members, memberFilter).map((member) => member.id),
      ]);
      result = result.filter((item) => item.user_id && ids.has(item.user_id));
    }
    if (!needle) return result;
    return result.filter((item) =>
      (item.full_name ?? "").toLowerCase().includes(needle),
    );
  }, [isAdmin, memberFilter, members, rows, search]);

  const totals = useMemo(
    () => ({
      payroll: filteredRows.reduce(
        (sum, item) => sum + toNumber(item.total_salary),
        0,
      ),
      incentives: filteredRows.reduce(
        (sum, item) =>
          sum +
          toNumber(item.task_incentive) +
          toNumber(item.sales_incentive) +
          toNumber(item.manual_incentive),
        0,
      ),
      paid: filteredRows
        .filter((item) => item.payout_status === "paid")
        .reduce((sum, item) => sum + toNumber(item.total_salary), 0),
      pending: filteredRows
        .filter((item) => item.payout_status !== "paid")
        .reduce((sum, item) => sum + toNumber(item.total_salary), 0),
    }),
    [filteredRows],
  );

  const markPaidMutation = useMutation({
    mutationFn: async (item: SalaryMonthly) => {
      if (!item.user_id) throw new Error("Missing member");
      const supabase = createClient();
      const payout = payoutMap.get(item.user_id);
      const payload = {
        user_id: item.user_id,
        month: monthDate,
        bonus: payout?.bonus ?? toNumber(item.bonus),
        deduction: payout?.deduction ?? toNumber(item.deduction),
        status: "paid",
        paid_on: payout?.paid_on ?? todayISO(),
      };

      if (payout) {
        const { error } = await supabase
          .from("salary_payouts")
          .update(payload)
          .eq("id", payout.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("salary_payouts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Salary marked as paid");
      void queryClient.invalidateQueries({ queryKey: ["salary"] });
      void queryClient.invalidateQueries({ queryKey: ["salary-payouts"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Update failed");
    },
  });

  const exportPayroll = () => {
    if (filteredRows.length === 0) {
      toast.error("There is no payroll to export");
      return;
    }

    const data = filteredRows.map((item) => ({
      member: item.full_name ?? "",
      role: item.role ? ROLE_LABELS[item.role as Role] : "Member",
      month: item.month ?? monthDate,
      base_salary: toNumber(item.base_salary),
      task_incentive: toNumber(item.task_incentive),
      sales_incentive: toNumber(item.sales_incentive),
      manual_incentive: toNumber(item.manual_incentive),
      bonus: toNumber(item.bonus),
      deduction: toNumber(item.deduction),
      total_salary: toNumber(item.total_salary),
      target_amount: toNumber(item.target_amount),
      achieved: toNumber(item.achieved),
      target_pct: toNumber(item.target_pct),
      target_stage: item.target_stage ?? "",
      payout_status: item.payout_status ?? "pending",
      paid_on: payoutMap.get(item.user_id ?? "")?.paid_on ?? "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Salary");
    XLSX.writeFile(workbook, `salary-${month}.xlsx`);
  };

  if (roleLoading || treeLoading || !month) {
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAdmin ? "Salary & payroll" : "My salary"}
        description={
          isAdmin
            ? "Monthly payroll, incentives, bonuses and payouts."
            : "Your earnings and incentive breakdown for the month."
        }
        eyebrow="Compensation"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" />
              <Input
                type="month"
                value={month}
                onChange={(event) => {
                  if (event.target.value) setMonth(event.target.value);
                }}
                className="w-[170px]"
              />
            </div>
            {isAdmin ? (
              <Button variant="outline" onClick={exportPayroll}>
                <Download className="size-4" />
                Export
              </Button>
            ) : row ? (
              <Button variant="outline" onClick={() => setSlipRow(row)}>
                <Printer className="size-4" />
                Salary slip
              </Button>
            ) : null}
          </div>
        }
      />

      {isAdmin ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total payroll"
              value={formatINR(totals.payroll)}
              hint={`${rows.length} members`}
              icon={BadgeIndianRupee}
              accent="blue"
            />
            <StatCard
              title="Incentives"
              value={formatINR(totals.incentives)}
              hint="Task, sales and manual"
              icon={IndianRupee}
              accent="green"
            />
            <StatCard
              title="Paid out"
              value={formatINR(totals.paid)}
              hint={`${rows.filter((item) => item.payout_status === "paid").length} settled`}
              icon={Wallet}
              accent="teal"
            />
            <StatCard
              title="Pending"
              value={formatINR(totals.pending)}
              hint={`${rows.filter((item) => item.payout_status !== "paid").length} members`}
              icon={TargetIcon}
              accent="orange"
            />
          </div>

          <Card>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative max-w-sm flex-1">
                  <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search member..."
                    className="pl-9"
                  />
                </div>
                {isAdmin ? (
                  <Select value={memberFilter} onValueChange={setMemberFilter}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All members</SelectItem>
                      <SelectItem value="team">My whole team</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>

              {salaryQuery.error ? (
                <ErrorState
                  message="Payroll could not be loaded."
                  onRetry={() => void salaryQuery.refetch()}
                />
              ) : salaryQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredRows.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="No payroll for this month"
                  description="Salary rows appear once members have salary configurations and activity."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[1080px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Base</TableHead>
                        <TableHead>Task inc.</TableHead>
                        <TableHead>Sales inc.</TableHead>
                        <TableHead>Manual</TableHead>
                        <TableHead>Bonus / Deduction</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Payout</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((item) => (
                        <TableRow key={item.user_id}>
                          <TableCell>
                            <p className="font-medium">{item.full_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.role
                                ? ROLE_LABELS[item.role as Role]
                                : "Member"}
                            </p>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatINR(item.base_salary)}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatINR(item.task_incentive)}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatINR(item.sales_incentive)}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatINR(item.manual_incentive)}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            <span className="text-brand-green">
                              +{formatINR(item.bonus)}
                            </span>
                            {" / "}
                            <span className="text-brand-red">
                              -{formatINR(item.deduction)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm font-semibold whitespace-nowrap">
                            {formatINR(item.total_salary)}
                          </TableCell>
                          <TableCell>
                            <div className="w-28">
                              <div className="mb-1 flex justify-between text-xs">
                                <span className="text-muted-foreground">
                                  {formatPercent(item.target_pct)}
                                </span>
                                <span className="capitalize">
                                  {item.target_stage ?? "No target"}
                                </span>
                              </div>
                              <Progress
                                value={Math.min(toNumber(item.target_pct), 100)}
                                className="[&_[data-slot=progress-indicator]]:bg-brand-gradient"
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              status={item.payout_status ?? "pending"}
                            />
                            {item.payout_status === "paid" ? (
                              <p className="mt-1 text-[0.65rem] text-muted-foreground">
                                {formatDate(
                                  payoutMap.get(item.user_id ?? "")?.paid_on,
                                )}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Payroll actions"
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => setPayoutRow(item)}
                                >
                                  <Settings2 className="size-4" />
                                  Adjust payroll
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setManualRow(item)}
                                >
                                  <Sparkles className="size-4" />
                                  Manual incentive
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setSlipRow(item)}
                                >
                                  <Printer className="size-4" />
                                  Salary slip
                                </DropdownMenuItem>
                                {item.payout_status !== "paid" ? (
                                  <DropdownMenuItem
                                    disabled={markPaidMutation.isPending}
                                    onClick={() =>
                                      markPaidMutation.mutate(item)
                                    }
                                  >
                                    <CheckCircle2 className="size-4" />
                                    Mark as paid
                                  </DropdownMenuItem>
                                ) : null}
                                {isOwner ? (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => setConfigRow(item)}
                                    >
                                      Salary configuration
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setTargetRow(item)}
                                    >
                                      Set monthly target
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : !row ? (
        <EmptyState
          icon={Wallet}
          title="No salary data for this month"
          description="Your salary configuration has not been set up yet. Contact an owner."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Base salary"
              value={formatINR(row.base_salary)}
              icon={IndianRupee}
              accent="blue"
            />
            <StatCard
              title="Incentives"
              value={formatINR(
                toNumber(row.task_incentive) +
                  toNumber(row.sales_incentive) +
                  toNumber(row.manual_incentive),
              )}
              hint="This month"
              icon={BadgeIndianRupee}
              accent="green"
            />
            <StatCard
              title="Bonus / deduction"
              value={`${formatINR(row.bonus)} / ${formatINR(row.deduction)}`}
              icon={Settings2}
              accent="orange"
            />
            <StatCard
              title="Total salary"
              value={formatINR(row.total_salary)}
              hint={row.payout_status === "paid" ? "Paid" : "Pending payout"}
              icon={Wallet}
              accent="teal"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Earnings breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base salary</span>
                  <span>{formatINR(row.base_salary)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Task incentives</span>
                  <span>{formatINR(row.task_incentive)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Sales incentives
                  </span>
                  <span>{formatINR(row.sales_incentive)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Manual incentives
                  </span>
                  <span>{formatINR(row.manual_incentive)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bonus</span>
                  <span className="text-brand-green">
                    +{formatINR(row.bonus)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deduction</span>
                  <span className="text-brand-red">
                    -{formatINR(row.deduction)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span>{formatINR(row.total_salary)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Target & payout</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-semibold">
                        {formatPercent(row.target_pct)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatINR(row.achieved)} of{" "}
                        {formatINR(row.target_amount)}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {row.target_stage ?? "No target"}
                    </Badge>
                  </div>
                  <Progress
                    value={Math.min(toNumber(row.target_pct), 100)}
                    className="mt-3 h-2 [&_[data-slot=progress-indicator]]:bg-brand-gradient"
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-3">
                  <div>
                    <p className="text-sm font-medium">Payout status</p>
                    <p className="text-xs text-muted-foreground">
                      {row.payout_status === "paid"
                        ? payoutMap.get(row.user_id ?? "")?.paid_on
                          ? `Paid on ${formatDate(
                              payoutMap.get(row.user_id ?? "")?.paid_on,
                            )}.`
                          : "Your salary has been paid."
                        : "Payment is pending."}
                    </p>
                  </div>
                  <StatusBadge status={row.payout_status ?? "pending"} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Incentive history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {incentivesQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : incentivesQuery.error ? (
                <p className="text-sm text-destructive">
                  Incentive history could not be loaded.
                </p>
              ) : (incentivesQuery.data ?? []).length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No incentives recorded for this month.
                </p>
              ) : (
                (incentivesQuery.data ?? []).map((incentive) => (
                  <div
                    key={incentive.id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {formatINR(incentive.amount)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(incentive.created_at)}
                        {incentive.note ? ` - ${incentive.note}` : ""}
                      </p>
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {incentive.source}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}

      {isAdmin && payoutRow ? (
        <PayoutDialog
          key={`payout-${payoutRow.user_id}-${month}`}
          open={Boolean(payoutRow)}
          onOpenChange={(open) => {
            if (!open) setPayoutRow(null);
          }}
          row={payoutRow}
          payout={payoutMap.get(payoutRow.user_id ?? "") ?? null}
          month={month}
        />
      ) : null}

      {isAdmin && manualRow ? (
        <ManualIncentiveDialog
          key={`manual-${manualRow.user_id}-${month}`}
          open={Boolean(manualRow)}
          onOpenChange={(open) => {
            if (!open) setManualRow(null);
          }}
          row={manualRow}
          month={month}
          currentUserId={profile.id}
        />
      ) : null}

      {slipRow ? (
        <SalarySlipDialog
          key={`slip-${slipRow.user_id}-${month}`}
          open={Boolean(slipRow)}
          onOpenChange={(open) => {
            if (!open) setSlipRow(null);
          }}
          row={slipRow}
          payout={payoutMap.get(slipRow.user_id ?? "") ?? null}
          month={month}
        />
      ) : null}

      {isOwner && configRow ? (
        <SalaryConfigDialog
          key={`config-${configRow.user_id}`}
          open={Boolean(configRow)}
          onOpenChange={(open) => {
            if (!open) setConfigRow(null);
          }}
          row={configRow}
          config={configMap.get(configRow.user_id ?? "") ?? null}
        />
      ) : null}

      {isOwner && targetRow ? (
        <TargetDialog
          key={`target-${targetRow.user_id}-${month}`}
          open={Boolean(targetRow)}
          onOpenChange={(open) => {
            if (!open) setTargetRow(null);
          }}
          row={targetRow}
          target={targetMap.get(targetRow.user_id ?? "") ?? null}
          month={month}
        />
      ) : null}
    </div>
  );
}
