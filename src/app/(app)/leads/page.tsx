"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  CalendarClock,
  Download,
  LayoutGrid,
  List,
  Mail,
  Phone,
  Plus,
  Search,
  Target,
  Trash2,
  Upload,
  UserCheck,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { LeadAssignDialog } from "@/components/leads/lead-assign-dialog";
import { LeadConfirmDialog } from "@/components/leads/lead-confirm-dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { useNow } from "@/hooks/use-now";
import { useRole } from "@/hooks/use-role";
import { useTeamTree } from "@/hooks/use-team-tree";
import {
  LEAD_FREQUENCIES,
  LEAD_FREQUENCY_LABELS,
  LEAD_KINDS,
  LEAD_KIND_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  ROLE_LABELS,
  type LeadFrequency,
  type LeadKind,
  type LeadStatus,
} from "@/lib/constants";
import { canEditLead, isAdminRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { getFlatDownline } from "@/lib/team-hierarchy";
import { formatDate, formatINR, getInitials, todayISO } from "@/lib/utils";
import type { Lead } from "@/types/database";

export default function LeadsPage() {
  const { profile, role, loading: roleLoading, error: roleError } = useRole();
  const { members, assignableMembers, loading: treeLoading } = useTeamTree();
  const isAdmin = isAdminRole(role);
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | LeadStatus>("all");
  const [assignmentFilter, setAssignmentFilter] = useState<
    "all" | "unassigned"
  >("all");
  const [kindFilter, setKindFilter] = useState<"all" | LeadKind>("all");
  const [frequencyFilter, setFrequencyFilter] = useState<"all" | LeadFrequency>(
    "all",
  );
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [assignedByFilter, setAssignedByFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [view, setView] = useState<"table" | "kanban" | "upcoming">("table");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Lead | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignTargets, setAssignTargets] = useState<Lead[] | null>(null);
  const now = useNow();
  const today = now ? todayISO(now) : "";

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

  const statusMutation = useMutation({
    mutationFn: async ({
      lead,
      status,
      amount,
    }: {
      lead: Lead;
      status: LeadStatus;
      amount?: number;
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("leads")
        .update({
          status,
          ...(status === "confirmed" && amount !== undefined
            ? { expected_value: amount }
            : {}),
        })
        .eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead status updated");
      setConfirmTarget(null);
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

  const handleStatusChange = (lead: Lead, status: LeadStatus) => {
    if (status === "confirmed" && lead.status !== "confirmed") {
      setConfirmTarget(lead);
      return;
    }
    statusMutation.mutate({ lead, status });
  };

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

  const profiles = useMemo(() => {
    if (members.length > 0) return members;
    return profile ? [profile] : [];
  }, [members, profile]);
  const profileMap = useMemo(
    () => new Map(profiles.map((item) => [item.id, item])),
    [profiles],
  );
  const leads = useMemo(() => leadsQuery.data ?? [], [leadsQuery.data]);

  const filteredLeads = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const upcomingEnd = now ? new Date(now) : null;
    if (upcomingEnd) upcomingEnd.setDate(upcomingEnd.getDate() + 7);
    const upcomingEndISO = upcomingEnd ? todayISO(upcomingEnd) : "";
    return leads.filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (kindFilter !== "all" && lead.kind !== kindFilter) return false;
      if (frequencyFilter !== "all" && lead.frequency !== frequencyFilter) {
        return false;
      }
      if (isAdmin && assignmentFilter === "unassigned" && lead.assigned_to) {
        return false;
      }
      if (isAdmin && assigneeFilter !== "all" && assigneeFilter !== "team") {
        const scopedIds = new Set([
          assigneeFilter,
          ...getFlatDownline(profiles, assigneeFilter).map(
            (member) => member.id,
          ),
        ]);
        if (!lead.assigned_to || !scopedIds.has(lead.assigned_to)) {
          return false;
        }
      }
      if (
        isAdmin &&
        assignedByFilter !== "all" &&
        lead.assigned_by !== assignedByFilter
      ) {
        return false;
      }
      const followUp = lead.next_follow_up?.slice(0, 10) ?? "";
      if (fromDate && (!followUp || followUp < fromDate)) return false;
      if (toDate && (!followUp || followUp > toDate)) return false;
      if (
        view === "upcoming" &&
        (!today ||
          !upcomingEndISO ||
          !followUp ||
          followUp < today ||
          followUp > upcomingEndISO)
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
  }, [
    leads,
    statusFilter,
    assignmentFilter,
    kindFilter,
    frequencyFilter,
    assigneeFilter,
    assignedByFilter,
    fromDate,
    toDate,
    view,
    search,
    isAdmin,
    profiles,
    now,
    today,
  ]);

  const counts = useMemo(
    () => ({
      all: leads.length,
      unassigned: leads.filter((lead) => !lead.assigned_to).length,
      upcoming: leads.filter((lead) => lead.status === "upcoming").length,
      pending: leads.filter((lead) => lead.status === "pending").length,
      ongoing: leads.filter((lead) => lead.status === "ongoing").length,
      confirmed: leads.filter((lead) => lead.status === "confirmed").length,
      cancelled: leads.filter((lead) => lead.status === "cancelled").length,
    }),
    [leads],
  );

  const pipelineValue = filteredLeads
    .filter(
      (lead) => lead.status !== "cancelled" && lead.status !== "confirmed",
    )
    .reduce((sum, lead) => sum + Number(lead.expected_value ?? 0), 0);

  const selectedLeads = filteredLeads.filter((lead) =>
    selectedIds.includes(lead.id),
  );
  const allVisibleSelected =
    filteredLeads.length > 0 &&
    filteredLeads.every((lead) => selectedIds.includes(lead.id));

  const toggleLead = (leadId: string) => {
    setSelectedIds((current) =>
      current.includes(leadId)
        ? current.filter((id) => id !== leadId)
        : [...current, leadId],
    );
  };

  const toggleAllVisible = () => {
    const visibleIds = filteredLeads.map((lead) => lead.id);
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  };

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

  if (roleLoading || treeLoading) {
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
            <Button variant="outline" onClick={() => setImportOpen(true)}>
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={assignmentFilter === "unassigned" ? "default" : "outline"}
            className={
              assignmentFilter === "unassigned"
                ? ""
                : "border-brand-orange/40 text-brand-orange"
            }
            onClick={() => {
              setAssignmentFilter("unassigned");
              setStatusFilter("all");
            }}
          >
            Unassigned
            <Badge
              variant={
                assignmentFilter === "unassigned" ? "secondary" : "outline"
              }
              className="ml-1 px-1.5"
            >
              {counts.unassigned}
            </Badge>
          </Button>
          {(["all", ...LEAD_STATUSES] as const).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={
                statusFilter === status && assignmentFilter === "all"
                  ? "default"
                  : "outline"
              }
              onClick={() => {
                setAssignmentFilter("all");
                setStatusFilter(status);
              }}
            >
              {status === "all" ? "All leads" : LEAD_STATUS_LABELS[status]}
              <Badge
                variant={
                  statusFilter === status && assignmentFilter === "all"
                    ? "secondary"
                    : "outline"
                }
                className="ml-1 px-1.5"
              >
                {counts[status]}
              </Badge>
            </Button>
          ))}
        </div>
        <div className="flex rounded-lg border p-0.5">
          <Button
            variant={view === "table" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("table")}
          >
            <List className="size-3.5" />
            Table
          </Button>
          <Button
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("kanban")}
          >
            <LayoutGrid className="size-3.5" />
            Kanban
          </Button>
          <Button
            variant={view === "upcoming" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("upcoming")}
          >
            <CalendarClock className="size-3.5" />
            Upcoming
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap">
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
            <Select
              value={frequencyFilter}
              onValueChange={(value) =>
                setFrequencyFilter(value as "all" | LeadFrequency)
              }
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All frequencies</SelectItem>
                {LEAD_FREQUENCIES.map((frequency) => (
                  <SelectItem key={frequency} value={frequency}>
                    {LEAD_FREQUENCY_LABELS[frequency]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAdmin ? (
              <>
                <Select
                  value={assigneeFilter}
                  onValueChange={setAssigneeFilter}
                >
                  <SelectTrigger className="w-full sm:w-[190px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All members</SelectItem>
                    <SelectItem value="team">My whole team</SelectItem>
                    {profiles.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={assignedByFilter}
                  onValueChange={setAssignedByFilter}
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Assigned by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Assigned by anyone</SelectItem>
                    {profiles.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : null}
            <div className="flex items-center gap-2 rounded-lg border px-2 py-1">
              <span className="shrink-0 text-xs text-muted-foreground">
                Follow-up
              </span>
              <Input
                type="date"
                aria-label="Follow-up from"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="w-[135px] border-0 px-1 shadow-none"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                aria-label="Follow-up to"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="w-[135px] border-0 px-1 shadow-none"
              />
            </div>
          </div>

          {isAdmin && selectedLeads.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm font-medium">
                {selectedLeads.length} lead
                {selectedLeads.length === 1 ? "" : "s"} selected
              </p>
              <Button size="sm" onClick={() => setAssignTargets(selectedLeads)}>
                <UserCheck className="size-4" />
                Assign selected
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds([])}
              >
                Clear
              </Button>
            </div>
          ) : null}

          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              {filteredLeads.length} leads shown
              {view === "upcoming" ? " · next 7 days" : ""}
            </p>
            <p className="font-medium">
              Open pipeline:{" "}
              <span className="text-brand-blue">
                {formatINR(pipelineValue)}
              </span>
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
          ) : view === "kanban" ? (
            <div className="grid gap-3 overflow-x-auto pb-2 md:grid-cols-5">
              {LEAD_STATUSES.map((status) => {
                const columnLeads = filteredLeads.filter(
                  (lead) => lead.status === status,
                );
                return (
                  <div
                    key={status}
                    className="min-w-[230px] rounded-xl border bg-muted/20 p-2"
                  >
                    <div className="mb-2 flex items-center justify-between px-1">
                      <p className="text-sm font-medium">
                        {LEAD_STATUS_LABELS[status]}
                      </p>
                      <Badge variant="outline">{columnLeads.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {columnLeads.length === 0 ? (
                        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                          No leads
                        </p>
                      ) : (
                        columnLeads.map((lead) => {
                          const owner =
                            profileMap.get(lead.assigned_to ?? "") ??
                            (lead.assigned_to === profile.id
                              ? profile
                              : undefined);
                          const canEdit = canEditLead(role, profile.id, lead);
                          return (
                            <div
                              key={lead.id}
                              className="rounded-lg border bg-card p-3 shadow-sm"
                            >
                              <div className="flex items-start gap-2">
                                {isAdmin ? (
                                  <Checkbox
                                    checked={selectedIds.includes(lead.id)}
                                    onCheckedChange={() => toggleLead(lead.id)}
                                    aria-label={`Select ${lead.client_name}`}
                                  />
                                ) : null}
                                <div className="min-w-0 flex-1">
                                  <Link
                                    href={`/leads/${lead.id}`}
                                    className="block truncate text-sm font-medium hover:underline"
                                  >
                                    {lead.client_name}
                                  </Link>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {lead.company ||
                                      lead.item_name ||
                                      "Direct lead"}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-2 flex items-center justify-between text-xs">
                                <Badge variant="secondary">
                                  {LEAD_KIND_LABELS[lead.kind as LeadKind] ??
                                    lead.kind}
                                </Badge>
                                <span className="font-medium">
                                  {formatINR(lead.expected_value)}
                                </span>
                              </div>
                              <p className="mt-2 truncate text-xs text-muted-foreground">
                                {owner?.full_name ?? "Unassigned"}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Follow-up:{" "}
                                {lead.next_follow_up
                                  ? formatDate(lead.next_follow_up)
                                  : "—"}
                              </p>
                              {canEdit ? (
                                <Select
                                  value={lead.status}
                                  onValueChange={(value) =>
                                    handleStatusChange(
                                      lead,
                                      value as LeadStatus,
                                    )
                                  }
                                  disabled={statusMutation.isPending}
                                >
                                  <SelectTrigger
                                    size="sm"
                                    className="mt-2 w-full"
                                  >
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
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    {isAdmin ? (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={toggleAllVisible}
                          aria-label="Select all visible leads"
                        />
                      </TableHead>
                    ) : null}
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
                    const assignedBy =
                      profileMap.get(lead.assigned_by ?? "") ??
                      (lead.assigned_by === profile.id ? profile : undefined);
                    const canEdit = canEditLead(role, profile.id, lead);
                    const followUpOverdue =
                      today &&
                      lead.next_follow_up &&
                      lead.next_follow_up < today &&
                      lead.status !== "confirmed" &&
                      lead.status !== "cancelled";
                    return (
                      <TableRow key={lead.id}>
                        {isAdmin ? (
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.includes(lead.id)}
                              onCheckedChange={() => toggleLead(lead.id)}
                              aria-label={`Select ${lead.client_name}`}
                            />
                          </TableCell>
                        ) : null}
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
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatINR(lead.expected_value)}
                        </TableCell>
                        <TableCell>
                          {owner ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="size-7">
                                <AvatarFallback className="bg-brand-gradient text-[0.65rem] text-white">
                                  {getInitials(owner.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="max-w-[140px] truncate text-sm">
                                  {owner.full_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {ROLE_LABELS[owner.role]}
                                </p>
                                {assignedBy ? (
                                  <p className="mt-0.5 max-w-[180px] truncate text-[0.65rem] text-muted-foreground">
                                    Assigned by {assignedBy.full_name}
                                    {lead.assigned_at
                                      ? ` · ${formatDate(lead.assigned_at)}`
                                      : ""}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          ) : (
                            <Badge className="border-brand-orange/30 bg-brand-orange/10 text-brand-orange">
                              Unassigned
                            </Badge>
                          )}
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
                                handleStatusChange(lead, value as LeadStatus)
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
                                <span className="text-lg leading-none">
                                  ···
                                </span>
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
                                  onClick={() => setAssignTargets([lead])}
                                >
                                  <UserCheck className="size-4" />
                                  {lead.assigned_to ? "Reassign" : "Assign"}
                                </DropdownMenuItem>
                              ) : null}
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

      {assignTargets && assignTargets.length > 0 ? (
        <LeadAssignDialog
          key={`assign-${assignTargets.map((lead) => lead.id).join("-")}`}
          open
          onOpenChange={(open) => {
            if (!open) {
              setAssignTargets(null);
              setSelectedIds([]);
            }
          }}
          leads={assignTargets}
          members={assignableMembers}
          currentUserId={profile.id}
        />
      ) : null}

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

      <LeadConfirmDialog
        key={`confirm-${confirmTarget?.id ?? "closed"}`}
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
        lead={confirmTarget}
        pending={statusMutation.isPending}
        onConfirm={(amount) => {
          if (!confirmTarget) return;
          statusMutation.mutate({
            lead: confirmTarget,
            status: "confirmed",
            amount,
          });
        }}
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
