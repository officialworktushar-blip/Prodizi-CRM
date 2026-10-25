"use client";

import { format } from "date-fns";
import { Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { formatDate, formatINR, toNumber } from "@/lib/utils";
import type { SalaryMonthly, SalaryPayout } from "@/types/database";

type SalarySlipDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: SalaryMonthly;
  payout: SalaryPayout | null;
  month: string;
};

export function SalarySlipDialog({
  open,
  onOpenChange,
  row,
  payout,
  month,
}: SalarySlipDialogProps) {
  const totalIncentives =
    toNumber(row.task_incentive) +
    toNumber(row.sales_incentive) +
    toNumber(row.manual_incentive);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="no-print">
          <DialogTitle>Salary slip</DialogTitle>
          <DialogDescription>
            Preview the slip, then print or save it as PDF.
          </DialogDescription>
        </DialogHeader>

        <div
          id="salary-slip"
          className="space-y-5 rounded-xl border bg-white p-6 text-foreground"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-brand-blue">Prodigi</p>
              <p className="text-xs text-muted-foreground">
                Salary slip for{" "}
                {format(new Date(`${month}-01T00:00:00`), "MMMM yyyy")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{row.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {row.role ? ROLE_LABELS[row.role as Role] : "Member"}
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Payroll month</p>
              <p className="mt-1 font-medium">
                {format(new Date(`${month}-01T00:00:00`), "MMM yyyy")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payout status</p>
              <p className="mt-1 font-medium capitalize">
                {row.payout_status ?? "pending"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Paid on</p>
              <p className="mt-1 font-medium">
                {payout?.paid_on
                  ? formatDate(payout.paid_on)
                  : row.payout_status === "paid"
                    ? "Recorded"
                    : "Not paid"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Target</p>
              <p className="mt-1 font-medium">
                {row.target_amount
                  ? `${Math.round(toNumber(row.target_pct))}%`
                  : "Not set"}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-[1fr_auto] gap-3 bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
              <span>Earnings</span>
              <span>Amount</span>
            </div>
            <div className="divide-y">
              <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-2 text-sm">
                <span>Base salary</span>
                <span>{formatINR(row.base_salary)}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-2 text-sm">
                <span>Task incentives</span>
                <span>{formatINR(row.task_incentive)}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-2 text-sm">
                <span>Sales incentives</span>
                <span>{formatINR(row.sales_incentive)}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-2 text-sm">
                <span>Manual incentives</span>
                <span>{formatINR(row.manual_incentive)}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-2 text-sm">
                <span>Bonus</span>
                <span className="text-brand-green">
                  +{formatINR(row.bonus)}
                </span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-2 text-sm">
                <span>Deduction</span>
                <span className="text-brand-red">
                  -{formatINR(row.deduction)}
                </span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3 bg-muted/30 px-4 py-3 text-sm font-semibold">
                <span>Net salary</span>
                <span>{formatINR(row.total_salary)}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Incentives total</p>
              <p className="mt-1 font-medium">{formatINR(totalIncentives)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Target achievement
                </p>
                <Badge variant="outline" className="capitalize">
                  {row.target_stage ?? "No target"}
                </Badge>
              </div>
              <p className="mt-1 font-medium">
                {formatINR(row.achieved)} of {formatINR(row.target_amount)}
              </p>
            </div>
          </div>

          <Separator />

          <p className="text-[0.65rem] text-muted-foreground">
            This is a computer-generated salary slip from Prodigi CRM. Please
            contact the owner for any payroll discrepancies.
          </p>
        </div>

        <div className="no-print flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-4" />
            Print / Save PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
