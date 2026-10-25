"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

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
import { formatINR } from "@/lib/utils";
import type { Lead } from "@/types/database";

type LeadConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  pending?: boolean;
  onConfirm: (amount: number) => void;
};

export function LeadConfirmDialog({
  open,
  onOpenChange,
  lead,
  pending = false,
  onConfirm,
}: LeadConfirmDialogProps) {
  const [amount, setAmount] = useState(String(lead?.expected_value ?? ""));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm this deal</DialogTitle>
          <DialogDescription>
            Enter the total deal amount for {lead?.client_name ?? "this lead"}.
            The lead will be marked confirmed and a sale will be created
            automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirmed-amount">Total deal amount (₹)</Label>
          <Input
            id="confirmed-amount"
            type="number"
            min="0"
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="50000"
            autoFocus
          />
          {lead?.expected_value ? (
            <p className="text-xs text-muted-foreground">
              Current expected value: {formatINR(lead.expected_value)}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(Number(amount))}
            disabled={pending || !amount || Number(amount) <= 0}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Confirm deal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
