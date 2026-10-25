"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Mail,
  Phone,
  Plus,
  Search,
  Target,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { LeadDialog } from "@/components/leads/lead-dialog";
import { LeadImportDialog } from "@/components/leads/lead-import-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRole } from "@/hooks/use-role";
import {
  LEAD_KINDS,
  LEAD_KIND_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  ROLE_LABELS,
  type LeadKind,
  type LeadStatus,
} from "@/lib/constants";
import { canEditLead, isAdminRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import {
  formatDate,
  formatINR,
  getInitials,
  todayISO,
} from "@/lib/utils";
import type { Lead, Profile } from "@/types/database";

export default function LeadsPage() {
  const { profile, role, loading: roleLoading, error: roleError } = useRole();
  const isAdmin = isAdminRole(role);
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | LeadStatus>("all");
  const [kindFilter, setKindFilter] = useState<"all" | LeadKind>("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);

  const leadsQuery = useQuery({
    queryKey: ["leads", profile?.id, role],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase.from("leads").select("*");

      if (!isAdmin) {
        query = query.or(
          `assigned_to.eq.${profile!.id},created_by.eq.${profile!.id}`,
        );
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["profiles", "lead-assignees"],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      lead,
      status,
    }: {
      lead: Lead;
      status: LeadStatus;
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("leads")
        .update({ status })
        .eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead status updated");
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Update failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (lead: Lead) => {
      const supabase = createClient();
      const { error } = await supabase.from("leads").delete().eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead deleted");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    },
  });

  const profiles = useMemo(
    () => profilesQuery.data ?? [],
    [profilesQuery.data],
  );
  const profileMap = useMemo(
    () => new Map(profiles.map((item) => [item.id, item])),
    [profiles],
  );
  const leads = useMemo(() => leadsQuery.data ?? [], [leadsQuery.data]);

  const filteredLeads = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (kindFilter !== "all" && lead.kind !== kindFilter) return false;
      if (
        isAdmin &&
        assigneeFilter !== "all" &&
        lead.assigned_to !== assigneeFilter
      ) {
        return false;
      }
      if (!needle) return true;
      return [
        lead.client_name,
        lead.company,
        lead.phone,
        lead.email,
        lead.item_name,
        lead.source,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle));
    });
  }, [leads, statusFilter, kindFilter, assigneeFilter, search, isAdmin]);

  const counts = useMemo(
    () => ({
      all: leads.length,
      upcoming: leads.filter((lead) => lead.status === "upcoming").length,
      pending: leads.filter((lead) => lead.status === "pending").length,
      ongoing: leads.filter((lead) => lead.status === "ongoing").length,
      confirmed: leads.filter((lead) => lead.status === "confirmed").length,
      cancelled: leads.filter((lead) => lead.status === "cancelled").length,
    }),
    [leads],
  );

  const pipelineValue = filteredLeads
    .filter((lead) => lead.status !== "cancelled" && lead.status !== "confirmed")
    .reduce((sum, lead) => sum + Number(lead.expected_value ?? 0), 0);

  const openCreate = () => {
    setEditingLead(null);
    setDialogOpen(true);
  };

  const exportLeads = () => {
    const rows = filteredLeads.map((lead) => ({
      client_name: lead.client_name,
      company: lead.company ?? "",
      phone: lead.phone ?? "",
      email: lead.email ?? "",
      kind: LEAD_KIND_LABELS[lead.kind as LeadKind] ?? lead.kind,
      item_name: lead.item_name ?? "",
      frequency: lead.frequency,
      status: LEAD_STATUS_LABELS[lead.status as LeadStatus] ?? lead.status,
      source: lead.source ?? "",
      expected_value: lead.expected_value ?? 0,
      assigned_to:
        profileMap.get(lead.assigned_to ?? "")?.full_name ??
        (lead.assigned_to === profile?.id ? profile?.full_name : "") ??
        "",
      next_follow_up: lead.next_follow_up ?? "",
      notes: lead.notes ?? "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
    XLSX.writeFile(workbook, `leads-${todayISO()}.xlsx`);
  };

  if (roleLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (roleError) {
    return <ErrorState message="We could not verify your profile." />;
  }

  if (!profile) {
    return (
      <EmptyState
        icon={UserRound}
        title="Profile not found"
        description="Contact an owner to set up your profile."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description={
          isAdmin
            ? "The full pipeline, ownership and conversion status."
            : "Your assigned opportunities and follow-ups."
        }
        eyebrow="Pipeline"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="size-4" />
              Import
            </Button>
            <Button variant="outline" onClick={exportLeads}>
              <Download className="size-4" />
              Export
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              New lead
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(["all", ...LEAD_STATUSES] as const).map((status) => (
          <Button
            key={status}
            size="sm"
            variant={statusFilter === status ? "default" : "outline"}
            onClick={() => setStatusFilter(status)}
          >
            {status === "all" ? "All leads" : LEAD_STATUS_LABELS[status]}
            <Badge
              variant={statusFilter === status ? "secondary" : "outline"}
              className="ml-1 px-1.5"
            >
              {counts[status]}
            </Badge>
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search client, company, phone or email..."
                className="pl-9"
              />
            </div>
            <Select
              value={kindFilter}
              onValueChange={(value) =>
                setKindFilter(value as "all" | LeadKind)
              }
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All kinds</SelectItem>
                {LEAD_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {LEAD_KIND_LABELS[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAdmin ? (
              <Select
                value={assigneeFilter}
                onValueChange={setAssigneeFilter}
              >
                <SelectTrigger className="w-full sm:w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All members</SelectItem>
                  {profiles.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>

          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              {filteredLeads.length} leads shown
            </p>
            <p className="font-medium">
              Open pipeline:{" "}
              <span className="text-brand-blue">{formatINR(pipelineValue)}</span>
            </p>
          </div>

          {leadsQuery.error ? (
            <ErrorState
              message="Leads could not be loaded."
              onRetry={() => void leadsQuery.refetch()}
            />
          ) : leadsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredLeads.length === 0 ? (
            <EmptyState
              icon={Target}
              title={leads.length === 0 ? "No leads yet" : "No matching leads"}
              description={
                leads.length === 0
                  ? "Add a lead or import a spreadsheet to build your pipeline."
                  : "Try a different status, kind or search term."
              }
              action={
                leads.length === 0 ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="size-4" />
                    New lead
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Follow-up</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => {
                    const owner =
                      profileMap.get(lead.assigned_to ?? "") ??
                      (lead.assigned_to === profile.id ? profile : undefined);
                    const canEdit = canEditLead(role, profile.id, lead);
                    const followUpOverdue =
                      lead.next_follow_up &&
                      lead.next_follow_up < todayISO() &&
                      lead.status !== "confirmed" &&
                      lead.status !== "cancelled";
                    return (
                      <TableRow key={lead.id}>
                        <TableCell className="max-w-[220px]">
                          <p className="truncate font-medium">
                            {lead.client_name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {lead.company || lead.source || "Direct lead"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs">
                            {lead.phone ? (
                              <p className="flex items-center gap-1.5">
                                <Phone className="size-3 text-muted-foreground" />
                                {lead.phone}
                              </p>
                            ) : null}
                            {lead.email ? (
                              <p className="flex items-center gap-1.5">
                                <Mail className="size-3 text-muted-foreground" />
                                <span className="max-w-[170px] truncate">
                                  {lead.email}
                                </span>
                              </p>
                            ) : null}
                            {!lead.phone && !lead.email ? (
                              <span className="text-muted-foreground">—</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {LEAD_KIND_LABELS[lead.kind as LeadKind] ??
                              lead.kind}
                          </Badge>
                          <p className="mt-1 max-w-[140px] truncate text-xs text-muted-foreground">
                            {lead.item_name || "—"}
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatINR(lead.expected_value)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="size-7">
                              <AvatarFallback className="bg-brand-gradient text-[0.65rem] text-white">
                                {getInitials(owner?.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="max-w-[120px] truncate text-sm">
                                {owner?.full_name ?? "Unassigned"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {owner?.role
                                  ? ROLE_LABELS[owner.role]
                                  : ""}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              followUpOverdue
                                ? "text-sm font-medium text-brand-red"
                                : "text-sm"
                            }
                          >
                            {lead.next_follow_up
                              ? formatDate(lead.next_follow_up)
                              : "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {canEdit ? (
                            <Select
                              value={lead.status}
                              onValueChange={(value) =>
                                statusMutation.mutate({
                                  lead,
                                  status: value as LeadStatus,
                                })
                              }
                              disabled={statusMutation.isPending}
                            >
                              <SelectTrigger size="sm" className="w-[128px]">
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
                          ) : (
                            <StatusBadge status={lead.status} />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Lead actions"
                              >
                                <span className="text-lg leading-none">···</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                disabled={!canEdit}
                                onClick={() => {
                                  setEditingLead(lead);
                                  setDialogOpen(true);
                                }}
                              >
                                Edit lead
                              </DropdownMenuItem>
                              {isAdmin ? (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleteTarget(lead)}
                                >
                                  <Trash2 className="size-4" />
                                  Delete
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <LeadDialog
        key={`${dialogOpen ? (editingLead?.id ?? "new") : "closed"}`}
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setEditingLead(null);
        }}
        lead={editingLead}
        profiles={profiles.length > 0 ? profiles : [profile]}
        currentUserId={profile.id}
        canAssign={isAdmin}
      />

      <LeadImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        profiles={profiles.length > 0 ? profiles : [profile]}
        currentUserId={profile.id}
        canAssign={isAdmin}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.client_name}&rdquo; and its activity will be
              permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
