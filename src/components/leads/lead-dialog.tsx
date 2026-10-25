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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  LEAD_FREQUENCIES,
  LEAD_FREQUENCY_LABELS,
  LEAD_KINDS,
  LEAD_KIND_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadFrequency,
  type LeadKind,
  type LeadStatus,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Lead, Profile } from "@/types/database";

type LeadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  profiles: Profile[];
  currentUserId: string;
  canAssign: boolean;
};

export function LeadDialog({
  open,
  onOpenChange,
  lead,
  profiles,
  currentUserId,
  canAssign,
}: LeadDialogProps) {
  const queryClient = useQueryClient();
  const [clientName, setClientName] = useState(lead?.client_name ?? "");
  const [company, setCompany] = useState(lead?.company ?? "");
  const [phone, setPhone] = useState(lead?.phone ?? "");
  const [email, setEmail] = useState(lead?.email ?? "");
  const [kind, setKind] = useState<LeadKind>(
    (lead?.kind as LeadKind | undefined) ?? "product",
  );
  const [itemName, setItemName] = useState(lead?.item_name ?? "");
  const [frequency, setFrequency] = useState<LeadFrequency>(
    (lead?.frequency as LeadFrequency | undefined) ?? "daily",
  );
  const [status, setStatus] = useState<LeadStatus>(
    (lead?.status as LeadStatus | undefined) ?? "upcoming",
  );
  const [source, setSource] = useState(lead?.source ?? "");
  const [expectedValue, setExpectedValue] = useState(
    String(lead?.expected_value ?? ""),
  );
  const [assignedTo, setAssignedTo] = useState(
    lead?.assigned_to ?? currentUserId,
  );
  const [nextFollowUp, setNextFollowUp] = useState(
    lead?.next_follow_up?.slice(0, 10) ?? "",
  );
  const [notes, setNotes] = useState(lead?.notes ?? "");
  const missingConfirmedAmount =
    status === "confirmed" && (!expectedValue || Number(expectedValue) <= 0);

  const mutation = useMutation({
    mutationFn: async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const supabase = createClient();
      const assignmentChanged = lead
        ? lead.assigned_to !== assignedTo
        : Boolean(assignedTo);
      const assignmentMeta = assignmentChanged
        ? {
            assigned_by: currentUserId,
            assigned_at: new Date().toISOString(),
          }
        : {};
      const payload = {
        client_name: clientName.trim(),
        company: company.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        kind,
        item_name: itemName.trim() || null,
        frequency,
        status,
        source: source.trim() || null,
        expected_value: expectedValue ? Number(expectedValue) : null,
        assigned_to: assignedTo,
        ...assignmentMeta,
        next_follow_up: nextFollowUp || null,
        notes: notes.trim() || null,
      };

      if (lead) {
        const { error } = await supabase
          .from("leads")
          .update(payload)
          .eq("id", lead.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("leads").insert({
        ...payload,
        created_by: currentUserId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lead ? "Lead updated" : "Lead created");
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Lead save failed");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{lead ? "Edit lead" : "New lead"}</DialogTitle>
          <DialogDescription>
            Track a client opportunity and assign an owner.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => mutation.mutate(event)}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lead-client">Client name</Label>
              <Input
                id="lead-client"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Client or contact name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-company">Company</Label>
              <Input
                id="lead-company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="Company name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input
                id="lead-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="client@company.com"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Kind</Label>
              <Select
                value={kind}
                onValueChange={(value) => setKind(value as LeadKind)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_KINDS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {LEAD_KIND_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(value) => setFrequency(value as LeadFrequency)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_FREQUENCIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {LEAD_FREQUENCY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as LeadStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {LEAD_STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lead-item">Product / service</Label>
              <Input
                id="lead-item"
                value={itemName}
                onChange={(event) => setItemName(event.target.value)}
                placeholder="Website redesign"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-value">
                {status === "confirmed"
                  ? "Total deal amount (₹)"
                  : "Expected value (₹)"}
              </Label>
              <Input
                id="lead-value"
                type="number"
                min="0"
                step="1"
                value={expectedValue}
                onChange={(event) => setExpectedValue(event.target.value)}
                placeholder="50000"
                aria-invalid={missingConfirmedAmount}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-source">Source</Label>
              <Input
                id="lead-source"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="Referral, Instagram, cold call..."
              />
            </div>
            <div className="space-y-2">
              <Label>Assigned to</Label>
              <Select
                value={assignedTo}
                onValueChange={setAssignedTo}
                disabled={!canAssign}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-follow-up">Next follow-up</Label>
              <Input
                id="lead-follow-up"
                type="date"
                value={nextFollowUp}
                onChange={(event) => setNextFollowUp(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead-notes">Notes</Label>
            <Textarea
              id="lead-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Requirements, conversation history, next steps..."
              rows={3}
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
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                !clientName.trim() ||
                missingConfirmedAmount
              }
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {lead ? "Save changes" : "Create lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
