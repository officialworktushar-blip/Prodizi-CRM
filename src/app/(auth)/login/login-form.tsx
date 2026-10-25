"use client";

import { ArrowRight, CheckCircle2, Loader2, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNow } from "@/hooks/use-now";
import { createClient } from "@/lib/supabase/client";

type LoginFormProps = {
  redirectTo?: string;
  reason?: string;
};

export function LoginForm({ redirectTo, reason }: LoginFormProps) {
  const router = useRouter();
  const now = useNow();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    reason === "inactive"
      ? "Your account has been deactivated. Contact an owner."
      : reason === "not-configured"
        ? "Supabase is not configured yet. Add your environment variables."
        : reason === "link-expired"
          ? "That reset link is invalid or has expired. Request a new one."
          : null,
  );
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const destination =
      redirectTo &&
      redirectTo.startsWith("/") &&
      !redirectTo.startsWith("//")
        ? redirectTo
        : "/dashboard";
    router.replace(destination);
    router.refresh();
  };

  return (
    <>
      <form
        className="space-y-4"
        aria-label="Sign in"
        onSubmit={onSubmit}
      >
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@prodigi.in"
              className="pl-9"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              className="pl-9"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
        </div>

        <Button type="submit" className="h-10 w-full" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          Sign in
          {!loading ? <ArrowRight className="size-4" /> : null}
        </Button>
      </form>

      <div className="mt-6 flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-brand-green" />
        <p>
          Accounts are created by an owner or manager. Ask your administrator if
          you need access.
        </p>
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        © {now?.getFullYear() ?? ""} Prodigi. Internal use only.
      </p>
    </>
  );
}
