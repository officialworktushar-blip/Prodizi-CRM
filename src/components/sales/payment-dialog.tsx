"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Plus, Receipt, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatINR, toNumber } from "@/lib/utils";
import type { Payment, Sale } from "@/types/database";

const PAYMENT_MODES = ["Cash", "UPI", "Bank transfer", "Cheque", "Other"];

type PaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  currentUserId: string;
};

export function PaymentDialog({
  open,
  onOpenChange,
  sale,
  currentUserId,
}: PaymentDialogProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(format(new Date(), "yyyy-MM-dd"));
  const [mode, setMode] = useState("UPI");
  const [note, setNote] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);

  const saleQuery = useQuery({
    queryKey: ["sales", "detail", sale?.id],
    enabled: Boolean(sale?.id && open),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .eq("id", sale!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as Sale | null) ?? null;
    },
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments", sale?.id],
    enabled: Boolean(sale?.id && open),
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

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["payments"] });
    void queryClient.invalidateQueries({ queryKey: ["sales"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["salary"] });
  };

  const addMutation = useMutation({
    mutationFn: async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!sale) throw new Error("No sale selected");
      const supabase = createClient();
      const { error } = await supabase.from("payments").insert({
        sale_id: sale.id,
        amount: Number(amount),
        paid_on: paidOn,
        mode,
        note: note.trim() || null,
        added_by: currentUserId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      setAmount("");
      setNote("");
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Payment failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (payment: Payment) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("id", payment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment removed");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    },
  });

  const currentSale = saleQuery.data ?? sale;
  const remaining = Math.max(
    toNumber(currentSale?.remaining_amount),
    0,
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Payments</DialogTitle>
            <DialogDescription>
              {currentSale?.client_name} · {formatINR(currentSale?.total_amount)} total
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/30 p-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-sm font-semibold">
                {formatINR(currentSale?.total_amount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Received</p>
              <p className="text-sm font-semibold text-brand-green">
                {formatINR(currentSale?.received_amount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="text-sm font-semibold text-brand-orange">
                {formatINR(remaining)}
              </p>
            </div>
          </div>

          <form
            onSubmit={(event) => addMutation.mutate(event)}
            className="space-y-3 rounded-xl border p-3"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Plus className="size-4" />
              Record a payment
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="payment-amount">Amount (₹)</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  min="1"
                  max={remaining || undefined}
                  step="1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder={String(remaining)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payment-date">Paid on</Label>
                <Input
                  id="payment-date"
                  type="date"
                  value={paidOn}
                  onChange={(event) => setPaidOn(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mode</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payment-note">Note</Label>
                <Input
                  id="payment-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Reference or remark"
                />
              </div>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={
                addMutation.isPending ||
                remaining <= 0 ||
                !amount ||
                Number(amount) <= 0 ||
                Number(amount) > remaining
              }
            >
              {addMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Receipt className="size-4" />
              )}
              Add payment
            </Button>
          </form>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium">Payment history</p>
            {paymentsQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (paymentsQuery.data ?? []).length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No payments recorded"
                description="Add the first payment above."
                className="py-6"
              />
            ) : (
              (paymentsQuery.data ?? []).map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {formatINR(payment.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(payment.paid_on)}
                      {payment.mode ? ` · ${payment.mode}` : ""}
                      {payment.note ? ` · ${payment.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary">Received</Badge>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete payment"
                      onClick={() => setDeleteTarget(payment)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              The sale balance will be recalculated automatically.
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
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
