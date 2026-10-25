import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Prodigi CRM.",
};

const highlights = [
  { icon: Target, label: "Pipeline visibility from lead to close" },
  { icon: TrendingUp, label: "Targets, incentives and salary in one place" },
  { icon: Users, label: "One workspace for the whole team" },
];

export default function LoginPage() {
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

            <form className="space-y-4" aria-label="Sign in">
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
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/login"
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
                    placeholder="••••••••"
                    className="pl-9"
                  />
                </div>
              </div>

              <Button type="button" className="h-10 w-full">
                Sign in
                <ArrowRight className="size-4" />
              </Button>
            </form>

            <div className="mt-6 flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-brand-green" />
              <p>
                Accounts are created by an owner or manager. Ask your
                administrator if you need access.
              </p>
            </div>

            <p className="mt-8 text-center text-xs text-muted-foreground">
              © Prodigi. Internal use only.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
