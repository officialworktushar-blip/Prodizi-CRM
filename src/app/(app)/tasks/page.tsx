"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarClock,
  ListChecks,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { useRole } from "@/hooks/use-role";
import {
  ROLE_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  type Role,
  type TaskStatus,
  type TaskType,
} from "@/lib/constants";
import { canEditTask, isAdminRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { formatDate, getInitials, todayISO } from "@/lib/utils";
import type { Profile, Task } from "@/types/database";

type TaskRowProps = {
  task: Task;
  assignee: Profile | undefined;
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
  canEdit,
  canChangeStatus,
  onEdit,
  onDelete,
  onStatusChange,
  pendingStatus,
}: TaskRowProps) {
  const overdue =
    task.due_date &&
    task.due_date < todayISO() &&
    task.status !== "completed" &&
    task.status !== "cancelled";

  return (
    <TableRow>
      <TableCell className="max-w-[320px]">
        <div className="min-w-0">
          <p className="truncate font-medium">{task.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {task.description || "No description"}
          </p>
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
          className={
            overdue ? "text-sm font-medium text-brand-red" : "text-sm"
          }
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
              <span className="text-lg leading-none">···</span>
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
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const tasksQuery = useQuery({
    queryKey: ["tasks", profile?.id, role],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase.from("tasks").select("*");

      if (!isAdmin) {
        query = query.or(
          `assigned_to.eq.${profile!.id},created_by.eq.${profile!.id}`,
        );
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

  const statusMutation = useMutation({
    mutationFn: async ({
      task,
      status,
    }: {
      task: Task;
      status: TaskStatus;
    }) => {
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
    },
    onSuccess: () => {
      toast.success("Task status updated");
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["salary"] });
    },
    onError: (error) => {
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
      void queryClient.invalidateQueries({ queryKey: ["salary"] });
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

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const filteredTasks = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (
        isAdmin &&
        assigneeFilter !== "all" &&
        task.assigned_to !== assigneeFilter
      ) {
        return false;
      }
      if (!needle) return true;
      return (
        task.title.toLowerCase().includes(needle) ||
        (task.description ?? "").toLowerCase().includes(needle)
      );
    });
  }, [tasks, statusFilter, assigneeFilter, search, isAdmin]);

  const counts = useMemo(
    () => ({
      all: tasks.length,
      todo: tasks.filter((task) => task.status === "todo").length,
      in_progress: tasks.filter((task) => task.status === "in_progress").length,
      completed: tasks.filter((task) => task.status === "completed").length,
      cancelled: tasks.filter((task) => task.status === "cancelled").length,
    }),
    [tasks],
  );

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

  const openCreate = () => {
    setEditingTask(null);
    setDialogOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setDialogOpen(true);
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

      <div className="flex flex-wrap gap-2">
        {(["all", ...TASK_STATUSES] as const).map((status) => (
          <Button
            key={status}
            size="sm"
            variant={statusFilter === status ? "default" : "outline"}
            onClick={() => setStatusFilter(status)}
          >
            {status === "all" ? "All tasks" : TASK_STATUS_LABELS[status]}
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
                placeholder="Search tasks..."
                className="pl-9"
              />
            </div>
            {isAdmin ? (
              <Select
                value={assigneeFilter}
                onValueChange={setAssigneeFilter}
              >
                <SelectTrigger className="w-full sm:w-[210px]">
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
          </div>

          {tasksQuery.error ? (
            <ErrorState
              message="Tasks could not be loaded."
              onRetry={() => void tasksQuery.refetch()}
            />
          ) : tasksQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title={tasks.length === 0 ? "No tasks yet" : "No matching tasks"}
              description={
                tasks.length === 0
                  ? "Create the first task to get the team moving."
                  : "Try a different status, assignee or search term."
              }
              action={
                tasks.length === 0 ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="size-4" />
                    New task
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
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
                  {filteredTasks.map((task) => {
                    const canEdit = canEditTask(
                      role ?? (profile.role as Role),
                      profile.id,
                      task,
                    );
                    const canChange =
                      canEdit &&
                      (isAdmin || task.assigned_to === profile.id);
                    return (
                      <TaskRow
                        key={task.id}
                        task={task}
                        assignee={
                          profileMap.get(task.assigned_to) ??
                          (task.assigned_to === profile.id ? profile : undefined)
                        }
                        canEdit={canEdit}
                        canChangeStatus={canChange}
                        onEdit={openEdit}
                        onDelete={setDeleteTarget}
                        onStatusChange={(item, status) =>
                          statusMutation.mutate({ task: item, status })
                        }
                        pendingStatus={statusMutation.isPending}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarClock className="size-3.5" />
          {tasks.filter((task) => task.due_date === format(new Date(), "yyyy-MM-dd")).length}{" "}
          due today
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
