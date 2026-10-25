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
import type { SalaryConfig, SalaryMonthly } from "@/types/database";

type SalaryConfigDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: SalaryMonthly;
  config: SalaryConfig | null;
};

export function SalaryConfigDialog({
  open,
  onOpenChange,
  row,
  config,
}: SalaryConfigDialogProps) {
  const queryClient = useQueryClient();
  const [baseSalary, setBaseSalary] = useState(
    String(config?.base_salary ?? row.base_salary ?? 0),
  );
  const [salesPercent, setSalesPercent] = useState(
    String(config?.sales_incentive_percent ?? 0),
  );

  const mutation = useMutation({
    mutationFn: async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!row.user_id) throw new Error("Missing member");
      const supabase = createClient();
      const { error } = await supabase.from("salary_config").upsert({
        user_id: row.user_id,
        base_salary: Number(baseSalary) || 0,
        sales_incentive_percent: Number(salesPercent) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Salary configuration saved");
      void queryClient.invalidateQueries({ queryKey: ["salary"] });
      void queryClient.invalidateQueries({ queryKey: ["profiles"] });
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
          <DialogTitle>Salary configuration</DialogTitle>
          <DialogDescription>{row.full_name}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => mutation.mutate(event)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="config-base">Base salary (₹/month)</Label>
            <Input
              id="config-base"
              type="number"
              min="0"
              step="1"
              value={baseSalary}
              onChange={(event) => setBaseSalary(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="config-percent">Sales incentive (%)</Label>
            <Input
              id="config-percent"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={salesPercent}
              onChange={(event) => setSalesPercent(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Applied to new sales after saving.
            </p>
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
              Save configuration
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
