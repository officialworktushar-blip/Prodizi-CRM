"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfWeek, format, startOfWeek } from "date-fns";
import {
  CalendarClock,
  Columns3,
  LayoutList,
  ListChecks,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { LeadStatusDialog } from "@/components/tasks/lead-status-dialog";
import {
  TaskIncentiveBadge,
  TaskLeadChip,
} from "@/components/tasks/task-badges";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskDialog } from "@/components/tasks/task-dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/hooks/use-role";
import {
  ROLE_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  type LeadStatus,
  type Role,
  type TaskStatus,
  type TaskType,
} from "@/lib/constants";
import { canEditTask, isAdminRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import {
  cn,
  formatDate,
  getInitials,
  isTaskOverdue,
  todayISO,
} from "@/lib/utils";
import type { Lead, Profile, Task } from "@/types/database";

type TypeTab = "all" | "daily" | "weekly";
type ViewMode = "board" | "list";
type DueFilter = "all" | "overdue" | "today" | "week" | "none";

type StatusChange = {
  task: Task;
  status: TaskStatus;
  leadStatus?: LeadStatus;
};

type TaskRowProps = {
  task: Task;
  assignee: Profile | undefined;
  lead: Lead | undefined;
  canEdit: boolean;
  canChangeStatus: boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  pendingStatus: boolean;
};

function TaskStatusSelect({
  task,
  onStatusChange,
  disabled,
}: {
  task: Task;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  disabled: boolean;
}) {
  return (
    <Select
      value={task.status}
      onValueChange={(value) => onStatusChange(task, value as TaskStatus)}
      disabled={disabled}
    >
      <SelectTrigger size="sm" className="w-[132px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TASK_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {TASK_STATUS_LABELS[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TaskRow({
  task,
  assignee,
  lead,
  canEdit,
  canChangeStatus,
  onEdit,
  onDelete,
  onStatusChange,
  pendingStatus,
}: TaskRowProps) {
  const overdue = isTaskOverdue(task);

  return (
    <TableRow className={cn(overdue && "bg-brand-red/5")}>
      <TableCell className="max-w-[360px]">
        <div className="space-y-1.5">
          <p className="truncate font-medium">{task.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {task.description || "No description"}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {lead ? <TaskLeadChip lead={lead} /> : null}
            <TaskIncentiveBadge task={task} />
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="whitespace-nowrap">
          {TASK_TYPE_LABELS[task.task_type as TaskType] ?? task.task_type}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar className="size-7">
            <AvatarFallback className="bg-brand-gradient text-[0.65rem] text-white">
              {getInitials(assignee?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm">
              {assignee?.full_name ?? "Unassigned"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {assignee?.designation ??
                (assignee?.role ? ROLE_LABELS[assignee.role] : "")}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span
          className={overdue ? "text-sm font-medium text-brand-red" : "text-sm"}
        >
          {task.due_date ? formatDate(task.due_date) : "No due date"}
        </span>
      </TableCell>
      <TableCell>
        {canChangeStatus ? (
          <TaskStatusSelect
            task={task}
            onStatusChange={onStatusChange}
            disabled={pendingStatus}
          />
        ) : (
          <StatusBadge status={task.status} />
        )}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Task actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!canEdit} onClick={() => onEdit(task)}>
              Edit task
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={!canEdit}
              onClick={() => onDelete(task)}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export default function TasksPage() {
  const { profile, role, loading: roleLoading, error: roleError } = useRole();
  const isAdmin = isAdminRole(role);
  const queryClient = useQueryClient();
  const [typeTab, setTypeTab] = useState<TypeTab>("all");
  const [view, setView] = useState<ViewMode>("board");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [leadFilter, setLeadFilter] = useState("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [completionTask, setCompletionTask] = useState<Task | null>(null);
  const today = todayISO();
  const { weekStart, weekEnd } = useMemo(
    () => ({
      weekStart: format(
        startOfWeek(new Date(), { weekStartsOn: 1 }),
        "yyyy-MM-dd",
      ),
      weekEnd: format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
    }),
    [],
  );
  const tasksQueryKey = ["tasks", profile?.id, role] as const;

  const tasksQuery = useQuery({
    queryKey: tasksQueryKey,
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase.from("tasks").select("*");

      if (!isAdmin) {
        query = query.eq("assigned_to", profile!.id);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["profiles", "task-assignees"],
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

  const leadsQuery = useQuery({
    queryKey: ["leads", "task-links", profile?.id, role],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("client_name")
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });

  useEffect(() => {
    if (!profile?.id) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`tasks-live-${profile.id}-${isAdmin ? "admin" : "member"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          ...(isAdmin ? {} : { filter: `assigned_to=eq.${profile.id}` }),
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["tasks"] });
          void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAdmin, profile?.id, queryClient]);

  const statusMutation = useMutation({
    onMutate: async ({ task, status }: StatusChange) => {
      await queryClient.cancelQueries({ queryKey: tasksQueryKey });
      const previous = queryClient.getQueryData<Task[]>(tasksQueryKey);

      queryClient.setQueryData<Task[]>(tasksQueryKey, (old) =>
        old?.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status,
                completed_at:
                  status === "completed" ? new Date().toISOString() : null,
              }
            : item,
        ),
      );

      return { previous };
    },
    mutationFn: async ({ task, status, leadStatus }: StatusChange) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("tasks")
        .update({
          status,
          completed_at:
            status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", task.id);
      if (error) throw error;

      let warning: string | null = null;
      if (leadStatus && task.lead_id) {
        const { error: leadError } = await supabase
          .from("leads")
          .update({ status: leadStatus })
          .eq("id", task.lead_id);
        if (leadError) {
          warning = "Task completed, but the lead status could not be updated.";
        }
      }

      return { warning };
    },
    onSuccess: ({ warning }, variables) => {
      setCompletionTask(null);
      toast.success(
        variables.status === "completed"
          ? "Task completed"
          : "Task status updated",
      );
      if (warning) toast.error(warning);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["salary"] });
      if (variables.leadStatus) {
        void queryClient.invalidateQueries({ queryKey: ["leads"] });
        void queryClient.invalidateQueries({ queryKey: ["sales"] });
      }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tasksQueryKey, context.previous);
      }
      toast.error(error instanceof Error ? error.message : "Update failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (task: Task) => {
      const supabase = createClient();
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task deleted");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["salary"] });
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
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
  const leadMap = useMemo(
    () => new Map(leads.map((lead) => [lead.id, lead])),
    [leads],
  );

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const typeTasks = useMemo(
    () =>
      tasks.filter((task) => typeTab === "all" || task.task_type === typeTab),
    [tasks, typeTab],
  );

  const scopedTasks = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();

    return typeTasks.filter((task) => {
      if (
        isAdmin &&
        assigneeFilter !== "all" &&
        task.assigned_to !== assigneeFilter
      ) {
        return false;
      }

      if (leadFilter === "linked" && !task.lead_id) return false;
      if (leadFilter === "none" && task.lead_id) return false;
      if (
        leadFilter !== "all" &&
        leadFilter !== "linked" &&
        leadFilter !== "none" &&
        task.lead_id !== leadFilter
      ) {
        return false;
      }

      if (dueFilter === "overdue" && !isTaskOverdue(task)) return false;
      if (dueFilter === "today" && task.due_date !== today) return false;
      if (
        dueFilter === "week" &&
        (!task.due_date || task.due_date < weekStart || task.due_date > weekEnd)
      ) {
        return false;
      }
      if (dueFilter === "none" && task.due_date) return false;

      if (!needle) return true;

      const lead = task.lead_id ? leadMap.get(task.lead_id) : undefined;
      return (
        task.title.toLowerCase().includes(needle) ||
        (task.description ?? "").toLowerCase().includes(needle) ||
        (lead?.client_name ?? "").toLowerCase().includes(needle) ||
        (lead?.company ?? "").toLowerCase().includes(needle)
      );
    });
  }, [
    typeTasks,
    isAdmin,
    assigneeFilter,
    leadFilter,
    dueFilter,
    today,
    weekStart,
    weekEnd,
    deferredSearch,
    leadMap,
  ]);

  const counts = useMemo(
    () => ({
      all: scopedTasks.length,
      todo: scopedTasks.filter((task) => task.status === "todo").length,
      in_progress: scopedTasks.filter((task) => task.status === "in_progress")
        .length,
      completed: scopedTasks.filter((task) => task.status === "completed")
        .length,
      cancelled: scopedTasks.filter((task) => task.status === "cancelled")
        .length,
    }),
    [scopedTasks],
  );

  const filteredTasks = useMemo(
    () =>
      statusFilter === "all"
        ? scopedTasks
        : scopedTasks.filter((task) => task.status === statusFilter),
    [scopedTasks, statusFilter],
  );

  const dueTodayCount = tasks.filter(
    (task) =>
      task.due_date === today &&
      task.status !== "completed" &&
      task.status !== "cancelled",
  ).length;
  const overdueCount = tasks.filter(isTaskOverdue).length;

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

  const effectiveRole = role ?? (profile.role as Role);
  const canEdit = (task: Task) => canEditTask(effectiveRole, profile.id, task);
  const canChangeStatus = (task: Task) =>
    canEdit(task) && (isAdmin || task.assigned_to === profile.id);

  const openCreate = () => {
    setEditingTask(null);
    setDialogOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const requestStatusChange = (task: Task, status: TaskStatus) => {
    if (task.status === status) return;
    if (status === "completed" && task.lead_id) {
      setCompletionTask(task);
      return;
    }
    statusMutation.mutate({ task, status });
  };

  const confirmCompletion = (leadStatus: LeadStatus) => {
    if (!completionTask) return;
    statusMutation.mutate({
      task: completionTask,
      status: "completed",
      leadStatus,
    });
  };

  const renderTaskArea = () => {
    if (tasksQuery.error) {
      return (
        <ErrorState
          message="Tasks could not be loaded."
          onRetry={() => void tasksQuery.refetch()}
        />
      );
    }

    if (tasksQuery.isLoading) {
      return (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-2 rounded-xl border p-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      );
    }

    if (tasks.length === 0) {
      return (
        <EmptyState
          icon={ListChecks}
          title="No tasks yet"
          description="Create the first task to get the team moving."
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              New task
            </Button>
          }
        />
      );
    }

    if (view === "board" && statusFilter !== "cancelled") {
      return (
        <div className="space-y-2">
          <TaskBoard
            tasks={filteredTasks}
            profileMap={profileMap}
            leadMap={leadMap}
            currentUserId={profile.id}
            canEdit={canEdit}
            canChangeStatus={canChangeStatus}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
            onStatusChange={requestStatusChange}
            pendingStatus={statusMutation.isPending}
          />
          {statusFilter === "all" && counts.cancelled > 0 ? (
            <p className="text-xs text-muted-foreground">
              {counts.cancelled} cancelled{" "}
              {counts.cancelled === 1 ? "task is" : "tasks are"} hidden from the
              board.{" "}
              <button
                type="button"
                className="font-medium text-foreground underline underline-offset-2"
                onClick={() => {
                  setStatusFilter("cancelled");
                  setView("list");
                }}
              >
                View in list
              </button>
            </p>
          ) : null}
        </div>
      );
    }

    if (filteredTasks.length === 0) {
      return (
        <EmptyState
          icon={ListChecks}
          title="No matching tasks"
          description="Try a different status, member, due date, lead or search term."
        />
      );
    }

    return (
      <div className="overflow-x-auto rounded-xl border">
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Assigned to</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                assignee={
                  profileMap.get(task.assigned_to) ??
                  (task.assigned_to === profile.id ? profile : undefined)
                }
                lead={task.lead_id ? leadMap.get(task.lead_id) : undefined}
                canEdit={canEdit(task)}
                canChangeStatus={canChangeStatus(task)}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                onStatusChange={requestStatusChange}
                pendingStatus={statusMutation.isPending}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description={
          isAdmin
            ? "Assign, track and close work across the team."
            : "Your assigned work, due dates and incentives."
        }
        eyebrow="Work management"
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New task
          </Button>
        }
      />

      <Tabs
        value={typeTab}
        onValueChange={(value) => setTypeTab(value as TypeTab)}
        className="gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
          </TabsList>

          <div
            role="group"
            aria-label="Task view"
            className="inline-flex items-center rounded-lg border bg-background p-1"
          >
            <Button
              size="sm"
              variant={view === "board" ? "secondary" : "ghost"}
              aria-pressed={view === "board"}
              disabled={statusFilter === "cancelled"}
              onClick={() => setView("board")}
            >
              <Columns3 className="size-4" />
              Board
            </Button>
            <Button
              size="sm"
              variant={view === "list" ? "secondary" : "ghost"}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <LayoutList className="size-4" />
              List
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="px-4">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
              <div className="relative md:col-span-2">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search tasks or leads..."
                  className="pl-9"
                />
              </div>

              {isAdmin ? (
                <Select
                  value={assigneeFilter}
                  onValueChange={setAssigneeFilter}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All members" />
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

              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  const next = value as "all" | TaskStatus;
                  setStatusFilter(next);
                  if (next === "cancelled") setView("list");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All statuses ({counts.all})
                  </SelectItem>
                  {TASK_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {TASK_STATUS_LABELS[status]} ({counts[status]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={dueFilter}
                onValueChange={(value) => setDueFilter(value as DueFilter)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any due date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any due date</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="today">Due today</SelectItem>
                  <SelectItem value="week">This week</SelectItem>
                  <SelectItem value="none">No due date</SelectItem>
                </SelectContent>
              </Select>

              <Select value={leadFilter} onValueChange={setLeadFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any lead</SelectItem>
                  <SelectItem value="linked">Linked to a lead</SelectItem>
                  <SelectItem value="none">Not linked</SelectItem>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.client_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <TabsContent value={typeTab} className="mt-0 flex-1">
          {renderTaskArea()}
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarClock className="size-3.5" />
          {dueTodayCount} due today
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5",
            overdueCount > 0 && "font-medium text-brand-red",
          )}
        >
          {overdueCount} overdue
        </span>
        <Link href="/dashboard" className="hover:text-foreground">
          Back to dashboard
        </Link>
      </div>

      <TaskDialog
        key={`${dialogOpen ? (editingTask?.id ?? "new") : "closed"}`}
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setEditingTask(null);
        }}
        task={editingTask}
        profiles={profiles.length > 0 ? profiles : [profile]}
        leads={leads}
        currentUserId={profile.id}
        canAssign={isAdmin}
      />

      <LeadStatusDialog
        key={`${completionTask?.id ?? "closed"}-${completionTask?.lead_id ?? ""}`}
        open={Boolean(completionTask)}
        onOpenChange={(next) => {
          if (!next) setCompletionTask(null);
        }}
        task={completionTask}
        lead={
          completionTask?.lead_id
            ? leadMap.get(completionTask.lead_id)
            : undefined
        }
        pending={statusMutation.isPending}
        onConfirm={confirmCompletion}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.title}&rdquo; will be permanently removed.
              This cannot be undone.
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
