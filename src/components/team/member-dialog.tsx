"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
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
import { Switch } from "@/components/ui/switch";
import {
  ROLES,
  ROLE_LABELS,
  type Role,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Profile, SalaryConfig } from "@/types/database";

type MemberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: Profile | null;
  salaryConfig?: SalaryConfig | null;
  actorRole: Role;
};

export function MemberDialog({
  open,
  onOpenChange,
  member,
  salaryConfig,
  actorRole,
}: MemberDialogProps) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(member?.full_name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [role, setRole] = useState<Role>(
    (member?.role as Role | undefined) ?? "employee",
  );
  const [designation, setDesignation] = useState(member?.designation ?? "");
  const [position, setPosition] = useState(member?.position ?? "");
  const [dedicatedWork, setDedicatedWork] = useState(
    member?.dedicated_work ?? "",
  );
  const [joinedOn, setJoinedOn] = useState(
    member?.joined_on ?? format(new Date(), "yyyy-MM-dd"),
  );
  const [baseSalary, setBaseSalary] = useState(
    String(salaryConfig?.base_salary ?? 0),
  );
  const [salesPercent, setSalesPercent] = useState(
    String(salaryConfig?.sales_incentive_percent ?? 0),
  );
  const [isActive, setIsActive] = useState(member?.is_active ?? true);

  const allowedRoles =
    actorRole === "owner"
      ? ROLES
      : ROLES.filter((item) => item === "employee" || item === "intern");

  const mutation = useMutation({
    mutationFn: async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!member) {
        const response = await fetch("/api/admin/create-member", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: fullName.trim(),
            email: email.trim(),
            password,
            phone: phone.trim() || null,
            role,
            designation: designation.trim() || null,
            position: position.trim() || null,
            dedicated_work: dedicatedWork.trim() || null,
            joined_on: joinedOn || null,
            base_salary: Number(baseSalary) || 0,
            sales_incentive_percent: Number(salesPercent) || 0,
          }),
        });
        const payload = (await response.json()) as {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Could not create member");
        }
        return;
      }

      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          role,
          designation: designation.trim() || null,
          position: position.trim() || null,
          dedicated_work: dedicatedWork.trim() || null,
          joined_on: joinedOn || null,
          is_active: isActive,
        })
        .eq("id", member.id);
      if (error) throw error;

      if (actorRole === "owner") {
        const { error: salaryError } = await supabase
          .from("salary_config")
          .upsert({
            user_id: member.id,
            base_salary: Number(baseSalary) || 0,
            sales_incentive_percent: Number(salesPercent) || 0,
          });
        if (salaryError) throw salaryError;
      }
    },
    onSuccess: () => {
      toast.success(member ? "Member updated" : "Member created");
      void queryClient.invalidateQueries({ queryKey: ["profiles"] });
      void queryClient.invalidateQueries({ queryKey: ["member-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["salary"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Save failed");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{member ? "Edit member" : "Add team member"}</DialogTitle>
          <DialogDescription>
            {member
              ? "Update role, contact details and access."
              : "Create a login and profile for a new member."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => mutation.mutate(event)}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="member-name">Full name</Label>
              <Input
                id="member-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-email">Email</Label>
              <Input
                id="member-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={Boolean(member)}
                required
              />
            </div>
            {!member ? (
              <div className="space-y-2">
                <Label htmlFor="member-password">Temporary password</Label>
                <Input
                  id="member-password"
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  required
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="member-phone">Phone</Label>
              <Input
                id="member-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as Role)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedRoles.map((item) => (
                    <SelectItem key={item} value={item}>
                      {ROLE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-designation">Designation</Label>
              <Input
                id="member-designation"
                value={designation}
                onChange={(event) => setDesignation(event.target.value)}
                placeholder="Sales Executive"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-position">Position</Label>
              <Input
                id="member-position"
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                placeholder="Senior"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-joined">Joined on</Label>
              <Input
                id="member-joined"
                type="date"
                value={joinedOn}
                onChange={(event) => setJoinedOn(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-work">Dedicated work</Label>
            <Input
              id="member-work"
              value={dedicatedWork}
              onChange={(event) => setDedicatedWork(event.target.value)}
              placeholder="Inbound sales, client success..."
            />
          </div>

          {actorRole === "owner" ? (
            <div className="grid gap-4 rounded-xl border bg-muted/30 p-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="member-base">Base salary (₹/month)</Label>
                <Input
                  id="member-base"
                  type="number"
                  min="0"
                  step="1"
                  value={baseSalary}
                  onChange={(event) => setBaseSalary(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-percent">Sales incentive (%)</Label>
                <Input
                  id="member-percent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={salesPercent}
                  onChange={(event) => setSalesPercent(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          {member ? (
            <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
              <Switch
                id="member-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <div>
                <Label htmlFor="member-active">Active member</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive members cannot sign in.
                </p>
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
              disabled={
                mutation.isPending ||
                !fullName.trim() ||
                (!member && (!email.trim() || password.length < 8))
              }
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {member ? "Save changes" : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
