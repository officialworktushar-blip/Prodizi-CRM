"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
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

type ImportData = {
  client_name: string;
  company: string | null;
  phone: string;
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

type ParsedRow = {
  rowNumber: number;
  data: ImportData;
  assignedToEmail: string | null;
  assignedToId: string | null;
  errors: string[];
};

const TEMPLATE_COLUMNS = [
  "client_name",
  "company",
  "phone",
  "email",
  "kind",
  "item_name",
  "frequency",
  "source",
  "expected_value",
  "notes",
  "assigned_to_email",
];

const CHUNK_SIZE = 200;

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

function mapRow(
  row: Record<string, unknown>,
  rowNumber: number,
  profileMap: Map<string, Profile>,
  allowAssignment: boolean,
): ParsedRow {
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
  const phone = pick(normalized, [
    "phone",
    "mobile",
    "contact",
    "phone_number",
  ]);
  const email = pick(normalized, ["email", "email_address"]);
  const assignedToEmail = pick(normalized, [
    "assigned_to_email",
    "assigned_email",
    "owner_email",
  ]).toLowerCase();
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
  const owner =
    allowAssignment && assignedToEmail
      ? profileMap.get(assignedToEmail)
      : undefined;
  const errors: string[] = [];

  if (!clientName) errors.push("Client name is required");
  if (!phone) errors.push("Phone is required");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Invalid email address");
  }
  if (allowAssignment && assignedToEmail && !owner) {
    errors.push("Assigned member email not found");
  }

  return {
    rowNumber,
    assignedToEmail: assignedToEmail || null,
    assignedToId: owner?.id ?? null,
    errors,
    data: {
      client_name: clientName,
      company:
        pick(normalized, ["company", "organisation", "organization"]) || null,
      phone,
      email: email || null,
      kind: LEAD_KINDS.includes(kindValue as LeadKind)
        ? (kindValue as LeadKind)
        : "product",
      item_name:
        pick(normalized, [
          "item_name",
          "product",
          "service",
          "item",
          "product_service",
        ]) || null,
      frequency: LEAD_FREQUENCIES.includes(frequencyValue as LeadFrequency)
        ? (frequencyValue as LeadFrequency)
        : "daily",
      status: LEAD_STATUSES.includes(statusValue as LeadStatus)
        ? (statusValue as LeadStatus)
        : "upcoming",
      source: pick(normalized, ["source", "channel"]) || null,
      expected_value: expectedValue ? toNumber(expectedValue) : null,
      next_follow_up: asDate(nextFollowUp),
      notes:
        pick(normalized, ["notes", "note", "remarks", "description"]) || null,
    },
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
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [assignedTo, setAssignedTo] = useState(currentUserId);
  const [reading, setReading] = useState(false);

  const validRows = rows.filter((row) => row.errors.length === 0);
  const invalidRows = rows.filter((row) => row.errors.length > 0);

  const mutation = useMutation({
    mutationFn: async () => {
      if (validRows.length === 0) throw new Error("No valid rows to import");
      const supabase = createClient();
      const { data: batch, error: batchError } = await supabase
        .from("lead_import_batches")
        .insert({
          file_name: fileName,
          row_count: validRows.length,
          imported_by: currentUserId,
        })
        .select("id")
        .single();
      if (batchError) throw batchError;

      const payload = validRows.map(({ data, assignedToId }) => ({
        ...data,
        assigned_to:
          canAssign && assignedToId ? assignedToId : assignedTo || currentUserId,
        created_by: currentUserId,
        import_batch_id: batch.id,
      }));

      for (let start = 0; start < payload.length; start += CHUNK_SIZE) {
        const chunk = payload.slice(start, start + CHUNK_SIZE);
        const { error } = await supabase.from("leads").insert(chunk);
        if (error) {
          throw new Error(
            `Imported ${start} of ${payload.length} rows. ${error.message}`,
          );
        }
      }

      return invalidRows.length;
    },
    onSuccess: (skipped) => {
      toast.success(
        `${validRows.length} leads imported${skipped ? `; ${skipped} invalid rows skipped` : ""}`,
      );
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
      const profileMap = new Map(
        profiles
          .filter((profile) => profile.email)
          .map((profile) => [profile.email!.toLowerCase(), profile]),
      );
      const parsed = raw.map((row, index) =>
        mapRow(row, index + 2, profileMap, canAssign),
      );
      setRows(parsed);
      if (parsed.length === 0) {
        toast.error("No rows found in this file.");
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

  const downloadTemplate = () => {
    const templateRow = Object.fromEntries(
      TEMPLATE_COLUMNS.map((column) => [column, ""]),
    );
    const worksheet = XLSX.utils.json_to_sheet([templateRow], {
      header: TEMPLATE_COLUMNS,
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
    XLSX.writeFile(workbook, "lead-import-template.xlsx");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import leads</DialogTitle>
          <DialogDescription>
            Upload Excel or CSV with name and phone. Invalid rows are shown in
            the preview and skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
            >
              <Download className="size-4" />
              Download template
            </Button>
          </div>

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
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          {rows.length > 0 ? (
            <div className="space-y-3 rounded-xl border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {validRows.length} ready · {invalidRows.length} invalid
                </p>
                <p className="text-xs text-muted-foreground">
                  {rows.length} rows found
                </p>
              </div>
              <div className="max-h-40 overflow-y-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted/80">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">Row</th>
                      <th className="px-2 py-1.5 font-medium">Client</th>
                      <th className="px-2 py-1.5 font-medium">Phone</th>
                      <th className="px-2 py-1.5 font-medium">Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((row) => (
                      <tr key={row.rowNumber} className="border-t">
                        <td className="px-2 py-1.5">{row.rowNumber}</td>
                        <td className="max-w-32 truncate px-2 py-1.5">
                          {row.data.client_name || "—"}
                        </td>
                        <td className="px-2 py-1.5">{row.data.phone || "—"}</td>
                        <td
                          className={`px-2 py-1.5 ${
                            row.errors.length
                              ? "text-brand-red"
                              : "text-brand-green"
                          }`}
                        >
                          {row.errors.length
                            ? row.errors.join(", ")
                            : "Ready"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 10 ? (
                <p className="text-xs text-muted-foreground">
                  Showing the first 10 rows.
                </p>
              ) : null}
            </div>
          ) : null}

          {canAssign ? (
            <div className="space-y-2">
              <Label>Default assigned member</Label>
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
              <p className="text-xs text-muted-foreground">
                A row with assigned_to_email overrides this default.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={validRows.length === 0 || mutation.isPending || reading}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Import {validRows.length > 0 ? validRows.length : ""} leads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
