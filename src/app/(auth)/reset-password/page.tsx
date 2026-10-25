import type { Metadata } from "next";
import { Lock } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

async function ResetPasswordContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <div className="mb-6">
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Lock className="size-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Choose a new password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user
            ? "Use at least 8 characters, then sign in with your new password."
            : "This reset link is invalid or has expired."}
        </p>
      </div>
      {user ? (
        <ResetPasswordForm />
      ) : (
        <Button asChild className="w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      )}
    </>
  );
}

function ResetPasswordSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="size-11 rounded-xl" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-5 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <Suspense fallback={<ResetPasswordSkeleton />}>
          <ResetPasswordContent />
        </Suspense>
      </div>
    </main>
  );
}
