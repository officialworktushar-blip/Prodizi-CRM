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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useNow } from "@/hooks/use-now";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatINR, toNumber } from "@/lib/utils";
import type { Lead, Profile, Sale } from "@/types/database";

type SaleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale?: Sale | null;
  sales: Sale[];
  leads: Lead[];
  profiles: Profile[];
  currentUserId: string;
};

export function SaleDialog({
  open,
  onOpenChange,
  sale,
  sales,
  leads,
  profiles,
  currentUserId,
}: SaleDialogProps) {
  const queryClient = useQueryClient();
  const now = useNow();
  const [leadId, setLeadId] = useState(sale?.lead_id ?? "none");
  const [clientName, setClientName] = useState(sale?.client_name ?? "");
  const [serviceSold, setServiceSold] = useState(sale?.service_sold ?? "");
  const [saleDateOverride, setSaleDate] = useState<string | null>(
    sale?.sale_date ?? null,
  );
  const saleDate =
    saleDateOverride ?? (open && now ? format(now, "yyyy-MM-dd") : "");
  const [totalAmount, setTotalAmount] = useState(
    String(sale?.total_amount ?? ""),
  );
  const [initialPaid, setInitialPaid] = useState("0");
  const [soldBy, setSoldBy] = useState(sale?.sold_by ?? currentUserId);
  const [isUpgrade, setIsUpgrade] = useState(sale?.is_upgrade ?? false);
  const [upgradeFromSaleId, setUpgradeFromSaleId] = useState(
    sale?.upgrade_from_sale_id ?? "none",
  );
  const [notes, setNotes] = useState(sale?.notes ?? "");

  const selectLead = (value: string) => {
    setLeadId(value);
    const lead = leads.find((item) => item.id === value);
    if (!lead) return;
    setClientName(lead.client_name);
    setServiceSold(lead.item_name ?? "");
    if (lead.expected_value) setTotalAmount(String(lead.expected_value));
  };

  const selectUpgradeParent = (value: string) => {
    setUpgradeFromSaleId(value);
    const parent = sales.find((item) => item.id === value);
    if (!parent) return;
    if (!clientName.trim()) setClientName(parent.client_name);
    if (!serviceSold.trim()) setServiceSold(parent.service_sold ?? "");
  };

  const upgradeCandidates = sales.filter((item) => item.id !== sale?.id);

  const mutation = useMutation({
    mutationFn: async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const supabase = createClient();
      const total = Number(totalAmount);
      const paid = Number(initialPaid) || 0;

      if (!clientName.trim()) throw new Error("Client name is required");
      if (!Number.isFinite(total) || total <= 0) {
        throw new Error("Enter a valid sale amount");
      }
      if (isUpgrade && upgradeFromSaleId === "none") {
        throw new Error("Select the sale this upgrade belongs to");
      }

      if (sale) {
        const received = toNumber(sale.received_amount);
        if (total < received) {
          throw new Error("Total cannot be less than amount already received");
        }
        const remaining = Math.max(total - received, 0);
        const { error } = await supabase
          .from("sales")
          .update({
            lead_id: leadId === "none" ? null : leadId,
            client_name: clientName.trim(),
            service_sold: serviceSold.trim() || null,
            sale_date: saleDate,
            total_amount: total,
            payment_status:
              remaining <= 0 ? "paid" : received > 0 ? "partial" : "pending",
            sold_by: soldBy,
            is_upgrade: isUpgrade,
            upgrade_from_sale_id:
              isUpgrade && upgradeFromSaleId !== "none"
                ? upgradeFromSaleId
                : null,
            notes: notes.trim() || null,
          })
          .eq("id", sale.id);
        if (error) throw error;
        return;
      }

      const { data: created, error } = await supabase
        .from("sales")
        .insert({
          lead_id: leadId === "none" ? null : leadId,
          client_name: clientName.trim(),
          service_sold: serviceSold.trim() || null,
          sale_date: saleDate,
          total_amount: total,
          received_amount: 0,
          payment_status: "pending",
          sold_by: soldBy,
          is_upgrade: isUpgrade,
          upgrade_from_sale_id:
            isUpgrade && upgradeFromSaleId !== "none"
              ? upgradeFromSaleId
              : null,
          notes: notes.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (paid > 0) {
        const { error: paymentError } = await supabase.from("payments").insert({
          sale_id: created.id,
          amount: Math.min(paid, total),
          paid_on: saleDate,
          mode: "initial",
          note: "Initial payment",
          added_by: currentUserId,
        });
        if (paymentError) throw paymentError;
      }
    },
    onSuccess: () => {
      toast.success(sale ? "Sale updated" : "Sale recorded");
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["salary"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Sale save failed");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{sale ? "Edit sale" : "Record a sale"}</DialogTitle>
          <DialogDescription>
            Sales incentives are calculated automatically from the seller&apos;s
            salary configuration.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => mutation.mutate(event)}
          className="space-y-4"
        >
          {!sale ? (
            <div className="space-y-2">
              <Label>Link a lead</Label>
              <Select value={leadId} onValueChange={selectLead}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Optional lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked lead</SelectItem>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.client_name}
                      {lead.company ? ` · ${lead.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sale-client">Client name</Label>
              <Input
                id="sale-client"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-service">Product / service sold</Label>
              <Input
                id="sale-service"
                value={serviceSold}
                onChange={(event) => setServiceSold(event.target.value)}
                placeholder="Website redesign"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-date">Sale date</Label>
              <Input
                id="sale-date"
                type="date"
                value={saleDate}
                onChange={(event) => setSaleDate(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-total">Total amount (₹)</Label>
              <Input
                id="sale-total"
                type="number"
                min={sale?.received_amount ?? 0}
                step="1"
                value={totalAmount}
                onChange={(event) => setTotalAmount(event.target.value)}
                required
              />
            </div>
            {!sale ? (
              <div className="space-y-2">
                <Label htmlFor="sale-initial">Initial payment (₹)</Label>
                <Input
                  id="sale-initial"
                  type="number"
                  min="0"
                  max={totalAmount || undefined}
                  step="1"
                  value={initialPaid}
                  onChange={(event) => setInitialPaid(event.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Sold by</Label>
              <Select value={soldBy} onValueChange={setSoldBy}>
                <SelectTrigger className="w-full">
                  <SelectValue />
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
          </div>

          <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
            <Switch
              id="sale-upgrade"
              checked={isUpgrade}
              onCheckedChange={(checked) => {
                setIsUpgrade(checked);
                if (!checked) setUpgradeFromSaleId("none");
              }}
            />
            <div>
              <Label htmlFor="sale-upgrade">This is an upgrade</Label>
              <p className="text-xs text-muted-foreground">
                Mark repeat business from an existing client.
              </p>
            </div>
          </div>

          {isUpgrade ? (
            <div className="space-y-2">
              <Label>Upgrades which sale?</Label>
              <Select
                value={upgradeFromSaleId}
                onValueChange={selectUpgradeParent}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select the previous sale" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select previous sale</SelectItem>
                  {upgradeCandidates.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.client_name} - {formatDate(item.sale_date)} -{" "}
                      {formatINR(item.total_amount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {upgradeCandidates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Record the original sale first, then link this upgrade to it.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="sale-notes">Notes</Label>
            <Textarea
              id="sale-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Scope, payment terms, special arrangements..."
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
                !totalAmount ||
                Number(totalAmount) <= 0 ||
                (isUpgrade && upgradeFromSaleId === "none")
              }
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {sale ? "Save changes" : "Record sale"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
