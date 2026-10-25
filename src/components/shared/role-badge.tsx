import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ROLE_CLASSES: Record<Role, string> = {
  owner: "border-brand-orange/25 bg-brand-orange/10 text-brand-orange",
  manager: "border-brand-blue/25 bg-brand-blue/10 text-brand-blue",
  employee: "border-brand-teal/25 bg-brand-teal/10 text-brand-teal",
  intern: "border-brand-green/25 bg-brand-green/10 text-brand-green",
};

export function RoleBadge({
  role,
  className,
}: {
  role: Role;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(ROLE_CLASSES[role], className)}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}
