"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatINR } from "@/lib/utils";
import type { Incentive, SalaryMonthly } from "@/types/database";

type ManualIncentiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: SalaryMonthly;
  month: string;
  currentUserId: string;
};

export function ManualIncentiveDialog({
  open,
  onOpenChange,
  row,
  month,
  currentUserId,
}: ManualIncentiveDialogProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Incentive | null>(null);

  const incentivesQuery = useQuery({
    queryKey: ["incentives", "manual", row.user_id, month],
    enabled: Boolean(open && row.user_id),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("incentives")
        .select("*")
        .eq("user_id", row.user_id!)
        .eq("source", "manual")
        .eq("month", `${month}-01`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Incentive[];
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["incentives"] });
    void queryClient.invalidateQueries({ queryKey: ["salary"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["profiles"] });
  };

  const addMutation = useMutation({
    mutationFn: async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!row.user_id) throw new Error("Missing member");
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Enter a valid incentive amount");
      }
      const supabase = createClient();
      const { error } = await supabase.from("incentives").insert({
        user_id: row.user_id,
        source: "manual",
        amount: value,
        month: `${month}-01`,
        note: note.trim() || null,
        created_by: currentUserId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Manual incentive added");
      setAmount("");
      setNote("");
      invalidate();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Incentive could not be saved",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (incentive: Incentive) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("incentives")
        .delete()
        .eq("id", incentive.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Manual incentive removed");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Delete failed",
      );
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manual incentive</DialogTitle>
            <DialogDescription>
              {row.full_name} -{" "}
              {format(new Date(`${month}-01T00:00:00`), "MMMM yyyy")}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(event) => addMutation.mutate(event)}
            className="space-y-3 rounded-xl border p-3"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Plus className="size-4" />
              Add an incentive
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
              <div className="space-y-1.5">
                <Label htmlFor="manual-amount">Amount</Label>
                <Input
                  id="manual-amount"
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manual-note">Note</Label>
                <Textarea
                  id="manual-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={1}
                  placeholder="Reason for the incentive"
                  className="min-h-9 resize-none"
                />
              </div>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={addMutation.isPending || !amount}
            >
              {addMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Add incentive
            </Button>
          </form>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">This month</p>
              <p className="text-sm font-semibold">
                {formatINR(
                  (incentivesQuery.data ?? []).reduce(
                    (sum, item) => sum + Number(item.amount ?? 0),
                    0,
                  ),
                )}
              </p>
            </div>
            {incentivesQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : incentivesQuery.error ? (
              <p className="text-sm text-destructive">
                Manual incentives could not be loaded.
              </p>
            ) : (incentivesQuery.data ?? []).length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                No manual incentives for this month.
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
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete manual incentive"
                    onClick={() => setDeleteTarget(incentive)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
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
            <AlertDialogTitle>Remove this incentive?</AlertDialogTitle>
            <AlertDialogDescription>
              This month&apos;s payroll total will be recalculated.
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
