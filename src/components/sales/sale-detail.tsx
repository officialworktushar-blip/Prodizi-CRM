"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  IndianRupee,
  Receipt,
  UserRound,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PaymentDialog } from "@/components/sales/payment-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { ROLE_LABELS } from "@/lib/constants";
import { isAdminRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import {
  formatDate,
  formatINR,
  getInitials,
  toNumber,
} from "@/lib/utils";
import type { Incentive, Payment, Profile, Sale } from "@/types/database";

export function SaleDetail({ saleId }: { saleId: string }) {
  const { profile, role, loading: roleLoading } = useRole();
  const isAdmin = isAdminRole(role);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const saleQuery = useQuery({
    queryKey: ["sales", "detail", saleId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .eq("id", saleId)
        .maybeSingle();
      if (error) throw error;
      return (data as Sale | null) ?? null;
    },
  });

  const relatedQuery = useQuery({
    queryKey: ["sales", "related", saleId],
    queryFn: async () => {
      const supabase = createClient();
      const [payments, incentives, profiles] = await Promise.all([
        supabase
          .from("payments")
          .select("*")
          .eq("sale_id", saleId)
          .order("paid_on", { ascending: false }),
        supabase.from("incentives").select("*").eq("sale_id", saleId),
        supabase.from("profiles").select("*").order("full_name"),
      ]);
      const error =
        payments.error ?? incentives.error ?? profiles.error;
      if (error) throw error;
      return {
        payments: (payments.data ?? []) as Payment[],
        incentives: (incentives.data ?? []) as Incentive[],
        profiles: (profiles.data ?? []) as Profile[],
      };
    },
  });

  if (roleLoading || saleQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (saleQuery.error) {
    return (
      <ErrorState
        message="This sale could not be loaded."
        onRetry={() => void saleQuery.refetch()}
      />
    );
  }

  if (!saleQuery.data) {
    return (
      <EmptyState
        icon={IndianRupee}
        title="Sale not found"
        description="It may have been deleted, or you may not have access."
        action={
          <Button asChild variant="outline">
            <Link href="/sales">Back to sales</Link>
          </Button>
        }
      />
    );
  }

  const sale = saleQuery.data;
  const payments = relatedQuery.data?.payments ?? [];
  const incentives = relatedQuery.data?.incentives ?? [];
  const profiles = relatedQuery.data?.profiles ?? [];
  const profileMap = new Map(profiles.map((item) => [item.id, item]));
  const seller =
    profileMap.get(sale.sold_by ?? "") ??
    (sale.sold_by === profile?.id ? profile : undefined);

  return (
    <div className="space-y-6">
      <PageHeader
        title={sale.client_name}
        description={sale.service_sold ?? "Sale details and payments"}
        eyebrow="Sale"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/sales">
                <ArrowLeft className="size-4" />
                Back
              </Link>
            </Button>
            {isAdmin ? (
              <Button onClick={() => setPaymentOpen(true)}>
                <Wallet className="size-4" />
                Manage payments
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Sale value"
          value={formatINR(sale.total_amount)}
          hint={formatDate(sale.sale_date)}
          icon={IndianRupee}
          accent="blue"
        />
        <StatCard
          title="Received"
          value={formatINR(sale.received_amount)}
          hint={`${payments.length} payments`}
          icon={Receipt}
          accent="green"
        />
        <StatCard
          title="Remaining"
          value={formatINR(sale.remaining_amount)}
          hint={
            sale.payment_status === "paid" ? "Fully settled" : "Outstanding"
          }
          icon={Wallet}
          accent="orange"
        />
        <StatCard
          title="Incentives"
          value={formatINR(
            incentives.reduce((sum, item) => sum + toNumber(item.amount), 0),
          )}
          hint={`${incentives.length} entries`}
          icon={UserRound}
          accent="teal"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Payment history</CardTitle>
            <CardDescription>
              Every payment recorded against this sale.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No payments yet"
                description={
                  isAdmin
                    ? "Use Manage payments to record the first payment."
                    : "No payments have been recorded."
                }
                className="border-0 bg-transparent py-8"
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(payment.paid_on)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatINR(payment.amount)}
                        </TableCell>
                        <TableCell>{payment.mode ?? "—"}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-muted-foreground">
                          {payment.note ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sale details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={sale.payment_status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sale date</span>
                <span>{formatDate(sale.sale_date)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Type</span>
                {sale.is_upgrade ? (
                  <Badge variant="outline">Upgrade</Badge>
                ) : (
                  <span>New business</span>
                )}
              </div>
              {sale.lead_id ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Lead</span>
                  <Link
                    href={`/leads/${sale.lead_id}`}
                    className="text-primary hover:underline"
                  >
                    View lead
                  </Link>
                </div>
              ) : null}
              {sale.notes ? (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap">{sale.notes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sold by</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarFallback className="bg-brand-gradient text-sm font-semibold text-white">
                    {getInitials(seller?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{seller?.full_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {seller?.designation ??
                      (seller?.role ? ROLE_LABELS[seller.role] : "")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Incentives</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {incentives.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No incentives linked to this sale.
                </p>
              ) : (
                incentives.map((incentive) => (
                  <div
                    key={incentive.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {formatINR(incentive.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {profileMap.get(incentive.user_id)?.full_name ??
                          "Member"}{" "}
                        · {incentive.source}
                      </p>
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {incentive.month}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {isAdmin && paymentOpen ? (
        <PaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          sale={sale}
          currentUserId={profile?.id ?? ""}
        />
      ) : null}
    </div>
  );
}
