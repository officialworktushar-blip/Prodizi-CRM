"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  IndianRupee,
  Receipt,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PaymentDialog } from "@/components/sales/payment-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ROLE_LABELS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatINR, getInitials } from "@/lib/utils";
import type { Payment, Profile, Sale } from "@/types/database";

type SaleDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  sales: Sale[];
  profiles: Profile[];
  currentUserId: string;
  canManage: boolean;
  onSelectSale: (saleId: string) => void;
};

export function SaleDetailSheet({
  open,
  onOpenChange,
  sale,
  sales,
  profiles,
  currentUserId,
  canManage,
  onSelectSale,
}: SaleDetailSheetProps) {
  const [paymentOpen, setPaymentOpen] = useState(false);

  const paymentsQuery = useQuery({
    queryKey: ["payments", sale?.id],
    enabled: Boolean(open && sale?.id),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("sale_id", sale!.id)
        .order("paid_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
  });

  const profileMap = useMemo(
    () => new Map(profiles.map((item) => [item.id, item])),
    [profiles],
  );

  const chain = useMemo(() => {
    if (!sale) return [];
    const byId = new Map(sales.map((item) => [item.id, item]));
    const seen = new Set<string>();
    let root = sale;

    while (
      root.upgrade_from_sale_id &&
      byId.has(root.upgrade_from_sale_id) &&
      !seen.has(root.upgrade_from_sale_id)
    ) {
      seen.add(root.id);
      root = byId.get(root.upgrade_from_sale_id)!;
    }

    const children = new Map<string, Sale[]>();
    sales.forEach((item) => {
      if (!item.upgrade_from_sale_id) return;
      const list = children.get(item.upgrade_from_sale_id) ?? [];
      list.push(item);
      children.set(item.upgrade_from_sale_id, list);
    });

    const ordered: Sale[] = [];
    const visited = new Set<string>();
    const visit = (item: Sale) => {
      if (visited.has(item.id)) return;
      visited.add(item.id);
      ordered.push(item);
      (children.get(item.id) ?? [])
        .slice()
        .sort((a, b) => a.sale_date.localeCompare(b.sale_date))
        .forEach(visit);
    };
    visit(root);

    return ordered;
  }, [sale, sales]);

  const seller = sale
    ? profileMap.get(sale.sold_by ?? "") ??
      (sale.sold_by === currentUserId
        ? profiles.find((item) => item.id === currentUserId)
        : undefined)
    : undefined;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {!sale ? (
            <div className="p-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="mt-4 h-64 w-full" />
            </div>
          ) : (
            <>
              <SheetHeader className="border-b pr-12">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SheetTitle>{sale.client_name}</SheetTitle>
                    <SheetDescription>
                      {sale.service_sold || "Product / service not specified"}
                    </SheetDescription>
                  </div>
                  <StatusBadge status={sale.payment_status} />
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Badge variant="outline">
                    {sale.is_upgrade ? "Upgrade" : "New business"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(sale.sale_date)}
                  </span>
                  <Button asChild variant="link" size="sm" className="h-auto p-0">
                    <Link href={`/sales/${sale.id}`}>
                      Open full page
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </SheetHeader>

              <div className="space-y-5 p-4">
                <div className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/30 p-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-sm font-semibold">
                      {formatINR(sale.total_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Received</p>
                    <p className="text-sm font-semibold text-brand-green">
                      {formatINR(sale.received_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Remaining</p>
                    <p className="text-sm font-semibold text-brand-orange">
                      {formatINR(sale.remaining_amount)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">Sold by</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-brand-gradient text-xs text-white">
                          {getInitials(seller?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {seller?.full_name ?? "Unknown member"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {seller?.designation ??
                            (seller?.role
                              ? ROLE_LABELS[seller.role]
                              : "Member")}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">Lead</p>
                    {sale.lead_id ? (
                      <Link
                        href={`/leads/${sale.lead_id}`}
                        className="mt-2 inline-flex text-sm font-medium text-primary hover:underline"
                      >
                        View linked lead
                      </Link>
                    ) : (
                      <p className="mt-2 text-sm">No linked lead</p>
                    )}
                  </div>
                </div>

                {sale.notes ? (
                  <div className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {sale.notes}
                    </p>
                  </div>
                ) : null}

                <Separator />

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-sm font-medium">
                      Payment history
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {formatINR(sale.received_amount)} collected across{" "}
                      {paymentsQuery.data?.length ?? 0} payments
                    </p>
                  </div>
                  {canManage ? (
                    <Button size="sm" onClick={() => setPaymentOpen(true)}>
                      <Wallet className="size-4" />
                      Add payment
                    </Button>
                  ) : null}
                </div>

                {paymentsQuery.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : paymentsQuery.error ? (
                  <p className="text-sm text-destructive">
                    Payment history could not be loaded.
                  </p>
                ) : (paymentsQuery.data ?? []).length === 0 ? (
                  <EmptyState
                    icon={Receipt}
                    title="No payments yet"
                    description="Payments recorded against this sale will appear here."
                    className="py-6"
                  />
                ) : (
                  <div className="space-y-2">
                    {(paymentsQuery.data ?? []).map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {formatINR(payment.amount)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatDate(payment.paid_on)}
                            {payment.mode ? ` - ${payment.mode}` : ""}
                            {payment.note ? ` - ${payment.note}` : ""}
                          </p>
                        </div>
                        <Badge variant="secondary">Received</Badge>
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                <div>
                  <h3 className="font-heading text-sm font-medium">
                    Upgrade chain
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    The original sale and every upgrade linked to it.
                  </p>
                  {chain.length <= 1 && !sale.is_upgrade ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      This is the original sale with no linked upgrades.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {chain.map((item, index) => {
                        const isCurrent = item.id === sale.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onSelectSale(item.id)}
                            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 ${
                              isCurrent
                                ? "border-primary/40 bg-primary/5"
                                : "bg-card"
                            }`}
                          >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {item.service_sold || "Sale"}
                                {item.is_upgrade ? " (upgrade)" : ""}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {formatDate(item.sale_date)}
                              </span>
                            </span>
                            <span className="text-sm font-semibold">
                              {formatINR(item.total_amount)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border p-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IndianRupee className="size-3.5" />
                      Sale value
                    </div>
                    <p className="mt-1 font-semibold">
                      {formatINR(sale.total_amount)}
                    </p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Receipt className="size-3.5" />
                      Payments recorded
                    </div>
                    <p className="mt-1 font-semibold">
                      {paymentsQuery.data?.length ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {canManage && sale && paymentOpen ? (
        <PaymentDialog
          key={`${sale.id}-${paymentOpen}`}
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          sale={sale}
          currentUserId={currentUserId}
        />
      ) : null}
    </>
  );
}
