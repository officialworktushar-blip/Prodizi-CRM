import type { LucideIcon } from "lucide-react";
import { LayoutDashboard } from "lucide-react";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

type PagePlaceholderProps = {
  title: string;
  description: string;
  icon?: LucideIcon;
  eyebrow?: string;
};

export function PagePlaceholder({
  title,
  description,
  icon: Icon = LayoutDashboard,
  eyebrow = "Prodigi CRM",
}: PagePlaceholderProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-brand-gradient" />
          <p className="text-[0.68rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {description}
        </p>
      </div>

      <Card className="border-dashed bg-card/60 shadow-none">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm">
            <Icon className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">Nothing here yet</p>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              This page is scaffolded and ready for the next phase.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
