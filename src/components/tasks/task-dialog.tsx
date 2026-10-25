"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TASK_TYPES, TASK_TYPE_LABELS, type TaskType } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Lead, Profile, Task } from "@/types/database";

type TaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  profiles: Profile[];
  leads: Lead[];
  currentUserId: string;
  canAssign: boolean;
};

function getSaveError(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    const message =
      typeof candidate.message === "string" && candidate.message
        ? candidate.message
        : "Task save failed";
    const description = [
      typeof candidate.code === "string" && candidate.code
        ? `Code: ${candidate.code}`
        : null,
      typeof candidate.details === "string" && candidate.details
        ? candidate.details
        : null,
      typeof candidate.hint === "string" && candidate.hint
        ? candidate.hint
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return { message, description: description || undefined };
  }

  return {
    message: typeof error === "string" && error ? error : "Task save failed",
    description: undefined,
  };
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  profiles,
  leads,
  currentUserId,
  canAssign,
}: TaskDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [taskType, setTaskType] = useState<TaskType>(
    (task?.task_type as TaskType | undefined) ?? "one_time",
  );
  const [assignedTo, setAssignedTo] = useState(
    task?.assigned_to ?? currentUserId,
  );
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [leadId, setLeadId] = useState(task?.lead_id ?? "none");
  const [incentive, setIncentive] = useState(
    String(task?.incentive_amount ?? 0),
  );

  const mutation = useMutation({
    mutationFn: async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const supabase = createClient();
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        task_type: taskType,
        lead_id: leadId === "none" ? null : leadId,
        due_date: dueDate || null,
      };

      if (task) {
        const { error } = await supabase
          .from("tasks")
          .update({
            ...payload,
            ...(canAssign
              ? {
                  assigned_to: assignedTo,
                  incentive_amount: Number(incentive) || 0,
                }
              : {}),
          })
          .eq("id", task.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("tasks")
        .insert({
          ...payload,
          assigned_to: canAssign ? assignedTo : currentUserId,
          created_by: currentUserId,
          incentive_amount: canAssign ? Number(incentive) || 0 : 0,
        })
        .select()
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(task ? "Task updated" : "Task created");
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["salary"] });
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      onOpenChange(false);
    },
    onError: (error) => {
      const { message, description } = getSaveError(error);
      toast.error(message, { description });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            {canAssign
              ? "Assign work to a team member, link a lead and set its incentive."
              : "Create a task for yourself or link it to one of your leads."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => mutation.mutate(event)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Follow up with the client"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add context or next steps"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Linked lead</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No lead" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No lead</SelectItem>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.client_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={taskType}
                onValueChange={(value) => setTaskType(value as TaskType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {TASK_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>
          {canAssign ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Assigned to</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-incentive">Incentive (₹)</Label>
                <Input
                  id="task-incentive"
                  type="number"
                  min="0"
                  step="1"
                  value={incentive}
                  onChange={(event) => setIncentive(event.target.value)}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !title.trim()}
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {task ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
