"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { RoleBadge } from "@/components/shared/role-badge";
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
import { useNow } from "@/hooks/use-now";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { getManagerCandidates } from "@/lib/team-hierarchy";
import type { Profile, SalaryConfig } from "@/types/database";

type MemberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: Profile | null;
  salaryConfig?: SalaryConfig | null;
  monthlyTarget?: number | null;
  profiles: Profile[];
  actorId: string;
  actorRole: Role;
};

export function MemberDialog({
  open,
  onOpenChange,
  member,
  salaryConfig,
  monthlyTarget,
  profiles,
  actorId,
  actorRole,
}: MemberDialogProps) {
  const queryClient = useQueryClient();
  const now = useNow();
  const [fullName, setFullName] = useState(member?.full_name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [role, setRole] = useState<Role>(
    (member?.role as Role | undefined) ??
      (actorRole === "owner" ? "employee" : "intern"),
  );
  const [designation, setDesignation] = useState(member?.designation ?? "");
  const [position, setPosition] = useState(member?.position ?? "");
  const [dedicatedWork, setDedicatedWork] = useState(
    member?.dedicated_work ?? "",
  );
  const [managerId, setManagerId] = useState(member?.manager_id ?? "");
  const [joinedOnOverride, setJoinedOn] = useState<string | null>(
    member?.joined_on ?? null,
  );
  const joinedOn =
    joinedOnOverride ?? (open && now ? format(now, "yyyy-MM-dd") : "");
  const [baseSalary, setBaseSalary] = useState(
    String(salaryConfig?.base_salary ?? 0),
  );
  const [salesPercent, setSalesPercent] = useState(
    String(salaryConfig?.sales_incentive_percent ?? 0),
  );
  const [target, setTarget] = useState(String(monthlyTarget ?? 0));
  const [isActive, setIsActive] = useState(member?.is_active ?? true);

  const isExistingOwner = member?.role === "owner";
  const allowedRoles = useMemo(() => {
    if (isExistingOwner) return ["owner"] as Role[];
    if (actorRole === "owner") {
      return ["manager", "employee", "intern"] as Role[];
    }
    return ["employee", "intern"] as Role[];
  }, [actorRole, isExistingOwner]);

  const actor = profiles.find((profile) => profile.id === actorId) ?? null;
  const managerCandidates = useMemo(
    () =>
      getManagerCandidates({
        profiles,
        actor,
        targetRole: role,
        editingId: member?.id,
      }),
    [actor, member?.id, profiles, role],
  );

  const requiresWorkDetails = role === "employee" || role === "intern";
  const missingWorkDetails =
    requiresWorkDetails && (!dedicatedWork.trim() || !position.trim());
  const fallbackManagerId = member
    ? (managerCandidates[0]?.id ?? "")
    : actorRole !== "owner" &&
        managerCandidates.some((candidate) => candidate.id === actorId)
      ? actorId
      : "";
  const effectiveManagerId =
    role === "owner"
      ? ""
      : managerCandidates.some((candidate) => candidate.id === managerId)
        ? managerId
        : fallbackManagerId;
  const missingManager = role !== "owner" && !effectiveManagerId;

  const mutation = useMutation({
    mutationFn: async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (missingManager) {
        throw new Error("Select who this member reports to");
      }

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
            manager_id: effectiveManagerId || null,
            joined_on: joinedOn || null,
            base_salary: Number(baseSalary) || 0,
            sales_incentive_percent: Number(salesPercent) || 0,
            monthly_target: Number(target) || 0,
          }),
        });
        const payload = (await response.json()) as { error?: string };
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
          role: isExistingOwner ? "owner" : role,
          designation: designation.trim() || null,
          position: position.trim() || null,
          dedicated_work: dedicatedWork.trim() || null,
          manager_id: isExistingOwner ? null : effectiveManagerId || null,
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

        const targetMonth = format(now ?? new Date(), "yyyy-MM-01");
        const { data: existingTarget, error: targetLookupError } =
          await supabase
            .from("targets")
            .select("id")
            .eq("user_id", member.id)
            .eq("month", targetMonth)
            .maybeSingle();
        if (targetLookupError) throw targetLookupError;

        const targetPayload = {
          user_id: member.id,
          month: targetMonth,
          target_amount: Number(target) || 0,
        };
        const { error: targetError } = existingTarget
          ? await supabase
              .from("targets")
              .update(targetPayload)
              .eq("id", existingTarget.id)
          : await supabase.from("targets").insert(targetPayload);
        if (targetError) throw targetError;
      }
    },
    onSuccess: () => {
      toast.success(member ? "Member updated" : "Member created");
      void queryClient.invalidateQueries({ queryKey: ["profiles"] });
      void queryClient.invalidateQueries({ queryKey: ["member-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["salary"] });
      void queryClient.invalidateQueries({ queryKey: ["targets"] });
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
          <DialogTitle>
            {member ? "Edit member" : "Add team member"}
          </DialogTitle>
          <DialogDescription>
            {member
              ? "Update role, reporting line, contact details and access."
              : "Create a login and place the new member in your team hierarchy."}
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
                disabled={isExistingOwner}
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
              {actorRole === "owner" ? (
                <p className="text-xs text-muted-foreground">
                  Owners can place managers anywhere; managers can add employees
                  and interns.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  You can add employees and interns to your own branch.
                </p>
              )}
            </div>
            {role !== "owner" ? (
              <div className="space-y-2">
                <Label>
                  Reports to
                  <span className="text-brand-red"> *</span>
                </Label>
                <Select
                  value={effectiveManagerId || undefined}
                  onValueChange={setManagerId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select reporting manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {managerCandidates.map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        <span className="flex items-center gap-2">
                          <span>{candidate.full_name}</span>
                          <RoleBadge
                            role={candidate.role}
                            className="px-1.5 py-0 text-[0.65rem]"
                          />
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {managerCandidates.length === 0 ? (
                  <p className="flex items-center gap-1.5 text-xs text-brand-red">
                    <AlertTriangle className="size-3.5" />
                    No valid reporting manager is available for this role.
                  </p>
                ) : null}
                {missingManager ? (
                  <p className="text-xs text-brand-red">
                    Reports-to is required for every non-owner member.
                  </p>
                ) : null}
              </div>
            ) : null}
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
              <Label htmlFor="member-position">
                Position
                {requiresWorkDetails ? (
                  <span className="text-brand-red"> *</span>
                ) : null}
              </Label>
              <Input
                id="member-position"
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                placeholder="Senior"
                required={requiresWorkDetails}
                aria-invalid={requiresWorkDetails && !position.trim()}
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
            <Label htmlFor="member-work">
              Dedicated work
              {requiresWorkDetails ? (
                <span className="text-brand-red"> *</span>
              ) : null}
            </Label>
            <Input
              id="member-work"
              value={dedicatedWork}
              onChange={(event) => setDedicatedWork(event.target.value)}
              placeholder="Inbound sales, client success..."
              required={requiresWorkDetails}
              aria-invalid={requiresWorkDetails && !dedicatedWork.trim()}
            />
            <p className="text-xs text-muted-foreground">
              Used by lead recommendations to match new leads with the right
              member.
            </p>
          </div>

          {actorRole === "owner" && !isExistingOwner ? (
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
              <div className="space-y-2">
                <Label htmlFor="member-target">Monthly target (₹)</Label>
                <Input
                  id="member-target"
                  type="number"
                  min="0"
                  step="1"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
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
                disabled={isExistingOwner}
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
                missingWorkDetails ||
                missingManager ||
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
