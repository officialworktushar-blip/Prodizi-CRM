"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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
  LEAD_FREQUENCIES,
  LEAD_KINDS,
  LEAD_STATUSES,
  type LeadFrequency,
  type LeadKind,
  type LeadStatus,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { toNumber } from "@/lib/utils";
import type { Profile } from "@/types/database";

type ImportRow = {
  client_name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  kind: LeadKind;
  item_name: string | null;
  frequency: LeadFrequency;
  status: LeadStatus;
  source: string | null;
  expected_value: number | null;
  next_follow_up: string | null;
  notes: string | null;
};

type LeadImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: Profile[];
  currentUserId: string;
  canAssign: boolean;
};

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function pick(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeKey(key)];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function asDate(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "yyyy-MM-dd");
}

function mapRow(row: Record<string, unknown>): ImportRow | null {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeKey(key)] = String(value ?? "").trim();
  }

  const clientName = pick(normalized, [
    "client_name",
    "client",
    "name",
    "customer",
  ]);
  if (!clientName) return null;

  const kindValue = pick(normalized, ["kind", "type"]).toLowerCase();
  const frequencyValue = pick(normalized, [
    "frequency",
    "follow_up_frequency",
    "cadence",
  ]).toLowerCase();
  const statusValue = pick(normalized, ["status", "lead_status"]).toLowerCase();
  const expectedValue = pick(normalized, [
    "expected_value",
    "value",
    "amount",
  ]).replace(/[^0-9.-]/g, "");
  const nextFollowUp = pick(normalized, [
    "next_follow_up",
    "follow_up",
    "follow_up_date",
  ]);

  return {
    client_name: clientName,
    company: pick(normalized, ["company", "organisation", "organization"]) ||
      null,
    phone: pick(normalized, ["phone", "mobile", "contact", "phone_number"]) ||
      null,
    email: pick(normalized, ["email", "email_address"]) || null,
    kind: LEAD_KINDS.includes(kindValue as LeadKind)
      ? (kindValue as LeadKind)
      : "product",
    item_name: pick(normalized, [
      "item_name",
      "product",
      "service",
      "item",
      "product_service",
    ])
      ? pick(normalized, [
          "item_name",
          "product",
          "service",
          "item",
          "product_service",
        ])
      : null,
    frequency: LEAD_FREQUENCIES.includes(frequencyValue as LeadFrequency)
      ? (frequencyValue as LeadFrequency)
      : "daily",
    status: LEAD_STATUSES.includes(statusValue as LeadStatus)
      ? (statusValue as LeadStatus)
      : "upcoming",
    source: pick(normalized, ["source", "channel"]) || null,
    expected_value: expectedValue ? toNumber(expectedValue) : null,
    next_follow_up: asDate(nextFollowUp),
    notes: pick(normalized, ["notes", "note", "remarks", "description"]) || null,
  };
}

export function LeadImportDialog({
  open,
  onOpenChange,
  profiles,
  currentUserId,
  canAssign,
}: LeadImportDialogProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [assignedTo, setAssignedTo] = useState(currentUserId);
  const [reading, setReading] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { data: batch, error: batchError } = await supabase
        .from("lead_import_batches")
        .insert({
          file_name: fileName,
          row_count: rows.length,
          imported_by: currentUserId,
        })
        .select("id")
        .single();
      if (batchError) throw batchError;

      const { error } = await supabase.from("leads").insert(
        rows.map((row) => ({
          ...row,
          assigned_to: assignedTo,
          created_by: currentUserId,
          import_batch_id: batch.id,
        })),
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${rows.length} leads imported`);
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setRows([]);
      setFileName("");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Import failed");
    },
  });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
      });
      const mapped = raw
        .map((row) => mapRow(row))
        .filter((row): row is ImportRow => row !== null);
      setRows(mapped);
      if (mapped.length === 0) {
        toast.error("No valid rows found. Include a client_name column.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not read file",
      );
      setRows([]);
    } finally {
      setReading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import leads</DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file. A header row is required, with at least
            a <span className="font-medium">client_name</span> column.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/30 px-6 py-8 text-center transition-colors hover:bg-muted/60"
          >
            {reading ? (
              <Loader2 className="size-7 animate-spin text-muted-foreground" />
            ) : (
              <FileSpreadsheet className="size-7 text-brand-green" />
            )}
            <span className="text-sm font-medium">
              {fileName || "Choose spreadsheet"}
            </span>
            <span className="text-xs text-muted-foreground">
              .xlsx, .xls or .csv
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />

          {rows.length > 0 ? (
            <div className="rounded-xl border bg-card p-3">
              <p className="text-sm font-medium">{rows.length} valid rows</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                First: {rows[0].client_name}
                {rows[0].company ? ` · ${rows[0].company}` : ""}
              </p>
            </div>
          ) : null}

          {canAssign ? (
            <div className="space-y-2">
              <Label>Assign imported leads to</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
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
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={rows.length === 0 || mutation.isPending || reading}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Import {rows.length > 0 ? rows.length : ""} leads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
