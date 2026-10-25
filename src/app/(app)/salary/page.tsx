"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  BadgeIndianRupee,
  CalendarDays,
  IndianRupee,
  Search,
  Settings2,
  Target as TargetIcon,
  UserRound,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";

import { PayoutDialog } from "@/components/salary/payout-dialog";
import { SalaryConfigDialog } from "@/components/salary/salary-config-dialog";
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
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { isAdminRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import {
  formatDate,
  formatINR,
  formatPercent,
  toNumber,
} from "@/lib/utils";
import type {
  SalaryConfig,
  SalaryMonthly,
  SalaryPayout,
  Target,
} from "@/types/database";

export default function SalaryPage() {
  const { profile, role, loading: roleLoading, error: roleError } = useRole();
  const isAdmin = isAdminRole(role);
  const isOwner = role === "owner";
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [search, setSearch] = useState("");
  const [payoutRow, setPayoutRow] = useState<SalaryMonthly | null>(null);
  const [configRow, setConfigRow] = useState<SalaryMonthly | null>(null);
  const [targetRow, setTargetRow] = useState<SalaryMonthly | null>(null);

  const monthDate = `${month}-01`;

  const salaryQuery = useQuery({
    queryKey: ["salary", "monthly", month, profile?.id, role],
    enabled: Boolean(profile?.id),
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

      const { data, error } = await supabase
        .from("salary_monthly")
        .select("*")
        .eq("month", monthDate)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as SalaryMonthly[];
    },
  });

  const payoutsQuery = useQuery({
    queryKey: ["salary-payouts", month],
    enabled: isAdmin,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("salary_payouts")
        .select("*")
        .eq("month", monthDate);
      if (error) throw error;
      return (data ?? []) as SalaryPayout[];
    },
  });

  const configsQuery = useQuery({
    queryKey: ["salary", "configs"],
    enabled: isOwner,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("salary_config")
        .select("*");
      if (error) throw error;
      return (data ?? []) as SalaryConfig[];
    },
  });

  const targetsQuery = useQuery({
    queryKey: ["targets", month],
    enabled: isOwner,
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
      new Map(
        (payoutsQuery.data ?? []).map((item) => [item.user_id, item]),
      ),
    [payoutsQuery.data],
  );
  const configMap = useMemo(
    () => new Map((configsQuery.data ?? []).map((item) => [item.user_id, item])),
    [configsQuery.data],
  );
  const targetMap = useMemo(
    () => new Map((targetsQuery.data ?? []).map((item) => [item.user_id, item])),
    [targetsQuery.data],
  );

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((item) =>
      (item.full_name ?? "").toLowerCase().includes(needle),
    );
  }, [rows, search]);

  const totals = useMemo(
    () => ({
      payroll: rows.reduce(
        (sum, item) => sum + toNumber(item.total_salary),
        0,
      ),
      incentives: rows.reduce(
        (sum, item) =>
          sum +
          toNumber(item.task_incentive) +
          toNumber(item.sales_incentive) +
          toNumber(item.manual_incentive),
        0,
      ),
      paid: rows
        .filter((item) => item.payout_status === "paid")
        .reduce((sum, item) => sum + toNumber(item.total_salary), 0),
      pending: rows
        .filter((item) => item.payout_status !== "paid")
        .reduce((sum, item) => sum + toNumber(item.total_salary), 0),
    }),
    [rows],
  );

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
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            <Input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="w-[170px]"
            />
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
              <div className="relative max-w-sm">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search member..."
                  className="pl-9"
                />
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
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatINR(item.base_salary)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatINR(item.task_incentive)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatINR(item.sales_incentive)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatINR(item.manual_incentive)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            <span className="text-brand-green">
                              +{formatINR(item.bonus)}
                            </span>
                            {" / "}
                            <span className="text-brand-red">
                              -{formatINR(item.deduction)}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm font-semibold">
                            {formatINR(item.total_salary)}
                          </TableCell>
                          <TableCell>
                            <div className="w-28">
                              <div className="mb-1 flex justify-between text-xs">
                                <span className="text-muted-foreground">
                                  {formatPercent(item.target_pct)}
                                </span>
                                <span className="capitalize">
                                  {item.target_stage ?? "—"}
                                </span>
                              </div>
                              <Progress
                                value={Math.min(
                                  toNumber(item.target_pct),
                                  100,
                                )}
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
                                  <span className="text-lg leading-none">
                                    ···
                                  </span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => setPayoutRow(item)}
                                >
                                  <Settings2 className="size-4" />
                                  Adjust payroll
                                </DropdownMenuItem>
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
                  <span className="text-muted-foreground">Sales incentives</span>
                  <span>{formatINR(row.sales_incentive)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Manual incentives</span>
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
                        ? "Your salary has been paid."
                        : "Payment is pending."}
                    </p>
                  </div>
                  <StatusBadge status={row.payout_status ?? "pending"} />
                </div>
              </CardContent>
            </Card>
          </div>
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
