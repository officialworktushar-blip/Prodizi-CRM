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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadStatus,
} from "@/lib/constants";
import type { Lead, Task } from "@/types/database";

type LeadStatusDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  lead: Lead | undefined;
  pending: boolean;
  onConfirm: (status: LeadStatus) => void;
};

export function LeadStatusDialog({
  open,
  onOpenChange,
  task,
  lead,
  pending,
  onConfirm,
}: LeadStatusDialogProps) {
  const [leadStatus, setLeadStatus] = useState<LeadStatus>(
    (lead?.status as LeadStatus | undefined) ?? "ongoing",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark lead as?</DialogTitle>
          <DialogDescription>
            &ldquo;{task?.title}&rdquo; is linked to{" "}
            {lead?.client_name ?? "a lead"}. Choose the lead status to apply
            when you complete this task.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Lead status</Label>
          <Select
            value={leadStatus}
            onValueChange={(value) => setLeadStatus(value as LeadStatus)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {LEAD_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            onClick={() => onConfirm(leadStatus)}
            disabled={pending}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Complete task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
