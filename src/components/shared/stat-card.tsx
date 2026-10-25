import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const accentClasses = {
  blue: "bg-brand-blue/10 text-brand-blue",
  green: "bg-brand-green/10 text-brand-green",
  orange: "bg-brand-orange/10 text-brand-orange",
  teal: "bg-brand-teal/10 text-brand-teal",
  red: "bg-brand-red/10 text-brand-red",
} as const;

type StatCardProps = {
  title: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent?: keyof typeof accentClasses;
  className?: string;
};

export function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  accent = "blue",
  className,
}: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden shadow-xs", className)}>
      <CardContent className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            accentClasses[accent],
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 truncate text-xl font-semibold tracking-tight">
            {value}
          </p>
          {hint ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {hint}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
