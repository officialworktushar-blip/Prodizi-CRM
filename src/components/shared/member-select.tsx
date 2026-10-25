"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AssigneeWorkload, Profile } from "@/types/database";

type MemberSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  members: Profile[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  includeAll?: boolean;
  allLabel?: string;
  includeUnassigned?: boolean;
  roles?: Role[];
  workloads?: AssigneeWorkload[];
  suggestedIds?: string[];
};

export function MemberSelect({
  value,
  onValueChange,
  members,
  placeholder = "Select member",
  disabled,
  className,
  includeAll,
  allLabel = "My whole team",
  includeUnassigned,
  roles,
  workloads = [],
  suggestedIds = [],
}: MemberSelectProps) {
  const workloadMap = new Map(
    workloads
      .filter((row) => row.user_id)
      .map((row) => [row.user_id as string, row]),
  );
  const filtered = roles
    ? members.filter((member) => roles.includes(member.role))
    : members;

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeAll ? <SelectItem value="all">{allLabel}</SelectItem> : null}
        {includeUnassigned ? (
          <SelectItem value="unassigned">Unassigned</SelectItem>
        ) : null}
        {filtered.map((member) => {
          const workload = workloadMap.get(member.id);
          return (
            <SelectItem key={member.id} value={member.id}>
              <span className="flex items-center gap-2">
                <span>{member.full_name}</span>
                <span className="text-xs text-muted-foreground">
                  {ROLE_LABELS[member.role]}
                </span>
                {suggestedIds.includes(member.id) ? (
                  <span className="text-[0.65rem] font-medium text-brand-green">
                    Suggested
                  </span>
                ) : null}
                {workload ? (
                  <span className="text-[0.65rem] text-muted-foreground">
                    {workload.open_leads ?? 0} open
                  </span>
                ) : null}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
