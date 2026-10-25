import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import {
  Lock,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Prodigi CRM.",
};

const highlights = [
  { icon: Target, label: "Pipeline visibility from lead to close" },
  { icon: TrendingUp, label: "Targets, incentives and salary in one place" },
  { icon: Users, label: "One workspace for the whole team" },
];

type LoginPageProps = {
  searchParams: Promise<{ redirectTo?: string; reason?: string }>;
};

async function LoginFormWithParams({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return <LoginForm redirectTo={params.redirectTo} reason={params.reason} />;
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <section className="bg-brand-gradient relative hidden overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.22),transparent_38%),radial-gradient(circle_at_80%_90%,rgba(0,0,0,0.22),transparent_45%)]" />
        <div className="absolute -top-24 -right-24 size-72 rounded-full border border-white/20" />
        <div className="absolute top-1/3 -right-12 size-44 rounded-full border border-white/15" />
        <div className="absolute bottom-0 left-0 size-64 rounded-full bg-white/5 blur-2xl" />

        <div className="relative flex items-center gap-3">
          <span className="flex size-12 items-center justify-center overflow-hidden rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur-sm">
            <Image
              src="/logo.png"
              alt="Prodigi logo"
              width={48}
              height={48}
              className="size-12 object-cover"
              priority
            />
          </span>
          <div>
            <p className="text-lg font-semibold text-white">Prodigi</p>
            <p className="text-sm text-white/70">Company CRM</p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/25 backdrop-blur-sm">
            <TrendingUp className="size-3.5" />
            Built for growing teams
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white xl:text-5xl">
            Grow every deal.
            <br />
            Together.
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/80">
            Prodigi brings leads, tasks, sales, targets and compensation into a
            single focused workspace.
          </p>

          <ul className="mt-8 space-y-3">
            {highlights.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-3 text-sm text-white/90"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <item.icon className="size-4" />
                </span>
                {item.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-white/60">
          <ShieldCheck className="size-4" />
          Private workspace. Access is granted by your owner or manager.
        </div>
      </section>

      <section className="relative flex flex-col bg-background">
        <div className="flex items-center gap-3 border-b p-5 lg:hidden">
          <Image
            src="/logo.png"
            alt="Prodigi logo"
            width={36}
            height={36}
            className="size-9 rounded-xl"
            priority
          />
          <div>
            <p className="text-sm font-semibold">Prodigi</p>
            <p className="text-xs text-muted-foreground">Company CRM</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Lock className="size-5" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Welcome back
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign in to your Prodigi workspace.
              </p>
            </div>

            <Suspense fallback={<LoginFormSkeleton />}>
              <LoginFormWithParams searchParams={searchParams} />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}
