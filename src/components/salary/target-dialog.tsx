"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { createClient } from "@/lib/supabase/client";
import type { SalaryMonthly, Target } from "@/types/database";

type TargetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: SalaryMonthly;
  target: Target | null;
  month: string;
};

export function TargetDialog({
  open,
  onOpenChange,
  row,
  target,
  month,
}: TargetDialogProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(
    String(target?.target_amount ?? row.target_amount ?? 0),
  );

  const mutation = useMutation({
    mutationFn: async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!row.user_id) throw new Error("Missing member");
      const supabase = createClient();
      const payload = {
        user_id: row.user_id,
        month: `${month}-01`,
        target_amount: Number(amount) || 0,
      };

      if (target) {
        const { error } = await supabase
          .from("targets")
          .update(payload)
          .eq("id", target.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("targets").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Target saved");
      void queryClient.invalidateQueries({ queryKey: ["salary"] });
      void queryClient.invalidateQueries({ queryKey: ["targets"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Save failed");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Monthly target</DialogTitle>
          <DialogDescription>
            {row.full_name} · {month}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => mutation.mutate(event)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="target-amount">Revenue target (₹)</Label>
            <Input
              id="target-amount"
              type="number"
              min="0"
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
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
              Save target
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
