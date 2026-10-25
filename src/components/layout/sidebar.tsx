"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

import { useRole } from "@/hooks/use-role";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type SidebarContentProps = {
  className?: string;
  onNavigate?: () => void;
};

export function SidebarContent({ className, onNavigate }: SidebarContentProps) {
  const pathname = usePathname();
  const { role } = useRole();
  const navItems = NAV_ITEMS.filter(
    (item) => !item.roles || (role && item.roles.includes(role)),
  );

  return (
    <div className={cn("flex h-full flex-col gap-6 p-4", className)}>
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-xl px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm">
          <Image
            src="/logo.png"
            alt="Prodigi logo"
            width={40}
            height={40}
            className="size-10 object-cover"
            priority
          />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-base font-semibold tracking-tight">Prodigi</span>
          <span className="text-xs font-medium text-muted-foreground">
            Company CRM
          </span>
        </span>
      </Link>

      <nav aria-label="Main navigation" className="flex-1">
        <p className="mb-2 px-3 text-[0.68rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Workspace
        </p>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                    active &&
                      "bg-sidebar-accent text-foreground shadow-xs dark:bg-sidebar-accent",
                  )}
                >
                  {active ? (
                    <span className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-gradient" />
                  ) : null}
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span>{item.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-xs">
        <div className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" />
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <p className="text-sm font-semibold">Built for growth</p>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Track every lead, task and rupee earned by your team.
        </p>
      </div>
    </div>
  );
}

export function Sidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-sidebar lg:block",
        className,
      )}
    >
      <SidebarContent />
    </aside>
  );
}
