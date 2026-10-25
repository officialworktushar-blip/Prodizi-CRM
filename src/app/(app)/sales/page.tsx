"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  BadgeIndianRupee,
  Download,
  IndianRupee,
  MoreHorizontal,
  Plus,
  Receipt,
  Search,
  Trash2,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { PaymentDialog } from "@/components/sales/payment-dialog";
import { SaleDetailSheet } from "@/components/sales/sale-detail-sheet";
import { SaleDialog } from "@/components/sales/sale-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  ROLE_LABELS,
  type PaymentStatus,
} from "@/lib/constants";
import { isAdminRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { getFlatDownline } from "@/lib/team-hierarchy";
import {
  formatDate,
  formatINR,
  getInitials,
  todayISO,
  toNumber,
} from "@/lib/utils";
import type { Lead, Sale } from "@/types/database";

type DatePreset = "all" | "today" | "week" | "month" | "custom";
type UpgradeFilter = "all" | "upgrade" | "new";

export default function SalesPage() {
  const { profile, role, loading: roleLoading, error: roleError } = useRole();
  const { members, loading: treeLoading } = useTeamTree();
  const isAdmin = isAdminRole(role);
  const queryClient = useQueryClient();
  const [paymentFilter, setPaymentFilter] = useState<"all" | PaymentStatus>(
    "all",
  );
  const [sellerFilter, setSellerFilter] = useState("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [upgradeFilter, setUpgradeFilter] = useState<UpgradeFilter>("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);
  const [paymentSale, setPaymentSale] = useState<Sale | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const now = useNow();

  const salesQuery = useQuery({
    queryKey: ["sales", profile?.id, role],
    enabled: Boolean(profile?.id) && !treeLoading,
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase.from("sales").select("*");

      if (!isAdmin) {
        const visibleIds = members.map((member) => member.id);
        if (visibleIds.length === 0) return [];
        query = query.in("sold_by", visibleIds);
      }

      const { data, error } = await query
        .order("sale_date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Sale[];
    },
  });

  const leadsQuery = useQuery({
    queryKey: ["leads", "sale-options"],
    enabled: Boolean(profile?.id) && isAdmin,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sale: Sale) => {
      const supabase = createClient();
      const { error } = await supabase.from("sales").delete().eq("id", sale.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sale deleted");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    },
  });

  const profiles = useMemo(
    () => (members.length > 0 ? members : profile ? [profile] : []),
    [members, profile],
  );
  const profileMap = useMemo(
    () => new Map(profiles.map((item) => [item.id, item])),
    [profiles],
  );
  const sales = useMemo(() => salesQuery.data ?? [], [salesQuery.data]);

  const dateRange = useMemo(() => {
    if (datePreset === "custom") {
      return { from: customFrom || null, to: customTo || null };
    }
    if (!now) {
      return { from: null, to: null };
    }
    if (datePreset === "today") {
      const value = format(now, "yyyy-MM-dd");
      return { from: value, to: value };
    }
    if (datePreset === "week") {
      return {
        from: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        to: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    }
    if (datePreset === "month") {
      return {
        from: format(startOfMonth(now), "yyyy-MM-dd"),
        to: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    }
    return { from: null, to: null };
  }, [datePreset, customFrom, customTo, now]);

  const serviceOptions = useMemo(
    () =>
      Array.from(
        new Set(
          sales
            .map((sale) => sale.service_sold?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [sales],
  );

  const filteredSales = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sales.filter((sale) => {
      if (paymentFilter !== "all" && sale.payment_status !== paymentFilter) {
        return false;
      }
      if (isAdmin && sellerFilter !== "all" && sellerFilter !== "team") {
        const ids = new Set([
          sellerFilter,
          ...getFlatDownline(profiles, sellerFilter).map((member) => member.id),
        ]);
        if (!sale.sold_by || !ids.has(sale.sold_by)) return false;
      }
      if (
        serviceFilter !== "all" &&
        (sale.service_sold?.trim() ?? "") !== serviceFilter
      ) {
        return false;
      }
      if (upgradeFilter === "upgrade" && !sale.is_upgrade) return false;
      if (upgradeFilter === "new" && sale.is_upgrade) return false;
      if (dateRange.from && sale.sale_date < dateRange.from) return false;
      if (dateRange.to && sale.sale_date > dateRange.to) return false;
      if (!needle) return true;
      const seller = profileMap.get(sale.sold_by ?? "");
      return [
        sale.client_name,
        sale.service_sold,
        sale.notes,
        seller?.full_name,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle));
    });
  }, [
    sales,
    paymentFilter,
    sellerFilter,
    profiles,
    serviceFilter,
    upgradeFilter,
    dateRange,
    search,
    isAdmin,
    profileMap,
  ]);

  const totals = useMemo(
    () => ({
      total: filteredSales.reduce(
        (sum, sale) => sum + toNumber(sale.total_amount),
        0,
      ),
      received: filteredSales.reduce(
        (sum, sale) => sum + toNumber(sale.received_amount),
        0,
      ),
      remaining: filteredSales.reduce(
        (sum, sale) => sum + toNumber(sale.remaining_amount),
        0,
      ),
      clients: new Set(
        filteredSales.map((sale) => sale.client_name.trim().toLowerCase()),
      ).size,
    }),
    [filteredSales],
  );

  const detailSale = sales.find((sale) => sale.id === detailSaleId) ?? null;

  const exportSales = () => {
    const rows = filteredSales.map((sale) => ({
      client_name: sale.client_name,
      service_sold: sale.service_sold ?? "",
      sale_date: sale.sale_date,
      total_amount: sale.total_amount,
      received_amount: sale.received_amount,
      remaining_amount: sale.remaining_amount ?? 0,
      payment_status: sale.payment_status,
      sold_by:
        profileMap.get(sale.sold_by ?? "")?.full_name ??
        (sale.sold_by === profile?.id ? profile?.full_name : "") ??
        "",
      is_upgrade: sale.is_upgrade ? "Yes" : "No",
      notes: sale.notes ?? "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales");
    XLSX.writeFile(workbook, `sales-${todayISO()}.xlsx`);
  };

  if (roleLoading || treeLoading) {
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
        title="Sales"
        description={
          isAdmin
            ? "Revenue, collections and outstanding balances."
            : "Your closed deals and their payment status."
        }
        eyebrow="Revenue"
        actions={
          <>
            <Button variant="outline" onClick={exportSales}>
              <Download className="size-4" />
              Export
            </Button>
            {isAdmin ? (
              <Button
                onClick={() => {
                  setEditingSale(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                Record sale
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total sales"
          value={formatINR(totals.total)}
          hint={`${filteredSales.length} sales`}
          icon={BadgeIndianRupee}
          accent="blue"
        />
        <StatCard
          title="Total received"
          value={formatINR(totals.received)}
          hint="Collected against sales"
          icon={IndianRupee}
          accent="green"
        />
        <StatCard
          title="Total remaining"
          value={formatINR(totals.remaining)}
          hint="Outstanding balance"
          icon={Wallet}
          accent="orange"
        />
        <StatCard
          title="Number of clients"
          value={String(totals.clients)}
          hint="Unique clients"
          icon={Users}
          accent="teal"
        />
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search client, service or seller..."
                  className="pl-9"
                />
              </div>
              <Select
                value={datePreset}
                onValueChange={(value) => setDatePreset(value as DatePreset)}
              >
                <SelectTrigger className="w-full lg:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This week</SelectItem>
                  <SelectItem value="month">This month</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>
              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger className="w-full lg:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All services</SelectItem>
                  {serviceOptions.map((service) => (
                    <SelectItem key={service} value={service}>
                      {service}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={upgradeFilter}
                onValueChange={(value) =>
                  setUpgradeFilter(value as UpgradeFilter)
                }
              >
                <SelectTrigger className="w-full lg:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sale types</SelectItem>
                  <SelectItem value="upgrade">Upgrades only</SelectItem>
                  <SelectItem value="new">New business only</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={paymentFilter}
                onValueChange={(value) =>
                  setPaymentFilter(value as "all" | PaymentStatus)
                }
              >
                <SelectTrigger className="w-full lg:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All payments</SelectItem>
                  {PAYMENT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {PAYMENT_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin ? (
                <Select value={sellerFilter} onValueChange={setSellerFilter}>
                  <SelectTrigger className="w-full lg:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sellers</SelectItem>
                    <SelectItem value="team">My whole team</SelectItem>
                    {profiles.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
            {datePreset === "custom" ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="w-full sm:w-[170px]"
                  aria-label="From date"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="w-full sm:w-[170px]"
                  aria-label="To date"
                />
              </div>
            ) : null}
          </div>

          {salesQuery.error ? (
            <ErrorState
              message="Sales could not be loaded."
              onRetry={() => void salesQuery.refetch()}
            />
          ) : salesQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredSales.length === 0 ? (
            <EmptyState
              icon={IndianRupee}
              title={sales.length === 0 ? "No sales yet" : "No matching sales"}
              description={
                sales.length === 0
                  ? isAdmin
                    ? "Record the first sale to start tracking revenue."
                    : "Sales assigned to you will appear here."
                  : "Try a different payment status or search term."
              }
              action={
                isAdmin && sales.length === 0 ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingSale(null);
                      setDialogOpen(true);
                    }}
                  >
                    <Plus className="size-4" />
                    Record sale
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1180px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Service sold</TableHead>
                    <TableHead>Sale date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Upgrade</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => {
                    const seller =
                      profileMap.get(sale.sold_by ?? "") ??
                      (sale.sold_by === profile.id ? profile : undefined);
                    return (
                      <TableRow
                        key={sale.id}
                        className="cursor-pointer"
                        onClick={() => setDetailSaleId(sale.id)}
                      >
                        <TableCell className="max-w-[220px]">
                          <button
                            type="button"
                            className="truncate text-left font-medium hover:underline"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDetailSaleId(sale.id);
                            }}
                          >
                            {sale.client_name}
                          </button>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="truncate text-sm">
                            {sale.service_sold || "Not specified"}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatDate(sale.sale_date)}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatDate(sale.sale_date)}
                        </TableCell>
                        <TableCell className="text-sm font-medium whitespace-nowrap">
                          {formatINR(sale.total_amount)}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap text-brand-green">
                          {formatINR(sale.received_amount)}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap text-brand-orange">
                          {formatINR(sale.remaining_amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={sale.is_upgrade ? "outline" : "secondary"}
                          >
                            {sale.is_upgrade ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="size-7">
                              <AvatarFallback className="bg-brand-gradient text-[0.65rem] text-white">
                                {getInitials(seller?.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="max-w-[120px] truncate text-sm">
                                {seller?.full_name ?? "—"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {seller?.role ? ROLE_LABELS[seller.role] : ""}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={sale.payment_status} />
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Sale actions"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setDetailSaleId(sale.id)}
                              >
                                <Receipt className="size-4" />
                                View details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!isAdmin}
                                onClick={() => {
                                  setPaymentSale(sale);
                                  setPaymentOpen(true);
                                }}
                              >
                                <Wallet className="size-4" />
                                Payments
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!isAdmin}
                                onClick={() => {
                                  setEditingSale(sale);
                                  setDialogOpen(true);
                                }}
                              >
                                Edit sale
                              </DropdownMenuItem>
                              {isAdmin ? (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleteTarget(sale)}
                                >
                                  <Trash2 className="size-4" />
                                  Delete
                                </DropdownMenuItem>
                              ) : null}
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

      <SaleDetailSheet
        open={Boolean(detailSale)}
        onOpenChange={(next) => {
          if (!next) setDetailSaleId(null);
        }}
        sale={detailSale}
        sales={sales}
        profiles={profiles.length > 0 ? profiles : [profile]}
        currentUserId={profile.id}
        canManage={isAdmin}
        onSelectSale={setDetailSaleId}
      />

      {isAdmin ? (
        <>
          <SaleDialog
            key={`${dialogOpen ? (editingSale?.id ?? "new") : "closed"}`}
            open={dialogOpen}
            onOpenChange={(next) => {
              setDialogOpen(next);
              if (!next) setEditingSale(null);
            }}
            sale={editingSale}
            sales={sales}
            leads={leadsQuery.data ?? []}
            profiles={profiles.length > 0 ? profiles : [profile]}
            currentUserId={profile.id}
          />

          <PaymentDialog
            key={`${paymentOpen ? (paymentSale?.id ?? "none") : "closed"}`}
            open={paymentOpen}
            onOpenChange={(next) => {
              setPaymentOpen(next);
              if (!next) setPaymentSale(null);
            }}
            sale={paymentSale}
            currentUserId={profile.id}
          />

          <AlertDialog
            open={Boolean(deleteTarget)}
            onOpenChange={(open) => {
              if (!open) setDeleteTarget(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this sale?</AlertDialogTitle>
                <AlertDialogDescription>
                  &ldquo;{deleteTarget?.client_name}&rdquo; and its payment
                  history will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleteMutation.isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    if (deleteTarget) deleteMutation.mutate(deleteTarget);
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  );
}
