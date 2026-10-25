"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarDays,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/hooks/use-role";
import { ROLE_LABELS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { formatDate, getInitials } from "@/lib/utils";

export function ProfileClient() {
  const { profile, role, loading, error } = useRole();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  if (profile?.id && initializedFor !== profile.id) {
    setInitializedFor(profile.id);
    setFullName(profile.full_name);
    setPhone(profile.phone ?? "");
  }

  const profileMutation = useMutation({
    mutationFn: async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!profile) throw new Error("Missing profile");
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
        })
        .eq("id", profile.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      void queryClient.invalidateQueries({ queryKey: ["current-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["profiles"] });
      void queryClient.invalidateQueries({ queryKey: ["member-stats"] });
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : "Update failed",
      );
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!profile?.email) throw new Error("Missing email");
      if (newPassword.length < 8) {
        throw new Error("New password must be at least 8 characters");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("New passwords do not match");
      }

      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });
      if (verifyError) throw new Error("Current password is incorrect");

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : "Password change failed",
      );
    },
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message="We could not verify your profile." />;
  }

  if (!profile) {
    return (
      <ErrorState
        title="Profile not found"
        message="Your account has no profile record. Contact an owner."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Your personal details and account security."
        eyebrow="Account"
      />

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="size-16">
            {profile.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
            ) : null}
            <AvatarFallback className="bg-brand-gradient text-xl font-semibold text-white">
              {getInitials(profile.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{profile.full_name}</h2>
              <Badge variant="secondary">{ROLE_LABELS[profile.role]}</Badge>
              {profile.is_active ? (
                <Badge
                  variant="outline"
                  className="border-brand-green/25 bg-brand-green/10 text-brand-green"
                >
                  Active
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-brand-red/25 bg-brand-red/10 text-brand-red"
                >
                  Inactive
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile.designation || profile.position || "Prodigi team member"}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {profile.email ? (
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5" />
                  {profile.email}
                </span>
              ) : null}
              {profile.phone ? (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5" />
                  {profile.phone}
                </span>
              ) : null}
              {profile.joined_on ? (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" />
                  Joined {formatDate(profile.joined_on)}
                </span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-4" />
              Personal details
            </CardTitle>
            <CardDescription>
              Update the name and phone number shown to your team.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => profileMutation.mutate(event)}
            >
              <div className="space-y-2">
                <Label htmlFor="profile-name">Full name</Label>
                <Input
                  id="profile-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-phone">Phone</Label>
                <Input
                  id="profile-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={profile.email ?? ""} disabled />
                <p className="text-xs text-muted-foreground">
                  Email changes are handled by an owner.
                </p>
              </div>
              <Button
                type="submit"
                disabled={profileMutation.isPending || !fullName.trim()}
              >
                {profileMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Save changes
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-4" />
              Change password
            </CardTitle>
            <CardDescription>
              Use at least 8 characters for your new password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => passwordMutation.mutate(event)}
            >
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) =>
                    setCurrentPassword(event.target.value)
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirm new password</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  required
                />
              </div>
              <Button type="submit" disabled={passwordMutation.isPending}>
                {passwordMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Update password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="size-4" />
            Work details
          </CardTitle>
          <CardDescription>
            Managed by your owner or manager.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Designation</p>
              <p className="mt-0.5 font-medium">
                {profile.designation ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Position</p>
              <p className="mt-0.5 font-medium">{profile.position ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dedicated work</p>
              <p className="mt-0.5 font-medium">
                {profile.dedicated_work ?? "—"}
              </p>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-brand-green" />
            Role and salary settings can only be changed by an owner
            {role === "manager" ? " or manager" : ""}.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
