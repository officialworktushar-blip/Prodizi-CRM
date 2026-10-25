"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeIndianRupee,
  Download,
  IndianRupee,
  Plus,
  Search,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { PaymentDialog } from "@/components/sales/payment-dialog";
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
import { useRole } from "@/hooks/use-role";
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  ROLE_LABELS,
  type PaymentStatus,
} from "@/lib/constants";
import { isAdminRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import {
  formatDate,
  formatINR,
  getInitials,
  monthEndISO,
  monthStartISO,
  todayISO,
  toNumber,
} from "@/lib/utils";
import type { Lead, Profile, Sale } from "@/types/database";

export default function SalesPage() {
  const { profile, role, loading: roleLoading, error: roleError } = useRole();
  const isAdmin = isAdminRole(role);
  const queryClient = useQueryClient();
  const [paymentFilter, setPaymentFilter] = useState<"all" | PaymentStatus>(
    "all",
  );
  const [sellerFilter, setSellerFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [paymentSale, setPaymentSale] = useState<Sale | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);

  const salesQuery = useQuery({
    queryKey: ["sales", profile?.id, role],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase.from("sales").select("*");

      if (!isAdmin) {
        query = query.eq("sold_by", profile!.id);
      }

      const { data, error } = await query
        .order("sale_date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Sale[];
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["profiles", "sales-sellers"],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
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
    () => profilesQuery.data ?? [],
    [profilesQuery.data],
  );
  const profileMap = useMemo(
    () => new Map(profiles.map((item) => [item.id, item])),
    [profiles],
  );
  const sales = useMemo(() => salesQuery.data ?? [], [salesQuery.data]);

  const filteredSales = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sales.filter((sale) => {
      if (
        paymentFilter !== "all" &&
        sale.payment_status !== paymentFilter
      ) {
        return false;
      }
      if (
        isAdmin &&
        sellerFilter !== "all" &&
        sale.sold_by !== sellerFilter
      ) {
        return false;
      }
      if (!needle) return true;
      return [sale.client_name, sale.service_sold, sale.notes]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle));
    });
  }, [sales, paymentFilter, sellerFilter, search, isAdmin]);

  const totals = useMemo(() => {
    const monthStart = monthStartISO();
    const monthEnd = monthEndISO();
    return {
      total: sales.reduce((sum, sale) => sum + toNumber(sale.total_amount), 0),
      received: sales.reduce(
        (sum, sale) => sum + toNumber(sale.received_amount),
        0,
      ),
      pending: sales.reduce(
        (sum, sale) => sum + toNumber(sale.remaining_amount),
        0,
      ),
      thisMonth: sales
        .filter(
          (sale) =>
            sale.sale_date >= monthStart && sale.sale_date <= monthEnd,
        )
        .reduce((sum, sale) => sum + toNumber(sale.total_amount), 0),
    };
  }, [sales]);

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
          title="Total sales value"
          value={formatINR(totals.total)}
          hint={`${sales.length} sales`}
          icon={BadgeIndianRupee}
          accent="blue"
        />
        <StatCard
          title="Collected"
          value={formatINR(totals.received)}
          hint="Across all sales"
          icon={IndianRupee}
          accent="green"
        />
        <StatCard
          title="Outstanding"
          value={formatINR(totals.pending)}
          hint="Yet to be collected"
          icon={Wallet}
          accent="orange"
        />
        <StatCard
          title="This month"
          value={formatINR(totals.thisMonth)}
          hint="New sales value"
          icon={IndianRupee}
          accent="teal"
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
                placeholder="Search client or service..."
                className="pl-9"
              />
            </div>
            <Select
              value={paymentFilter}
              onValueChange={(value) =>
                setPaymentFilter(value as "all" | PaymentStatus)
              }
            >
              <SelectTrigger className="w-full sm:w-[160px]">
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
                <SelectTrigger className="w-full sm:w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sellers</SelectItem>
                  {profiles.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Table className="min-w-[920px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Sale date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Remaining</TableHead>
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
                      <TableRow key={sale.id}>
                        <TableCell className="max-w-[220px]">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium">
                              {sale.client_name}
                            </p>
                            {sale.is_upgrade ? (
                              <Badge variant="outline">Upgrade</Badge>
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {sale.service_sold || "—"}
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDate(sale.sale_date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm font-medium">
                          {formatINR(sale.total_amount)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-brand-green">
                          {formatINR(sale.received_amount)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-brand-orange">
                          {formatINR(sale.remaining_amount)}
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
                                {seller?.role
                                  ? ROLE_LABELS[seller.role]
                                  : ""}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={sale.payment_status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Sale actions"
                              >
                                <span className="text-lg leading-none">···</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
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
