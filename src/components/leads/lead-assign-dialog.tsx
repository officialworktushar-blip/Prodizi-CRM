"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Sparkles, UserMinus, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { RoleBadge } from "@/components/shared/role-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildAssignmentPlan,
  rankAssignmentCandidates,
  type AssignmentCandidate,
  type AssignmentMode,
} from "@/lib/lead-assignment";
import { createClient } from "@/lib/supabase/client";
import { cn, formatPercent, toNumber } from "@/lib/utils";
import type { AssigneeWorkload, Lead, Profile } from "@/types/database";

type LeadAssignDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  members: Profile[];
  currentUserId: string;
};

function friendlyAssignmentError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("row-level security") || lower.includes("policy")) {
    return "You can only assign leads to members in your own team.";
  }
  if (lower.includes("hierarchy") || lower.includes("manager")) {
    return "That assignment is outside your team hierarchy.";
  }
  return message;
}

function WorkloadSummary({ workload }: { workload: AssigneeWorkload | null }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.68rem] text-muted-foreground">
      <span>{toNumber(workload?.open_leads)} open leads</span>
      <span>{toNumber(workload?.ongoing_leads)} ongoing</span>
      <span>{toNumber(workload?.tasks_pending)} pending tasks</span>
      <span>{formatPercent(workload?.performance_pct)} performance</span>
    </div>
  );
}

function CandidateRow({
  candidate,
  selected,
  suggested,
  autoSelected,
  onSelect,
  onToggleAuto,
  showAutoCheckbox,
}: {
  candidate: AssignmentCandidate;
  selected: boolean;
  suggested: boolean;
  autoSelected: boolean;
  onSelect: () => void;
  onToggleAuto: () => void;
  showAutoCheckbox: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 transition-colors",
        selected
          ? "border-brand-blue/50 bg-brand-blue/5"
          : "bg-card hover:bg-muted/40",
      )}
    >
      {showAutoCheckbox ? (
        <Checkbox
          checked={autoSelected}
          onCheckedChange={onToggleAuto}
          aria-label={`Include ${candidate.member.full_name} in auto-assign`}
          className="mt-0.5"
        />
      ) : null}
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={onSelect}
        aria-pressed={selected}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">
            {candidate.member.full_name}
          </p>
          <RoleBadge
            role={candidate.member.role}
            className="px-1.5 py-0 text-[0.65rem]"
          />
          {suggested ? (
            <Badge className="border-brand-green/30 bg-brand-green/10 text-brand-green">
              <Sparkles className="size-3" />
              Suggested
            </Badge>
          ) : null}
          <Badge variant="outline" className="ml-auto font-mono">
            {candidate.score.toFixed(1)}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {candidate.member.designation ||
            candidate.member.position ||
            candidate.member.dedicated_work ||
            "Team member"}
        </p>
        <div className="mt-1.5">
          <WorkloadSummary workload={candidate.workload} />
        </div>
        {candidate.reasons.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {candidate.reasons.map((reason) => (
              <span
                key={reason}
                className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] text-muted-foreground"
              >
                {reason}
              </span>
            ))}
          </div>
        ) : null}
      </button>
      {selected ? (
        <Check className="mt-1 size-4 shrink-0 text-brand-blue" />
      ) : null}
    </div>
  );
}

export function LeadAssignDialog({
  open,
  onOpenChange,
  leads,
  members,
  currentUserId,
}: LeadAssignDialogProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AssignmentMode | "manual">("manual");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoIds, setAutoIds] = useState<string[] | null>(null);

  const workloadsQuery = useQuery({
    queryKey: ["assignee-workload", members.map((member) => member.id)],
    enabled: open && members.length > 0,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("assignee_workload")
        .select("*");
      if (error) throw error;
      return (data ?? []) as AssigneeWorkload[];
    },
  });

  const candidates = useMemo(
    () =>
      rankAssignmentCandidates(
        members,
        workloadsQuery.data ?? [],
        leads[0] ?? {},
      ),
    [leads, members, workloadsQuery.data],
  );

  const effectiveSelectedId = selectedId ?? candidates[0]?.member.id ?? "";
  const effectiveAutoIds = useMemo(
    () => autoIds ?? candidates.map((candidate) => candidate.member.id),
    [autoIds, candidates],
  );
  const autoCandidates = useMemo(
    () =>
      candidates.filter((candidate) =>
        effectiveAutoIds.includes(candidate.member.id),
      ),
    [candidates, effectiveAutoIds],
  );

  const plan = useMemo(
    () =>
      mode === "manual"
        ? []
        : buildAssignmentPlan({
            leads,
            candidates: autoCandidates,
            mode,
          }),
    [autoCandidates, leads, mode],
  );

  const mutation = useMutation({
    mutationFn: async ({ assigneeId }: { assigneeId: string | null }) => {
      const supabase = createClient();
      const now = new Date().toISOString();

      if (mode === "manual") {
        const ids = leads.map((lead) => lead.id);
        const { error } = await supabase
          .from("leads")
          .update(
            assigneeId
              ? {
                  assigned_to: assigneeId,
                  assigned_by: currentUserId,
                  assigned_at: now,
                }
              : {
                  assigned_to: null,
                  assigned_by: null,
                  assigned_at: null,
                },
          )
          .in("id", ids);
        if (error) throw error;
        return;
      }

      if (plan.length !== leads.length) {
        throw new Error("Select at least one member for auto-assignment");
      }

      const groups = new Map<string, string[]>();
      for (const item of plan) {
        const ids = groups.get(item.candidate.member.id) ?? [];
        ids.push(item.lead.id);
        groups.set(item.candidate.member.id, ids);
      }

      for (const [memberId, leadIds] of groups) {
        const { error } = await supabase
          .from("leads")
          .update({
            assigned_to: memberId,
            assigned_by: currentUserId,
            assigned_at: now,
          })
          .in("id", leadIds);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(
        leads.length === 1
          ? "Lead assignment updated"
          : `${leads.length} leads assigned`,
      );
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["assignee-workload"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? friendlyAssignmentError(error.message)
          : "Assignment failed",
      );
    },
  });

  const selectedCandidate = candidates.find(
    (candidate) => candidate.member.id === effectiveSelectedId,
  );
  const canSubmit =
    mode === "manual"
      ? Boolean(selectedCandidate || effectiveSelectedId === "unassigned")
      : plan.length === leads.length && plan.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {leads.length === 1
              ? `Assign ${leads[0]?.client_name ?? "lead"}`
              : `Assign ${leads.length} leads`}
          </DialogTitle>
          <DialogDescription>
            Choose a member, or let workload and work focus guide the
            assignment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {leads.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "manual" ? "default" : "outline"}
                onClick={() => setMode("manual")}
              >
                One at a time
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "round_robin" ? "default" : "outline"}
                onClick={() => setMode("round_robin")}
              >
                <Wand2 className="size-3.5" />
                Round robin
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "least_loaded" ? "default" : "outline"}
                onClick={() => setMode("least_loaded")}
              >
                <Sparkles className="size-3.5" />
                Least loaded
              </Button>
            </div>
          ) : null}

          {workloadsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          ) : workloadsQuery.error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Workload data could not be loaded. You can still assign manually.
            </p>
          ) : null}

          {mode === "manual" ? (
            <ScrollArea className="max-h-[420px] pr-3">
              <div className="space-y-2">
                {candidates.map((candidate, index) => (
                  <CandidateRow
                    key={candidate.member.id}
                    candidate={candidate}
                    selected={candidate.member.id === effectiveSelectedId}
                    suggested={index === 0}
                    autoSelected={effectiveAutoIds.includes(
                      candidate.member.id,
                    )}
                    onSelect={() => setSelectedId(candidate.member.id)}
                    onToggleAuto={() => {
                      setAutoIds(
                        effectiveAutoIds.includes(candidate.member.id)
                          ? effectiveAutoIds.filter(
                              (id) => id !== candidate.member.id,
                            )
                          : [...effectiveAutoIds, candidate.member.id],
                      );
                    }}
                    showAutoCheckbox={false}
                  />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border bg-muted/30 p-3">
                <p className="text-sm font-medium">
                  Auto-assign across {effectiveAutoIds.length} selected member
                  {effectiveAutoIds.length === 1 ? "" : "s"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Uncheck anyone who should not receive these leads.
                </p>
              </div>
              <ScrollArea className="max-h-[300px] pr-3">
                <div className="space-y-2">
                  {candidates.map((candidate) => (
                    <CandidateRow
                      key={candidate.member.id}
                      candidate={candidate}
                      selected={false}
                      suggested={false}
                      autoSelected={effectiveAutoIds.includes(
                        candidate.member.id,
                      )}
                      onSelect={() => {
                        setAutoIds(
                          effectiveAutoIds.includes(candidate.member.id)
                            ? effectiveAutoIds.filter(
                                (id) => id !== candidate.member.id,
                              )
                            : [...effectiveAutoIds, candidate.member.id],
                        );
                      }}
                      onToggleAuto={() => {
                        setAutoIds(
                          effectiveAutoIds.includes(candidate.member.id)
                            ? effectiveAutoIds.filter(
                                (id) => id !== candidate.member.id,
                              )
                            : [...effectiveAutoIds, candidate.member.id],
                        );
                      }}
                      showAutoCheckbox
                    />
                  ))}
                </div>
              </ScrollArea>

              <div className="rounded-xl border">
                <div className="border-b bg-muted/30 px-3 py-2 text-xs font-medium">
                  Assignment preview
                </div>
                <ScrollArea className="max-h-48">
                  <div className="divide-y">
                    {plan.map((item) => (
                      <div
                        key={item.lead.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate">
                          {item.lead.client_name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {item.candidate.member.full_name}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}

          {leads.length === 1 && mode === "manual" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setSelectedId("unassigned")}
            >
              <UserMinus className="size-4" />
              Leave this lead unassigned
            </Button>
          ) : null}
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
            type="button"
            disabled={!canSubmit || mutation.isPending}
            onClick={() =>
              mutation.mutate({
                assigneeId:
                  mode === "manual" && effectiveSelectedId !== "unassigned"
                    ? effectiveSelectedId
                    : null,
              })
            }
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {mode === "manual" && effectiveSelectedId === "unassigned"
              ? "Clear assignee"
              : leads.length === 1
                ? "Assign lead"
                : `Assign ${leads.length} leads`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
