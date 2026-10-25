"use client";

import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarClock,
  GripVertical,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { useMemo } from "react";

import {
  TaskIncentiveBadge,
  TaskLeadChip,
  TaskOverdueBadge,
} from "@/components/tasks/task-badges";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TASK_TYPE_LABELS,
  type TaskStatus,
  type TaskType,
} from "@/lib/constants";
import { cn, formatDate, getInitials, isTaskOverdue } from "@/lib/utils";
import type { Lead, Profile, Task } from "@/types/database";

const BOARD_STATUSES = ["todo", "in_progress", "completed"] as const;
type BoardStatus = (typeof BOARD_STATUSES)[number];

const BOARD_COLUMNS: {
  status: BoardStatus;
  label: string;
  dot: string;
}[] = [
  { status: "todo", label: "To Be Done", dot: "bg-muted-foreground" },
  { status: "in_progress", label: "In Progress", dot: "bg-brand-blue" },
  { status: "completed", label: "Completed", dot: "bg-brand-green" },
];

function isBoardStatus(value: string): value is BoardStatus {
  return BOARD_STATUSES.includes(value as BoardStatus);
}

type TaskBoardProps = {
  tasks: Task[];
  profileMap: Map<string, Profile>;
  leadMap: Map<string, Lead>;
  currentUserId: string;
  canEdit: (task: Task) => boolean;
  canChangeStatus: (task: Task) => boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  pendingStatus: boolean;
  today: string;
};

type TaskCardProps = Omit<TaskBoardProps, "tasks"> & {
  task: Task;
};

function TaskCard({
  task,
  profileMap,
  leadMap,
  currentUserId,
  canEdit,
  canChangeStatus,
  onEdit,
  onDelete,
  pendingStatus,
  today,
}: TaskCardProps) {
  const overdue = isTaskOverdue(task, today);
  const canDrag = canChangeStatus(task) && !pendingStatus;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      disabled: !canDrag,
      data: { status: task.status },
    });
  const assignee = profileMap.get(task.assigned_to);
  const lead = task.lead_id ? leadMap.get(task.lead_id) : undefined;

  return (
    <div
      ref={setNodeRef}
      style={
        transform ? { transform: CSS.Translate.toString(transform) } : undefined
      }
      className={cn(
        "rounded-xl border bg-card p-3 text-sm shadow-xs transition-[box-shadow,opacity]",
        isDragging && "z-20 opacity-60 shadow-xl",
        overdue && "border-brand-red/30",
      )}
    >
      <div className="flex items-start gap-1.5">
        {canDrag ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="-ml-1 shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
            aria-label={`Move ${task.title}`}
            {...listeners}
            {...attributes}
          >
            <GripVertical className="size-4" />
          </Button>
        ) : (
          <span className="-ml-1 size-7 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-medium">{task.title}</p>
          {task.description ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {task.description}
            </p>
          ) : null}
        </div>
        {canEdit(task) ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1 shrink-0"
                aria-label="Task actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(task)}>
                Edit task
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(task)}
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-7">
        <Badge variant="secondary" className="whitespace-nowrap">
          {TASK_TYPE_LABELS[task.task_type as TaskType] ?? task.task_type}
        </Badge>
        <TaskOverdueBadge task={task} today={today} />
        {lead ? <TaskLeadChip lead={lead} /> : null}
      </div>

      {task.status === "completed" && task.incentive_amount > 0 ? (
        <div className="mt-2 pl-7">
          <TaskIncentiveBadge task={task} />
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2 pl-7 text-xs text-muted-foreground">
        <span
          className={cn(
            "inline-flex min-w-0 items-center gap-1",
            overdue && "font-medium text-brand-red",
          )}
        >
          <CalendarClock className="size-3.5 shrink-0" />
          <span className="truncate">
            {task.due_date ? formatDate(task.due_date) : "No due date"}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <Avatar className="size-5">
            <AvatarFallback className="bg-brand-gradient text-[0.6rem] text-white">
              {getInitials(
                assignee?.full_name ??
                  (task.assigned_to === currentUserId ? "You" : undefined),
              )}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-[110px] truncate">
            {assignee?.full_name ??
              (task.assigned_to === currentUserId ? "You" : "Unassigned")}
          </span>
        </span>
      </div>
    </div>
  );
}

type BoardColumnProps = {
  column: (typeof BOARD_COLUMNS)[number];
  tasks: Task[];
} & Omit<TaskBoardProps, "tasks">;

function BoardColumn({ column, tasks, ...props }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status });
  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }),
    [tasks],
  );

  return (
    <section
      ref={setNodeRef}
      aria-label={column.label}
      className={cn(
        "flex min-h-[430px] flex-col rounded-xl border bg-muted/30 p-2 transition-colors",
        isOver && "border-brand-blue bg-brand-blue/5 ring-2 ring-brand-blue/20",
      )}
    >
      <header className="mb-2 flex items-center gap-2 px-1 py-1">
        <span className={cn("size-2 rounded-full", column.dot)} />
        <h2 className="text-sm font-medium">{column.label}</h2>
        <Badge variant="outline" className="ml-auto px-1.5">
          {tasks.length}
        </Badge>
      </header>
      <div className="flex flex-1 flex-col gap-2">
        {sortedTasks.length === 0 ? (
          <div className="flex min-h-24 flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Drop tasks here
          </div>
        ) : (
          sortedTasks.map((task) => (
            <TaskCard key={task.id} task={task} {...props} />
          ))
        )}
      </div>
    </section>
  );
}

export function TaskBoard({ tasks, ...props }: TaskBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );
  const boardTasks = useMemo(
    () => tasks.filter((task) => isBoardStatus(task.status)),
    [tasks],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const taskId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    const task = boardTasks.find((item) => item.id === taskId);

    if (
      !task ||
      !overId ||
      !isBoardStatus(overId) ||
      task.status === overId ||
      !props.canChangeStatus(task)
    ) {
      return;
    }

    props.onStatusChange(task, overId);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {BOARD_COLUMNS.map((column) => (
          <BoardColumn
            key={column.status}
            column={column}
            tasks={boardTasks.filter((task) => task.status === column.status)}
            {...props}
          />
        ))}
      </div>
    </DndContext>
  );
}
