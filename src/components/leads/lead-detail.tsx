"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  StickyNote,
  Target,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { LeadAssignDialog } from "@/components/leads/lead-assign-dialog";
import { LeadConfirmDialog } from "@/components/leads/lead-confirm-dialog";
import { LeadDialog } from "@/components/leads/lead-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useRole } from "@/hooks/use-role";
import { useTeamTree } from "@/hooks/use-team-tree";
import {
  LEAD_FREQUENCY_LABELS,
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
import {
  formatDate,
  formatINR,
  formatRelative,
  getInitials,
} from "@/lib/utils";
import type { Lead, LeadActivity, Profile, Sale, Task } from "@/types/database";

export function LeadDetail({ leadId }: { leadId: string }) {
  const { profile, role, loading: roleLoading } = useRole();
  const { assignableMembers } = useTeamTree();
  const queryClient = useQueryClient();
  const isAdmin = isAdminRole(role);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [note, setNote] = useState("");

  const leadQuery = useQuery({
    queryKey: ["leads", "detail", leadId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .maybeSingle();
      if (error) throw error;
      return (data as Lead | null) ?? null;
    },
  });

  const relatedQuery = useQuery({
    queryKey: ["leads", "related", leadId],
    queryFn: async () => {
      const supabase = createClient();
      const [tasks, activity, sales, profiles] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false }),
        supabase
          .from("lead_activity")
          .select("*")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("sales").select("*").eq("lead_id", leadId),
        supabase.from("profiles").select("*").order("full_name"),
      ]);
      const error =
        tasks.error ?? activity.error ?? sales.error ?? profiles.error;
      if (error) throw error;
      return {
        tasks: (tasks.data ?? []) as Task[],
        activity: (activity.data ?? []) as LeadActivity[],
        sales: (sales.data ?? []) as Sale[],
        profiles: (profiles.data ?? []) as Profile[],
      };
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      status,
      amount,
    }: {
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
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead status updated");
      setConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Update failed");
    },
  });

  const noteMutation = useMutation({
    mutationFn: async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!profile) throw new Error("Missing profile");
      const supabase = createClient();
      const { error } = await supabase.from("lead_activity").insert({
        lead_id: leadId,
        actor_id: profile.id,
        action: "note",
        detail: note.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note added");
      setNote("");
      void queryClient.invalidateQueries({
        queryKey: ["leads", "related", leadId],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Could not add note",
      );
    },
  });

  if (roleLoading || leadQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (leadQuery.error) {
    return (
      <ErrorState
        message="This lead could not be loaded."
        onRetry={() => void leadQuery.refetch()}
      />
    );
  }

  if (!leadQuery.data) {
    return (
      <EmptyState
        icon={Target}
        title="Lead not found"
        description="It may have been deleted, or you may not have access."
        action={
          <Button asChild variant="outline">
            <Link href="/leads">Back to leads</Link>
          </Button>
        }
      />
    );
  }

  const lead = leadQuery.data;
  const tasks = relatedQuery.data?.tasks ?? [];
  const activity = relatedQuery.data?.activity ?? [];
  const sales = relatedQuery.data?.sales ?? [];
  const profiles = relatedQuery.data?.profiles ?? [];
  const profileMap = new Map(profiles.map((item) => [item.id, item]));
  const owner =
    profileMap.get(lead.assigned_to ?? "") ??
    (lead.assigned_to === profile?.id ? profile : undefined);
  const assignedBy =
    profileMap.get(lead.assigned_by ?? "") ??
    (lead.assigned_by === profile?.id ? profile : undefined);
  const canEdit = profile ? canEditLead(role, profile.id, lead) : false;

  const handleStatusChange = (status: LeadStatus) => {
    if (!canEdit || status === lead.status) return;
    if (status === "confirmed") {
      setConfirmOpen(true);
      return;
    }
    statusMutation.mutate({ status });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.client_name}
        description={lead.company ?? "Lead details and activity"}
        eyebrow="Lead"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/leads">
                <ArrowLeft className="size-4" />
                Back
              </Link>
            </Button>
            {isAdmin ? (
              <Button variant="outline" onClick={() => setAssignOpen(true)}>
                <UserCheck className="size-4" />
                {lead.assigned_to ? "Reassign" : "Assign"}
              </Button>
            ) : null}
            {canEdit ? (
              <Button onClick={() => setDialogOpen(true)}>Edit lead</Button>
            ) : null}
          </>
        }
      />

      <Card>
        <CardContent className="overflow-x-auto py-4">
          <div className="flex min-w-[600px] items-start">
            {LEAD_STATUSES.map((status, index) => (
              <div key={status} className="contents">
                {index > 0 ? (
                  <div
                    className={`mt-3.5 h-0.5 flex-1 ${
                      LEAD_STATUSES.indexOf(lead.status as LeadStatus) >= index
                        ? "bg-brand-blue"
                        : "bg-border"
                    }`}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => handleStatusChange(status)}
                  disabled={!canEdit || statusMutation.isPending}
                  className="flex w-24 shrink-0 flex-col items-center gap-1.5 disabled:cursor-default"
                >
                  <span
                    className={`flex size-7 items-center justify-center rounded-full border text-xs font-semibold ${
                      lead.status === status
                        ? "border-brand-blue bg-brand-blue text-white"
                        : LEAD_STATUSES.indexOf(lead.status as LeadStatus) >
                            index
                          ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
                          : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={`text-xs ${
                      lead.status === status
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {LEAD_STATUS_LABELS[status]}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Overview</CardTitle>
              <CardDescription>
                Contact and opportunity details.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {LEAD_KIND_LABELS[lead.kind as LeadKind] ?? lead.kind}
              </Badge>
              {canEdit ? (
                <Select
                  value={lead.status}
                  onValueChange={(value) =>
                    handleStatusChange(value as LeadStatus)
                  }
                  disabled={statusMutation.isPending}
                >
                  <SelectTrigger size="sm" className="w-[130px]">
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
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3 text-sm">
                {lead.phone ? (
                  <p className="flex items-center gap-2">
                    <Phone className="size-4 text-muted-foreground" />
                    <a href={`tel:${lead.phone}`} className="hover:underline">
                      {lead.phone}
                    </a>
                  </p>
                ) : null}
                {lead.email ? (
                  <p className="flex items-center gap-2">
                    <Mail className="size-4 text-muted-foreground" />
                    <a
                      href={`mailto:${lead.email}`}
                      className="break-all hover:underline"
                    >
                      {lead.email}
                    </a>
                  </p>
                ) : null}
                {lead.company ? (
                  <p className="flex items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground" />
                    {lead.company}
                  </p>
                ) : null}
              </div>
              <div className="space-y-3 text-sm">
                <p className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Expected value</span>
                  <span className="font-medium">
                    {formatINR(lead.expected_value)}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Frequency</span>
                  <span className="capitalize">
                    {LEAD_FREQUENCY_LABELS[lead.frequency as LeadFrequency] ??
                      lead.frequency}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Source</span>
                  <span>{lead.source ?? "—"}</span>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Next follow-up</span>
                  <span>{formatDate(lead.next_follow_up)}</span>
                </p>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Product / service
              </p>
              <p className="mt-1 text-sm">{lead.item_name ?? "—"}</p>
            </div>

            {lead.notes ? (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Notes
                </p>
                <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Owner</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarFallback className="bg-brand-gradient text-sm font-semibold text-white">
                    {getInitials(owner?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {owner?.full_name ?? "Unassigned"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {owner?.designation ??
                      (owner?.role ? ROLE_LABELS[owner.role] : "No owner")}
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                {lead.assigned_to ? (
                  <p>
                    Assigned by {assignedBy?.full_name ?? "system"}
                    {lead.assigned_at
                      ? ` on ${formatDate(lead.assigned_at)}`
                      : ""}
                  </p>
                ) : (
                  <Badge className="border-brand-orange/30 bg-brand-orange/10 text-brand-orange">
                    Unassigned
                  </Badge>
                )}
                <p className="flex items-center gap-2">
                  <CalendarClock className="size-3.5" />
                  Created {formatDate(lead.created_at)}
                </p>
                <p className="flex items-center gap-2">
                  <Target className="size-3.5" />
                  Updated {formatRelative(lead.updated_at)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Linked tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tasks linked to this lead.
                </p>
              ) : (
                tasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {task.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {task.due_date
                          ? formatDate(task.due_date)
                          : "No due date"}
                      </p>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sales.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No sale has been linked yet.
                </p>
              ) : (
                sales.map((sale) => (
                  <Link
                    key={sale.id}
                    href={`/sales/${sale.id}`}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/50"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {formatINR(sale.total_amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(sale.sale_date)}
                      </p>
                    </div>
                    <StatusBadge status={sale.payment_status} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="size-4" />
            Activity
          </CardTitle>
          <CardDescription>
            Status changes, assignments and internal notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="space-y-2"
            onSubmit={(event) => noteMutation.mutate(event)}
          >
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add an internal note..."
              rows={2}
            />
            <Button
              size="sm"
              type="submit"
              disabled={noteMutation.isPending || !note.trim()}
            >
              <Plus className="size-4" />
              Add note
            </Button>
          </form>

          {relatedQuery.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activity recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {activity.map((item) => {
                const actor = profileMap.get(item.actor_id ?? "");
                return (
                  <div key={item.id} className="flex gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-muted text-xs">
                        {item.action === "note" ? (
                          <StickyNote className="size-3.5" />
                        ) : (
                          getInitials(actor?.full_name)
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 rounded-xl border bg-card px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium capitalize">
                          {item.action.replaceAll("_", " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelative(item.created_at)}
                        </p>
                      </div>
                      {item.detail ? (
                        <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
                          {item.detail}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[0.68rem] text-muted-foreground">
                        {actor?.full_name ?? "System"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {assignOpen && profile ? (
        <LeadAssignDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          leads={[lead]}
          members={assignableMembers}
          currentUserId={profile.id}
        />
      ) : null}

      {dialogOpen ? (
        <LeadDialog
          key={`edit-${lead.id}`}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          lead={lead}
          profiles={profiles.length > 0 ? profiles : profile ? [profile] : []}
          currentUserId={profile?.id ?? ""}
          canAssign={isAdmin}
        />
      ) : null}

      <LeadConfirmDialog
        key={`confirm-${confirmOpen ? lead.id : "closed"}`}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        lead={lead}
        pending={statusMutation.isPending}
        onConfirm={(amount) =>
          statusMutation.mutate({ status: "confirmed", amount })
        }
      />
    </div>
  );
}
