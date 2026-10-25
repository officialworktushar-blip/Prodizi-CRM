import { Target, Trophy } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn, formatINR, isTaskOverdue } from "@/lib/utils";
import type { Lead, Task } from "@/types/database";

export function TaskLeadChip({
  lead,
  className,
}: {
  lead: Lead;
  className?: string;
}) {
  return (
    <Link
      href={`/leads/${lead.id}`}
      className={cn("inline-flex max-w-[220px]", className)}
      title={[lead.client_name, lead.company].filter(Boolean).join(" - ")}
    >
      <Badge
        variant="outline"
        className="min-w-0 gap-1 border-brand-blue/20 bg-brand-blue/5 text-brand-blue hover:bg-brand-blue/10"
      >
        <Target className="size-3 shrink-0" />
        <span className="truncate">{lead.client_name}</span>
      </Badge>
    </Link>
  );
}

export function TaskIncentiveBadge({ task }: { task: Task }) {
  if (task.status !== "completed" || task.incentive_amount <= 0) return null;

  return (
    <Badge
      variant="outline"
      className="h-auto gap-1 border-brand-green/25 bg-brand-green/10 py-1 text-brand-green"
    >
      <Trophy className="size-3 shrink-0" />+{formatINR(task.incentive_amount)}{" "}
      incentive earned
    </Badge>
  );
}

export function TaskOverdueBadge({
  task,
  today,
}: {
  task: Task;
  today: string;
}) {
  if (!isTaskOverdue(task, today)) return null;

  return (
    <Badge
      variant="outline"
      className="border-brand-red/25 bg-brand-red/10 text-brand-red"
    >
      Overdue
    </Badge>
  );
}
