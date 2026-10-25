"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNow } from "@/hooks/use-now";
import { createClient } from "@/lib/supabase/client";
import type { SalaryMonthly, SalaryPayout } from "@/types/database";

type PayoutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: SalaryMonthly;
  payout: SalaryPayout | null;
  month: string;
};

export function PayoutDialog({
  open,
  onOpenChange,
  row,
  payout,
  month,
}: PayoutDialogProps) {
  const queryClient = useQueryClient();
  const now = useNow();
  const [bonus, setBonus] = useState(String(payout?.bonus ?? row.bonus ?? 0));
  const [deduction, setDeduction] = useState(
    String(payout?.deduction ?? row.deduction ?? 0),
  );
  const [status, setStatus] = useState(
    (payout?.status ?? row.payout_status) === "paid" ? "paid" : "pending",
  );
  const [paidOnOverride, setPaidOn] = useState<string | null>(
    payout?.paid_on ?? null,
  );
  const paidOn =
    paidOnOverride ?? (open && now ? format(now, "yyyy-MM-dd") : "");

  const mutation = useMutation({
    mutationFn: async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!row.user_id) throw new Error("Missing member");
      const supabase = createClient();
      const payload = {
        user_id: row.user_id,
        month: `${month}-01`,
        bonus: Number(bonus) || 0,
        deduction: Number(deduction) || 0,
        status,
        paid_on: status === "paid" ? paidOn : null,
      };

      if (payout) {
        const { error } = await supabase
          .from("salary_payouts")
          .update(payload)
          .eq("id", payout.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("salary_payouts")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Payroll updated");
      void queryClient.invalidateQueries({ queryKey: ["salary"] });
      void queryClient.invalidateQueries({ queryKey: ["salary-payouts"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Update failed");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust payroll</DialogTitle>
          <DialogDescription>
            {row.full_name} · {month}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => mutation.mutate(event)}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payout-bonus">Bonus (₹)</Label>
              <Input
                id="payout-bonus"
                type="number"
                min="0"
                step="1"
                value={bonus}
                onChange={(event) => setBonus(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payout-deduction">Deduction (₹)</Label>
              <Input
                id="payout-deduction"
                type="number"
                min="0"
                step="1"
                value={deduction}
                onChange={(event) => setDeduction(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payout-date">Paid on</Label>
              <Input
                id="payout-date"
                type="date"
                value={paidOn}
                onChange={(event) => setPaidOn(event.target.value)}
                disabled={status !== "paid"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Save payroll
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
