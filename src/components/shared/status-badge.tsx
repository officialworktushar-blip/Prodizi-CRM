import { Badge } from "@/components/ui/badge";
import {
  LEAD_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  type LeadStatus,
  type PaymentStatus,
  type TaskStatus,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: string | null | undefined;
  className?: string;
};

const styles: Record<string, string> = {
  upcoming: "border-brand-teal/25 bg-brand-teal/10 text-brand-teal",
  pending: "border-brand-orange/25 bg-brand-orange/10 text-[#b56d00] dark:text-brand-orange",
  ongoing: "border-brand-blue/25 bg-brand-blue/10 text-brand-blue",
  confirmed: "border-brand-green/25 bg-brand-green/10 text-brand-green",
  cancelled: "border-brand-red/25 bg-brand-red/10 text-brand-red",
  todo: "border-border bg-muted text-muted-foreground",
  in_progress: "border-brand-blue/25 bg-brand-blue/10 text-brand-blue",
  completed: "border-brand-green/25 bg-brand-green/10 text-brand-green",
  paid: "border-brand-green/25 bg-brand-green/10 text-brand-green",
  unpaid: "border-brand-orange/25 bg-brand-orange/10 text-[#b56d00] dark:text-brand-orange",
  partial: "border-brand-orange/25 bg-brand-orange/10 text-[#b56d00] dark:text-brand-orange",
  active: "border-brand-green/25 bg-brand-green/10 text-brand-green",
  inactive: "border-brand-red/25 bg-brand-red/10 text-brand-red",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  if (!status) return <Badge variant="outline">—</Badge>;

  const label =
    LEAD_STATUS_LABELS[status as LeadStatus] ??
    TASK_STATUS_LABELS[status as TaskStatus] ??
    PAYMENT_STATUS_LABELS[status as PaymentStatus] ??
    status.replaceAll("_", " ");

  return (
    <Badge
      variant="outline"
      className={cn("capitalize", styles[status], className)}
    >
      {label}
    </Badge>
  );
}